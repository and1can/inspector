import { EventEmitter } from "events";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { TransportFactory } from "./TransportFactory.js";
import { generateSessionId, ConsoleLogger } from "./utils.js";
import mcpProxy from "../mcpProxy.js";
export class MCPProxyService extends EventEmitter {
    webAppTransports = new Map();
    backingServerTransports = new Map();
    connectionStatus = new Map();
    cleanupInProgress = new Set();
    transportFactory;
    logger;
    maxConnections;
    constructor(options = {}) {
        super();
        this.logger = options.logger || new ConsoleLogger();
        this.maxConnections = options.maxConnections || 50;
        this.transportFactory = new TransportFactory({
            logger: this.logger,
        });
    }
    async createConnection(serverConfig, requestHeaders) {
        if (this.backingServerTransports.size >= this.maxConnections) {
            throw new Error(`Maximum connections reached (${this.maxConnections})`);
        }
        const sessionId = generateSessionId();
        try {
            this.logger.info(`Creating connection ${sessionId} for ${serverConfig.name}`);
            // Update status to connecting
            this.connectionStatus.set(sessionId, {
                id: sessionId,
                status: "connecting",
                lastActivity: new Date(),
                errorCount: 0,
            });
            // Create transport
            const transport = await this.transportFactory.createTransport(serverConfig, requestHeaders);
            // Store transport
            this.backingServerTransports.set(sessionId, transport);
            // Set up transport event handlers
            this.setupTransportEvents(sessionId, transport);
            // Update status to connected
            this.updateConnectionStatus(sessionId, "connected");
            this.emit("connection", sessionId, serverConfig);
            return sessionId;
        }
        catch (error) {
            this.updateConnectionStatus(sessionId, "error");
            this.logger.error(`Failed to create connection ${sessionId}:`, error);
            throw error;
        }
    }
    getActiveConnections() {
        return Array.from(this.backingServerTransports.keys());
    }
    getConnectionStatus(sessionId) {
        return this.connectionStatus.get(sessionId);
    }
    getAllConnectionStatuses() {
        return Array.from(this.connectionStatus.values());
    }
    async sendMessage(sessionId, message) {
        const transport = this.backingServerTransports.get(sessionId);
        if (!transport) {
            throw new Error(`No transport found for session: ${sessionId}`);
        }
        try {
            this.updateConnectionStatus(sessionId, "connected");
            await transport.send(message);
        }
        catch (error) {
            this.incrementErrorCount(sessionId);
            this.logger.error(`Message failed for session ${sessionId}:`, error);
            throw error;
        }
    }
    getTransport(sessionId) {
        return this.backingServerTransports.get(sessionId);
    }
    getWebAppTransport(sessionId) {
        return this.webAppTransports.get(sessionId);
    }
    setWebAppTransport(sessionId, transport) {
        this.webAppTransports.set(sessionId, transport);
        this.logger.info(`Web app transport set for session ${sessionId}`);
    }
    removeWebAppTransport(sessionId) {
        this.webAppTransports.delete(sessionId);
        this.logger.info(`Web app transport removed for session ${sessionId}`);
    }
    async closeConnection(sessionId) {
        // Prevent duplicate cleanup calls
        if (this.cleanupInProgress.has(sessionId)) {
            return;
        }
        this.cleanupInProgress.add(sessionId);
        try {
            const transport = this.backingServerTransports.get(sessionId);
            if (transport) {
                try {
                    await transport.close();
                }
                catch (error) {
                    this.logger.error(`Error closing connection ${sessionId}:`, error);
                }
            }
            this.backingServerTransports.delete(sessionId);
            this.webAppTransports.delete(sessionId);
            this.connectionStatus.delete(sessionId);
            this.emit("disconnection", sessionId);
            this.logger.info(`🧹 Cleaning up transports for session ${sessionId}`);
        }
        finally {
            this.cleanupInProgress.delete(sessionId);
        }
    }
    async closeAllConnections() {
        const closePromises = Array.from(this.backingServerTransports.keys()).map((sessionId) => this.closeConnection(sessionId));
        await Promise.all(closePromises);
        this.logger.info(`All connections closed (${closePromises.length} total)`);
    }
    updateConnectionStatus(sessionId, status) {
        const current = this.connectionStatus.get(sessionId);
        if (current) {
            current.status = status;
            current.lastActivity = new Date();
            this.connectionStatus.set(sessionId, current);
        }
    }
    incrementErrorCount(sessionId) {
        const current = this.connectionStatus.get(sessionId);
        if (current) {
            current.errorCount += 1;
            this.connectionStatus.set(sessionId, current);
        }
    }
    setupTransportEvents(sessionId, transport) {
        // Store original handlers to preserve existing functionality
        const originalOnClose = transport.onclose;
        const originalOnError = transport.onerror;
        transport.onclose = () => {
            this.logger.info(`Transport closed for session ${sessionId}`);
            this.updateConnectionStatus(sessionId, "disconnected");
            this.emit("disconnection", sessionId);
            // Call original handler if it exists
            if (originalOnClose) {
                originalOnClose();
            }
        };
        transport.onerror = (error) => {
            this.logger.error(`Transport error for session ${sessionId}:`, error);
            this.updateConnectionStatus(sessionId, "error");
            this.incrementErrorCount(sessionId);
            this.emit("error", sessionId, error);
            // Call original handler if it exists
            if (originalOnError) {
                originalOnError(error);
            }
        };
    }
    // Helper methods for StreamableHTTP transport handling
    async createStreamableHTTPConnection(serverConfig, requestHeaders) {
        const sessionId = await this.createConnection(serverConfig, requestHeaders);
        const webAppTransport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => sessionId,
            onsessioninitialized: (newSessionId) => {
                this.logger.info(`✨ Created streamable web app transport ${newSessionId}`);
                this.setWebAppTransport(newSessionId, webAppTransport);
                // Set up proxy between web app transport and backing server transport
                const backingTransport = this.getTransport(newSessionId);
                if (backingTransport) {
                    mcpProxy({
                        transportToClient: webAppTransport,
                        transportToServer: backingTransport,
                    });
                }
                // Set up cleanup handler
                webAppTransport.onclose = () => {
                    this.closeConnection(newSessionId);
                };
            },
        });
        await webAppTransport.start();
        return { sessionId, webAppTransport };
    }
    // Helper method for SSE transport handling
    async createSSEConnection(serverConfig, res, requestHeaders) {
        const connectionId = await this.createConnection(serverConfig, requestHeaders);
        const webAppTransport = new SSEServerTransport("/message", res);
        const sessionId = webAppTransport.sessionId;
        this.setWebAppTransport(sessionId, webAppTransport);
        // Set up cleanup handler
        webAppTransport.onclose = () => {
            this.closeConnection(connectionId);
        };
        await webAppTransport.start();
        // Set up proxy between web app transport and backing server transport
        const backingTransport = this.getTransport(connectionId);
        if (backingTransport) {
            // Special handling for STDIO stderr
            if (backingTransport instanceof StdioClientTransport) {
                backingTransport.stderr?.on("data", (chunk) => {
                    webAppTransport.send({
                        jsonrpc: "2.0",
                        method: "stderr",
                        params: {
                            data: chunk.toString(),
                        },
                    });
                });
            }
            mcpProxy({
                transportToClient: webAppTransport,
                transportToServer: backingTransport,
            });
        }
        return { sessionId, webAppTransport };
    }
}
