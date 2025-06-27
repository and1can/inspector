import { MCPJamClient } from "./mcpjamClient";
import { InspectorConfig } from "./lib/configurationTypes";
import {
  Tool,
  Resource,
  Prompt,
  ServerCapabilities,
  ElicitRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { MCPJamServerConfig } from "./lib/serverTypes";
import { createDefaultConfig } from "./utils/configUtils";
import { StdErrNotification } from "./lib/notificationTypes";
import {
  CreateMessageRequest,
  CreateMessageResult,
} from "@modelcontextprotocol/sdk/types.js";
import { ConnectionStatus } from "./lib/constants";
import { ClientLogLevels } from "./hooks/helpers/types";
import { ElicitationResponse } from "./components/ElicitationModal";
import { ChatLoopProvider, ChatLoop, mappedTools, QueryProcessor, ToolCaller } from "./lib/chatLoop";
import { Tool as AnthropicTool } from "@anthropic-ai/sdk/resources/messages/messages.mjs";

export interface MCPClientOptions {
  id?: string;
  servers: Record<string, MCPJamServerConfig>;
  timeout?: number; // Optional global timeout
  inspectorConfig?: InspectorConfig; // Add optional config
  bearerToken?: string;
  headerName?: string;
  onStdErrNotification?: (notification: StdErrNotification) => void;
  onPendingRequest?: (
    request: CreateMessageRequest,
    resolve: (result: CreateMessageResult) => void,
    reject: (error: Error) => void,
  ) => void;
  onElicitationRequest?: (
    request: ElicitRequest,
    resolve: (result: ElicitationResponse) => void,
  ) => void;
  getRoots?: () => unknown[];
  addRequestHistory: (request: object, response?: object) => void;
  addClientLog: (message: string, level: ClientLogLevels) => void;
}

export interface ServerConnectionInfo {
  name: string;
  config: MCPJamServerConfig;
  client: MCPJamClient | null;
  connectionStatus: string;
  capabilities: ServerCapabilities | null;
}

export class MCPJamAgent implements ChatLoopProvider, ToolCaller {
  private mcpClientsById = new Map<string, MCPJamClient>();
  private serverConfigs: Record<string, MCPJamServerConfig>;
  private inspectorConfig: InspectorConfig;
  private bearerToken?: string;
  private headerName?: string;
  private onStdErrNotification?: (notification: StdErrNotification) => void;
  private onPendingRequest?: (
    request: CreateMessageRequest,
    resolve: (result: CreateMessageResult) => void,
    reject: (error: Error) => void,
  ) => void;
  private onElicitationRequest?: (
    request: ElicitRequest,
    resolve: (result: ElicitationResponse) => void,
  ) => void;
  private getRoots?: () => unknown[];
  private addRequestHistory: (request: object, response?: object) => void;
  public addClientLog: (message: string, level: ClientLogLevels) => void;
  private queryProcessor: QueryProcessor;
  
  // Tools cache - stores tools for each connected server
  private toolsCache = new Map<string, Tool[]>();

  constructor(options: MCPClientOptions) {
    this.serverConfigs = options.servers;
    // Use provided config or create default config
    this.inspectorConfig = options.inspectorConfig || createDefaultConfig();
    this.bearerToken = options.bearerToken;
    this.headerName = options.headerName;
    this.onStdErrNotification = options.onStdErrNotification;
    this.onPendingRequest = options.onPendingRequest;
    this.onElicitationRequest = options.onElicitationRequest;
    this.getRoots = options.getRoots;
    this.addRequestHistory = options.addRequestHistory;
    this.addClientLog = options.addClientLog;
    this.queryProcessor = new QueryProcessor(this);
  }

  // Add or update a server configuration
  addServer(name: string, config: MCPJamServerConfig) {
    this.serverConfigs[name] = config;
  }

  // Remove a server and disconnect its client
  async removeServer(name: string) {
    // Disconnect if connected
    await this.disconnectFromServer(name);
    
    // Remove from server configs
    delete this.serverConfigs[name];
    
    // Remove the client from the map
    this.mcpClientsById.delete(name);
    
    // Clear tools cache for the removed server
    this.clearToolsCache(name);
  }

  // Get list of all configured servers
  getServerNames(): string[] {
    return Object.keys(this.serverConfigs);
  }

  // Get connection info for all servers
  getAllConnectionInfo(): ServerConnectionInfo[] {
    return Object.entries(this.serverConfigs).map(([name, config]) => {
      const client = this.mcpClientsById.get(name);
      return {
        name,
        config,
        client: client || null, // Allow null for servers that haven't been connected yet
        connectionStatus: client?.connectionStatus || "disconnected",
        capabilities: client?.serverCapabilities || null,
      };
    });
  }

  // Connect to a specific server
  async connectToServer(serverName: string): Promise<MCPJamClient> {
    const serverConfig = this.serverConfigs[serverName];
    if (!serverConfig) {
      throw new Error(`Server ${serverName} not found`);
    }
    const client = await this.getOrCreateClient(serverName, serverConfig);
    
    // Cache tools for the newly connected server
    await this.cacheToolsForServer(serverName);
    
    return client;
  }

  // Connect to all servers
  async connectToAllServers(): Promise<void> {
    const connectionPromises = Object.keys(this.serverConfigs).map(
      (serverName) =>
        this.connectToServer(serverName).catch((error) => {
          console.error(`Failed to connect to server ${serverName}:`, error);
          return null;
        }),
    );
    await Promise.all(connectionPromises);
  }

  // Initialize tools cache for already connected servers (useful for agent restoration)
  async initializeToolsCache(): Promise<void> {
    const connectionInfo = this.getAllConnectionInfo();
    const connectedServers = connectionInfo.filter(
      (conn) => conn.connectionStatus === "connected" && !this.toolsCache.has(conn.name)
    );
    
    if (connectedServers.length > 0) {
      this.addClientLog(`Initializing tools cache for ${connectedServers.length} connected servers`, "debug");
      const cachePromises = connectedServers.map(serverInfo => 
        this.cacheToolsForServer(serverInfo.name)
      );
      await Promise.all(cachePromises);
    }
  }

  // Disconnect from a specific server
  async disconnectFromServer(serverName: string): Promise<void> {
    const client = this.mcpClientsById.get(serverName);
    if (client) {
      await client.disconnect();
      // Clear tools cache for the disconnected server
      this.clearToolsCache(serverName);
      // Don't remove the client from the map - keep it so it shows as disconnected
      // this.mcpClientsById.delete(serverName);
    }
  }

  // Disconnect from all servers
  async disconnectFromAllServers(): Promise<void> {
    const disconnectionPromises = Array.from(this.mcpClientsById.entries()).map(
      async ([name, client]) => {
        try {
          await client.disconnect();
        } catch (error) {
          console.error(`Failed to disconnect from server ${name}:`, error);
        }
      },
    );
    await Promise.all(disconnectionPromises);
    this.mcpClientsById.clear();
  }

  // Get client for a specific server
  getClient(serverName: string): MCPJamClient | undefined {
    return this.mcpClientsById.get(serverName);
  }

  // Get all connected clients
  getAllClients(): Map<string, MCPJamClient> {
    return new Map(this.mcpClientsById);
  }

  private async getOrCreateClient(
    name: string,
    serverConfig: MCPJamServerConfig,
  ): Promise<MCPJamClient> {
    const existingClient = this.mcpClientsById.get(name);

    // If client exists and is connected, return it
    if (existingClient && existingClient.connectionStatus === "connected") {
      return existingClient;
    }

    // If client exists but is disconnected, reconnect it
    if (existingClient && existingClient.connectionStatus === "disconnected") {
      try {
        await existingClient.connectToServer();
        return existingClient;
      } catch (error) {
        console.error(`Failed to reconnect existing client ${name}:`, error);
        // If reconnection fails, we'll create a new client below
      }
    }

    // Create new client (either no client exists or reconnection failed)
    const newClient = new MCPJamClient(
      serverConfig, // serverConfig (first parameter)
      this.inspectorConfig, // config (second parameter)
      this.addRequestHistory, // addRequestHistory
      this.addClientLog, // addClientLog
      this.bearerToken, // bearerToken
      this.headerName, // headerName
      this.onStdErrNotification, // onStdErrNotification
      this.onPendingRequest, // onPendingRequest
      this.onElicitationRequest, // onElicitationRequest
      this.getRoots, // getRoots
    );

    await newClient.connectToServer();
    this.mcpClientsById.set(name, newClient);
    return newClient;
  }

  private async getConnectedClientForServer(
    serverName: string,
  ): Promise<MCPJamClient> {
    const serverConfig = this.serverConfigs[serverName];
    if (!serverConfig) {
      throw new Error(`Server ${serverName} not found`);
    }
    const client = await this.getOrCreateClient(serverName, serverConfig);
    return client;
  }

  // Aggregate operations across all servers
  async getAllTools(): Promise<{ serverName: string; tools: Tool[] }[]> {
    const allServerTools: { serverName: string; tools: Tool[] }[] = [];
    
    // Only return tools from connected servers using cached data
    const connectionInfo = this.getAllConnectionInfo();
    const connectedServers = connectionInfo.filter(
      (conn) => conn.connectionStatus === "connected"
    );
    
    for (const serverInfo of connectedServers) {
      const cachedTools = this.toolsCache.get(serverInfo.name) || [];
      allServerTools.push({
        serverName: serverInfo.name,
        tools: cachedTools,
      });
    }
    
    return allServerTools;
  }

  // Cache tools for a specific server (called when server connects)
  private async cacheToolsForServer(serverName: string): Promise<void> {
    try {
      const client = await this.getConnectedClientForServer(serverName);
      const toolsResponse = await client.tools();
      this.toolsCache.set(serverName, toolsResponse.tools);
    } catch (error) {
      console.error(`Failed to cache tools for server ${serverName}:`, error);
      this.toolsCache.set(serverName, []);
    }
  }

  // Remove tools from cache when server disconnects
  private clearToolsCache(serverName: string): void {
    this.toolsCache.delete(serverName);
    this.addClientLog(`Cleared tools cache for server ${serverName}`, "debug");
  }

  // Manually refresh tools cache for all connected servers (if needed)
  async refreshAllToolsCache(): Promise<void> {
    const connectionInfo = this.getAllConnectionInfo();
    const connectedServers = connectionInfo.filter(
      (conn) => conn.connectionStatus === "connected"
    );
    
    const cachePromises = connectedServers.map(serverInfo => 
      this.cacheToolsForServer(serverInfo.name)
    );
    
    await Promise.all(cachePromises);
    this.addClientLog(`Refreshed tools cache for ${connectedServers.length} connected servers`, "info");
  }

  async getAllResources(): Promise<
    { serverName: string; resources: Resource[] }[]
  > {
    const allServerResources: { serverName: string; resources: Resource[] }[] =
      [];
    for (const [serverName, serverConfig] of Object.entries(
      this.serverConfigs,
    )) {
      try {
        const client = await this.getOrCreateClient(serverName, serverConfig);
        const resourcesResponse = await client.listResources();
        allServerResources.push({
          serverName,
          resources: resourcesResponse.resources,
        });
      } catch (error) {
        console.error(
          `Failed to get resources from server ${serverName}:`,
          error,
        );
        allServerResources.push({
          serverName,
          resources: [],
        });
      }
    }
    return allServerResources;
  }

  async getAllPrompts(): Promise<{ serverName: string; prompts: Prompt[] }[]> {
    const allServerPrompts: { serverName: string; prompts: Prompt[] }[] = [];
    for (const [serverName, serverConfig] of Object.entries(
      this.serverConfigs,
    )) {
      try {
        const client = await this.getOrCreateClient(serverName, serverConfig);
        const promptsResponse = await client.listPrompts();
        allServerPrompts.push({
          serverName,
          prompts: promptsResponse.prompts,
        });
      } catch (error) {
        console.error(
          `Failed to get prompts from server ${serverName}:`,
          error,
        );
        allServerPrompts.push({
          serverName,
          prompts: [],
        });
      }
    }
    return allServerPrompts;
  }

  // Server-specific operations
  async callToolOnServer(
    serverName: string,
    toolName: string,
    params: Record<string, unknown>,
  ) {
    const client = await this.getConnectedClientForServer(serverName);
    return await client.callTool({ name: toolName, arguments: params });
  }

  async readResourceFromServer(serverName: string, uri: string) {
    const client = await this.getConnectedClientForServer(serverName);
    return await client.readResource({ uri });
  }

  async getPromptFromServer(
    serverName: string,
    name: string,
    args: Record<string, string> = {},
  ) {
    const client = await this.getConnectedClientForServer(serverName);
    return await client.getPrompt({ name, arguments: args });
  }

  // Update configuration methods
  updateConfig(newInspectorConfig: Partial<InspectorConfig>) {
    this.inspectorConfig = { ...this.inspectorConfig, ...newInspectorConfig };
  }

  updateCredentials(
    bearerToken?: string,
    headerName?: string,
  ) {
    this.bearerToken = bearerToken;
    this.headerName = headerName;
  }

  // Get aggregated connection status
  getOverallConnectionStatus(): ConnectionStatus {
    const connections = this.getAllConnectionInfo();
    if (connections.length === 0) return "disconnected";

    const connectedCount = connections.filter(
      (c) => c.connectionStatus === "connected",
    ).length;
    const errorCount = connections.filter(
      (c) => c.connectionStatus === "error",
    ).length;

    if (errorCount > 0) return "error";
    if (connectedCount === connections.length) return "connected";
    return "disconnected";
  }

  // Check if there are any connected remote servers (HTTP/SSE)
  hasConnectedRemoteServer(): boolean {
    for (const [name, client] of this.mcpClientsById.entries()) {
      const config = this.serverConfigs[name];
      if (
        config &&
        config.transportType !== "stdio" &&
        client.connectionStatus === "connected"
      ) {
        return true;
      }
    }
    return false;
  }

  // Get the name of the connected remote server (if any)
  getConnectedRemoteServerName(): string | null {
    for (const [name, client] of this.mcpClientsById.entries()) {
      const config = this.serverConfigs[name];
      if (
        config &&
        config.transportType !== "stdio" &&
        client.connectionStatus === "connected"
      ) {
        return name;
      }
    }
    return null;
  }

  // Implementation of ToolCaller interface
  async callTool(params: { name: string; arguments?: { [x: string]: unknown } }): Promise<unknown> {
    // Find which server has this tool
    const allServerTools = await this.getAllTools();
    
    for (const serverTools of allServerTools) {
      const tool = serverTools.tools.find(t => t.name === params.name);
      if (tool) {
        // Call the tool on the specific server
        return await this.callToolOnServer(serverTools.serverName, params.name, params.arguments || {});
      }
    }
    
    throw new Error(`Tool ${params.name} not found on any connected server`);
  }

  async processQuery(
    query: string,
    tools: AnthropicTool[],
    onUpdate?: (content: string) => void,
    model: string = "claude-3-5-sonnet-latest",
    provider?: string,
    signal?: AbortSignal,
  ): Promise<string> {
    return this.queryProcessor.processQuery(query, tools, onUpdate, model, provider, signal);
  }

  async chatLoop(tools?: AnthropicTool[]) {
    // If no tools provided, get all tools from all servers
    if (!tools) {
      const allServerTools = await this.getAllTools();
      const allTools = allServerTools.flatMap(serverTools => 
        mappedTools(serverTools.tools)
      );
      tools = allTools;
    }

    const chatLoop = new ChatLoop(this);
    return await chatLoop.start(tools);
  }
}
