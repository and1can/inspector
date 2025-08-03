// server/src/testing/TestRunner.ts
import { EventEmitter } from "events";
import { randomUUID } from "node:crypto";
export class TestRunner extends EventEmitter {
    mcpProxyService;
    _database;
    logger;
    activeTests = new Map();
    constructor(mcpProxyService, _database, logger) {
        super();
        this.mcpProxyService = mcpProxyService;
        this._database = _database;
        this.logger = logger;
    }
    async runTest(testCase) {
        const testId = randomUUID();
        const startTime = Date.now();
        this.logger.info(`Starting test: ${testCase.name} (${testId})`);
        try {
            // Create test execution context
            const execution = new TestExecution(testId, testCase, this.logger);
            this.activeTests.set(testId, execution);
            // Create MCP connections
            const connections = await this.createConnections(testCase.serverConfigs);
            execution.setConnections(connections);
            // Execute test
            const toolCalls = await this.executeTest(testCase, connections);
            // Create result
            const result = {
                id: testId,
                testCase,
                toolCalls,
                duration: Date.now() - startTime,
                success: true,
                timestamp: new Date(),
            };
            this.logger.info(`Test completed: ${testCase.name} (${testId})`);
            this.emit("testComplete", result);
            return result;
        }
        catch (error) {
            this.logger.error(`Test failed: ${testCase.name} (${testId}):`, error);
            const result = {
                id: testId,
                testCase,
                toolCalls: [],
                duration: Date.now() - startTime,
                success: false,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date(),
            };
            this.emit("testError", result, error);
            return result;
        }
        finally {
            this.activeTests.delete(testId);
        }
    }
    async runBatch(testCases) {
        this.logger.info(`Starting batch test: ${testCases.length} tests`);
        // Run tests in parallel with controlled concurrency
        const maxConcurrency = 5;
        const results = [];
        for (let i = 0; i < testCases.length; i += maxConcurrency) {
            const batch = testCases.slice(i, i + maxConcurrency);
            const batchResults = await Promise.all(batch.map((testCase) => this.runTest(testCase)));
            results.push(...batchResults);
        }
        this.logger.info(`Batch test completed: ${results.length} results`);
        return results;
    }
    async getResults(_query) {
        // Mock implementation - in real version would query database
        return [];
    }
    async getResult(_id) {
        // Mock implementation - in real version would query database
        return null;
    }
    getActiveConnections() {
        return this.mcpProxyService.getActiveConnections();
    }
    async closeConnection(id) {
        // Note: MCPProxyService doesn't have closeConnection method
        // Would need to be implemented
        this.logger.info(`Closing connection: ${id}`);
    }
    async close() {
        // Close all active tests
        for (const [_testId, execution] of this.activeTests) {
            await execution.cancel();
        }
        this.activeTests.clear();
        // Close MCP connections
        await this.mcpProxyService.closeAllConnections();
        this.logger.info("Test runner closed");
    }
    async createConnections(serverConfigs) {
        const connections = [];
        for (const config of serverConfigs) {
            try {
                let sessionId;
                if (config.type === "stdio") {
                    // For STDIO, create a mock response for SSE
                    const mockResponse = {
                        writeHead: () => { },
                        write: () => { },
                        end: () => { },
                        on: () => { },
                        setHeader: () => { },
                    };
                    const connection = await this.mcpProxyService.createSSEConnection(config, mockResponse, {});
                    sessionId = connection.sessionId;
                }
                else if (config.type === "streamable-http") {
                    const connection = await this.mcpProxyService.createStreamableHTTPConnection(config, {});
                    sessionId = connection.sessionId;
                }
                else {
                    throw new Error(`Unsupported server type: ${config.type}`);
                }
                connections.push(sessionId);
                this.logger.info(`Created connection: ${config.name} (${sessionId})`);
            }
            catch (error) {
                this.logger.error(`Failed to create connection for ${config.name}:`, error);
                throw error;
            }
        }
        return connections;
    }
    async executeTest(testCase, connections) {
        const toolCalls = [];
        const _timeout = testCase.timeout || 30000;
        // Simple mock execution for now
        // In real implementation, would use LLM to process prompt and make tool calls
        if (testCase.expectedTools && testCase.expectedTools.length > 0) {
            for (const expectedTool of testCase.expectedTools) {
                const toolCallStartTime = Date.now();
                try {
                    // Mock tool call execution
                    await new Promise((resolve) => setTimeout(resolve, 100));
                    const toolCall = {
                        toolName: expectedTool,
                        serverId: connections[0] || "unknown",
                        serverName: "Mock Server",
                        parameters: { test: true },
                        response: {
                            success: true,
                            data: `Mock response for ${expectedTool}`,
                        },
                        executionTimeMs: Date.now() - toolCallStartTime,
                        success: true,
                        timestamp: new Date(),
                    };
                    toolCalls.push(toolCall);
                }
                catch (error) {
                    const toolCall = {
                        toolName: expectedTool,
                        serverId: connections[0] || "unknown",
                        serverName: "Mock Server",
                        parameters: { test: true },
                        response: null,
                        executionTimeMs: Date.now() - toolCallStartTime,
                        success: false,
                        error: error instanceof Error ? error.message : String(error),
                        timestamp: new Date(),
                    };
                    toolCalls.push(toolCall);
                }
            }
        }
        return toolCalls;
    }
}
class TestExecution {
    id;
    testCase;
    logger;
    _connections = [];
    cancelled = false;
    constructor(id, testCase, logger) {
        this.id = id;
        this.testCase = testCase;
        this.logger = logger;
    }
    setConnections(connections) {
        this._connections = connections;
    }
    async cancel() {
        this.cancelled = true;
        this.logger.info(`Test execution cancelled: ${this.id}`);
    }
    isCancelled() {
        return this.cancelled;
    }
}
