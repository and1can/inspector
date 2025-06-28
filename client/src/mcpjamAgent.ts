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
import * as chatHelpers from "./lib/agentChat";
import { Tool as AnthropicTool } from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import { SupportedProvider } from "./lib/providers";

/**
 * Configuration options for MCP agent
 */
export interface MCPClientOptions {
  id?: string;
  servers: Record<string, MCPJamServerConfig>;
  timeout?: number;
  inspectorConfig?: InspectorConfig;
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

/**
 * Information about a server connection
 */
export interface ServerConnectionInfo {
  name: string;
  config: MCPJamServerConfig;
  client: MCPJamClient | null;
  connectionStatus: string;
  capabilities: ServerCapabilities | null;
}

/**
 * Agent that manages multiple MCP server connections
 */
export class MCPJamAgent {
  // Client and server management
  private mcpClientsById = new Map<string, MCPJamClient>();
  private serverConfigs: Record<string, MCPJamServerConfig>;
  private inspectorConfig: InspectorConfig;

  // Authentication
  private bearerToken?: string;
  private headerName?: string;

  // Callbacks and handlers
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

  // Public methods
  public addClientLog: (message: string, level: ClientLogLevels) => void;

  // Chat processing functionality is imported from chatHelpers

  // Performance optimization: cache data and timestamps for each server
  private toolsCache = new Map<string, { tools: Tool[]; timestamp: number }>();
  private resourcesCache = new Map<
    string,
    { resources: Resource[]; timestamp: number }
  >();
  private promptsCache = new Map<
    string,
    { prompts: Prompt[]; timestamp: number }
  >();

  // Cache expiry times in milliseconds
  private readonly TOOLS_CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes
  private readonly RESOURCES_CACHE_EXPIRY = 2 * 60 * 1000; // 2 minutes
  private readonly PROMPTS_CACHE_EXPIRY = 3 * 60 * 1000; // 3 minutes

  /**
   * Creates a new MCPJamAgent to manage multiple MCP server connections
   * @param options Configuration options
   */
  constructor(options: MCPClientOptions) {
    this.serverConfigs = options.servers;
    this.inspectorConfig = options.inspectorConfig || createDefaultConfig();

    // Set authentication options
    this.bearerToken = options.bearerToken;
    this.headerName = options.headerName;

    // Set callbacks
    this.onStdErrNotification = options.onStdErrNotification;
    this.onPendingRequest = options.onPendingRequest;
    this.onElicitationRequest = options.onElicitationRequest;
    this.getRoots = options.getRoots;
    this.addRequestHistory = options.addRequestHistory;
    this.addClientLog = options.addClientLog;

    // Chat processing functionality is imported from chatHelpers
  }

  /**
   * Add or update a server configuration
   * @param name Server name
   * @param config Server configuration
   */
  addServer(name: string, config: MCPJamServerConfig): void {
    this.serverConfigs[name] = config;
  }

  /**
   * Remove a server and disconnect its client
   * @param name Server name to remove
   */
  async removeServer(name: string): Promise<void> {
    // Disconnect if connected
    await this.disconnectFromServer(name);

    // Clean up all references to this server
    delete this.serverConfigs[name];
    this.mcpClientsById.delete(name);
    this.clearCaches(name);
  }

  /**
   * Get list of all configured server names
   * @returns Array of server names
   */
  getServerNames(): string[] {
    return Object.keys(this.serverConfigs);
  }

  /**
   * Get connection information for all configured servers
   * @returns Array of server connection information
   */
  getAllConnectionInfo(): ServerConnectionInfo[] {
    return Object.entries(this.serverConfigs).map(([name, config]) => {
      const client = this.mcpClientsById.get(name);
      return {
        name,
        config,
        client: client || null,
        connectionStatus: client?.connectionStatus || "disconnected",
        capabilities: client?.serverCapabilities || null,
      };
    });
  }

  /**
   * Connect to a specific server by name
   * @param serverName Name of the server to connect to
   * @returns The connected client
   * @throws Error if server not found
   */
  async connectToServer(serverName: string): Promise<MCPJamClient> {
    const serverConfig = this.serverConfigs[serverName];
    if (!serverConfig) {
      throw new Error(`Server ${serverName} not found`);
    }
    const client = await this.getOrCreateClient(serverName, serverConfig);

    // Cache data for the newly connected server for performance
    this.addClientLog(
      `Initializing caches for new connection to ${serverName}`,
      "debug",
    );

    // Use Promise.all to initialize all caches in parallel
    await Promise.all([
      this.cacheToolsForServer(serverName),
      this.cacheResourcesForServer(serverName),
      this.cachePromptsForServer(serverName),
    ]);

    return client;
  }

  /**
   * Connect to all configured servers in parallel
   * @returns Promise that resolves when all connection attempts complete
   */
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

  /**
   * Check if a specific cache for a server is valid and not expired
   * @param cache The cache Map to check
   * @param serverName Name of the server to check
   * @param expiryTime Expiry time in milliseconds
   * @returns true if cache exists and is valid
   */
  private isCacheValid<T>(
    cache: Map<string, { timestamp: number } & T>,
    serverName: string,
    expiryTime: number,
  ): boolean {
    const cacheEntry = cache.get(serverName);
    if (!cacheEntry) return false;

    const now = Date.now();
    return now - cacheEntry.timestamp < expiryTime;
  }

  /**
   * Check if the tools cache for a server is valid and not expired
   * @param serverName Name of the server to check
   * @returns true if cache exists and is valid
   */
  private isToolsCacheValid(serverName: string): boolean {
    return this.isCacheValid(
      this.toolsCache,
      serverName,
      this.TOOLS_CACHE_EXPIRY,
    );
  }

  /**
   * Check if the resources cache for a server is valid and not expired
   * @param serverName Name of the server to check
   * @returns true if cache exists and is valid
   */
  private isResourcesCacheValid(serverName: string): boolean {
    return this.isCacheValid(
      this.resourcesCache,
      serverName,
      this.RESOURCES_CACHE_EXPIRY,
    );
  }

  /**
   * Check if the prompts cache for a server is valid and not expired
   * @param serverName Name of the server to check
   * @returns true if cache exists and is valid
   */
  private isPromptsCacheValid(serverName: string): boolean {
    return this.isCacheValid(
      this.promptsCache,
      serverName,
      this.PROMPTS_CACHE_EXPIRY,
    );
  }

  /**
   * Find servers that need tools cache initialization
   * @returns Array of server information objects that need cache initialization
   */
  private findServersNeedingCacheInit(): ServerConnectionInfo[] {
    const connectionInfo = this.getAllConnectionInfo();
    return connectionInfo.filter(
      (conn) =>
        conn.connectionStatus === "connected" &&
        !this.isToolsCacheValid(conn.name),
    );
  }

  /**
   * Initialize tools cache for already connected servers
   * Useful for agent restoration after page refresh
   */
  async initializeToolsCache(): Promise<void> {
    const serversNeedingCache = this.findServersNeedingCacheInit();

    if (serversNeedingCache.length > 0) {
      this.addClientLog(
        `Initializing tools cache for ${serversNeedingCache.length} connected servers`,
        "debug",
      );
      const cachePromises = serversNeedingCache.map((serverInfo) =>
        this.cacheToolsForServer(serverInfo.name),
      );
      await Promise.all(cachePromises);
    }
  }

  /**
   * Disconnect from a specific server
   * Keeps the client in the map with disconnected status
   * @param serverName Name of the server to disconnect from
   */
  async disconnectFromServer(serverName: string): Promise<void> {
    const client = this.mcpClientsById.get(serverName);
    if (client) {
      await client.disconnect();
      this.clearCaches(serverName);
      // Note: We keep the client in the map so it shows as disconnected in the UI
    }
  }

  /**
   * Disconnect from all servers and clear the client map
   */
  async disconnectFromAllServers(): Promise<void> {
    const disconnectionPromises = Array.from(this.mcpClientsById.entries()).map(
      async ([name, client]) => {
        try {
          await client.disconnect();
          this.clearCaches(name);
        } catch (error) {
          console.error(`Failed to disconnect from server ${name}:`, error);
        }
      },
    );

    await Promise.all(disconnectionPromises);
    this.mcpClientsById.clear();
  }

  /**
   * Get client for a specific server
   * @param serverName Name of the server
   * @returns The client or undefined if not found
   */
  getClient(serverName: string): MCPJamClient | undefined {
    return this.mcpClientsById.get(serverName);
  }

  /**
   * Get a copy of the map of all clients
   * @returns New map of server names to clients
   */
  getAllClients(): Map<string, MCPJamClient> {
    return new Map(this.mcpClientsById);
  }

  /**
   * Gets an existing client or creates a new one for the specified server
   * @param name Server name
   * @param serverConfig Server configuration
   * @returns Connected client instance
   */
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

  /**
   * Gets a connected client for the specified server
   * Creates and connects the client if needed
   * @param serverName Server name
   * @returns Connected client instance
   * @throws Error if server not found
   */
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

  /**
   * Get tools for a specific server, using cache when possible
   * @param serverInfo Server connection information
   * @param refreshPromises Array to collect refresh promises for background processing
   * @returns Server tools wrapped in an object with server name
   */
  private getServerTools(
    serverInfo: ServerConnectionInfo,
    refreshPromises: Promise<void>[],
  ): { serverName: string; tools: Tool[] } {
    // Check if cache needs refreshing
    if (!this.isToolsCacheValid(serverInfo.name)) {
      // Add to refresh promises but don't wait - continue processing other servers
      refreshPromises.push(this.cacheToolsForServer(serverInfo.name));
    }

    // Use cached data (even if it's being refreshed concurrently)
    const cachedEntry = this.toolsCache.get(serverInfo.name);
    return {
      serverName: serverInfo.name,
      tools: cachedEntry?.tools || [],
    };
  }

  /**
   * Get all tools from all connected servers
   * Uses cached tool data for better performance with automatic refresh of expired caches
   * @returns Array of server tools by server name
   */
  async getAllTools(): Promise<{ serverName: string; tools: Tool[] }[]> {
    const allServerTools: { serverName: string; tools: Tool[] }[] = [];
    const refreshPromises: Promise<void>[] = [];

    // Get all connected servers
    const connectedServers = this.getConnectedServers();

    // Process each connected server
    for (const serverInfo of connectedServers) {
      const serverTools = this.getServerTools(serverInfo, refreshPromises);
      allServerTools.push(serverTools);
    }

    // Start cache refresh in background if needed
    if (refreshPromises.length > 0) {
      this.addClientLog(
        `Starting background refresh for ${refreshPromises.length} expired tool caches`,
        "debug",
      );
      // Use Promise.all but don't await - let it run in background
      Promise.all(refreshPromises).catch((error) => {
        console.error("Error refreshing tool cache:", error);
      });
    }

    return allServerTools;
  }

  /**
   * Cache tools for a specific server
   * @param serverName Name of the server to cache tools for
   */
  private async cacheToolsForServer(serverName: string): Promise<void> {
    try {
      const client = await this.getConnectedClientForServer(serverName);
      const toolsResponse = await client.tools();
      const timestamp = Date.now();

      // Store tools with timestamp for cache expiration checking
      this.toolsCache.set(serverName, {
        tools: toolsResponse.tools,
        timestamp,
      });

      this.addClientLog(
        `Cached ${toolsResponse.tools.length} tools for ${serverName}`,
        "debug",
      );
    } catch (error) {
      console.error(`Failed to cache tools for server ${serverName}:`, error);
      // Store empty tools array with current timestamp
      this.toolsCache.set(serverName, { tools: [], timestamp: Date.now() });
    }
  }

  /**
   * Remove all cached data for a server
   * @param serverName Name of the server to clear caches for
   */
  private clearCaches(serverName: string): void {
    // Clear tools cache
    if (this.toolsCache.has(serverName)) {
      this.toolsCache.delete(serverName);
      this.addClientLog(
        `Cleared tools cache for server ${serverName}`,
        "debug",
      );
    }

    // Clear resources cache
    if (this.resourcesCache.has(serverName)) {
      this.resourcesCache.delete(serverName);
      this.addClientLog(
        `Cleared resources cache for server ${serverName}`,
        "debug",
      );
    }

    // Clear prompts cache
    if (this.promptsCache.has(serverName)) {
      this.promptsCache.delete(serverName);
      this.addClientLog(
        `Cleared prompts cache for server ${serverName}`,
        "debug",
      );
    }
  }

  /**
   * Get all connected servers
   * @returns Array of server information objects for connected servers
   */
  private getConnectedServers(): ServerConnectionInfo[] {
    const connectionInfo = this.getAllConnectionInfo();
    return connectionInfo.filter(
      (conn) => conn.connectionStatus === "connected",
    );
  }

  /**
   * Refresh all caches for a specific server
   * @param serverName Name of server to refresh caches for
   */
  async refreshServerCaches(serverName: string): Promise<void> {
    this.addClientLog(
      `Refreshing all caches for server ${serverName}`,
      "debug",
    );

    try {
      // Run all cache operations in parallel
      await Promise.all([
        this.cacheToolsForServer(serverName),
        this.cacheResourcesForServer(serverName),
        this.cachePromptsForServer(serverName),
      ]);

      this.addClientLog(
        `Successfully refreshed all caches for ${serverName}`,
        "info",
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.addClientLog(
        `Error refreshing caches for ${serverName}: ${errorMessage}`,
        "error",
      );
    }
  }

  /**
   * Manually refresh tools cache for all connected servers
   */
  async refreshAllToolsCache(): Promise<void> {
    const connectedServers = this.getConnectedServers();

    if (connectedServers.length === 0) {
      this.addClientLog("No connected servers to refresh cache", "info");
      return;
    }

    this.addClientLog(
      `Starting tools cache refresh for ${connectedServers.length} servers`,
      "debug",
    );

    const cachePromises = connectedServers.map((serverInfo) =>
      this.cacheToolsForServer(serverInfo.name),
    );

    await Promise.all(cachePromises);
    this.addClientLog(
      `Refreshed tools cache for ${connectedServers.length} connected servers`,
      "info",
    );
  }

  /**
   * Manually refresh all caches for all connected servers
   */
  async refreshAllCaches(): Promise<void> {
    const connectedServers = this.getConnectedServers();

    if (connectedServers.length === 0) {
      this.addClientLog("No connected servers to refresh caches", "info");
      return;
    }

    this.addClientLog(
      `Starting full cache refresh for ${connectedServers.length} servers`,
      "info",
    );

    for (const serverInfo of connectedServers) {
      await this.refreshServerCaches(serverInfo.name).catch((error) => {
        console.error(
          `Failed to refresh caches for ${serverInfo.name}:`,
          error,
        );
      });
    }

    this.addClientLog(
      `Completed full cache refresh for ${connectedServers.length} servers`,
      "info",
    );
  }

  /**
   * Cache resources for a specific server
   * @param serverName Name of the server to cache resources for
   */
  private async cacheResourcesForServer(serverName: string): Promise<void> {
    try {
      const client = await this.getConnectedClientForServer(serverName);
      const resourcesResponse = await client.listResources();
      const timestamp = Date.now();

      // Store resources with timestamp for cache expiration checking
      this.resourcesCache.set(serverName, {
        resources: resourcesResponse.resources,
        timestamp,
      });

      this.addClientLog(
        `Cached ${resourcesResponse.resources.length} resources for ${serverName}`,
        "debug",
      );
    } catch (error) {
      console.error(
        `Failed to cache resources for server ${serverName}:`,
        error,
      );
      // Store empty resources array with current timestamp
      this.resourcesCache.set(serverName, {
        resources: [],
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Get resources from a specific server
   * @param serverName Name of the server
   * @param serverConfig Server configuration
   * @param useCache Whether to use cached resources if available (default: true)
   * @returns Server resources wrapped in an object with server name
   */
  private async getServerResources(
    serverName: string,
    serverConfig: MCPJamServerConfig,
    useCache: boolean = true,
  ): Promise<{ serverName: string; resources: Resource[] }> {
    // Check cache first if enabled
    if (useCache && this.isResourcesCacheValid(serverName)) {
      const cachedEntry = this.resourcesCache.get(serverName);
      if (cachedEntry) {
        this.addClientLog(
          `Using cached ${cachedEntry.resources.length} resources for ${serverName}`,
          "debug",
        );
        return {
          serverName,
          resources: cachedEntry.resources,
        };
      }
    }

    // If not in cache or cache disabled, fetch from server
    try {
      this.addClientLog(
        `Fetching resources from server ${serverName}`,
        "debug",
      );
      const client = await this.getOrCreateClient(serverName, serverConfig);
      const resourcesResponse = await client.listResources();

      // Update cache with new data
      this.resourcesCache.set(serverName, {
        resources: resourcesResponse.resources,
        timestamp: Date.now(),
      });

      this.addClientLog(
        `Received ${resourcesResponse.resources.length} resources from ${serverName}`,
        "debug",
      );

      return {
        serverName,
        resources: resourcesResponse.resources,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.addClientLog(
        `Failed to get resources from server ${serverName}: ${errorMessage}`,
        "error",
      );
      console.error(
        `Failed to get resources from server ${serverName}:`,
        error,
      );
      return {
        serverName,
        resources: [],
      };
    }
  }

  /**
   * Get all resources from all servers
   * @param parallel Whether to fetch resources in parallel (default: false)
   * @returns Array of resources by server name
   */
  async getAllResources(
    parallel: boolean = false,
  ): Promise<{ serverName: string; resources: Resource[] }[]> {
    const serverEntries = Object.entries(this.serverConfigs);

    if (parallel) {
      // Process servers in parallel for faster performance
      this.addClientLog(
        `Fetching resources from ${serverEntries.length} servers in parallel`,
        "debug",
      );
      const resourcePromises = serverEntries.map(([serverName, serverConfig]) =>
        this.getServerResources(serverName, serverConfig),
      );

      return await Promise.all(resourcePromises);
    } else {
      // Process servers sequentially to avoid overwhelming connections
      this.addClientLog(
        `Fetching resources from ${serverEntries.length} servers sequentially`,
        "debug",
      );
      const allServerResources: {
        serverName: string;
        resources: Resource[];
      }[] = [];

      for (const [serverName, serverConfig] of serverEntries) {
        const serverResources = await this.getServerResources(
          serverName,
          serverConfig,
        );
        allServerResources.push(serverResources);
      }

      return allServerResources;
    }
  }

  /**
   * Cache prompts for a specific server
   * @param serverName Name of the server to cache prompts for
   */
  private async cachePromptsForServer(serverName: string): Promise<void> {
    try {
      const client = await this.getConnectedClientForServer(serverName);
      const promptsResponse = await client.listPrompts();
      const timestamp = Date.now();

      // Store prompts with timestamp for cache expiration checking
      this.promptsCache.set(serverName, {
        prompts: promptsResponse.prompts,
        timestamp,
      });

      this.addClientLog(
        `Cached ${promptsResponse.prompts.length} prompts for ${serverName}`,
        "debug",
      );
    } catch (error) {
      console.error(`Failed to cache prompts for server ${serverName}:`, error);
      // Store empty prompts array with current timestamp
      this.promptsCache.set(serverName, { prompts: [], timestamp: Date.now() });
    }
  }

  /**
   * Get prompts from a specific server
   * @param serverName Name of the server
   * @param serverConfig Server configuration
   * @param useCache Whether to use cached prompts if available (default: true)
   * @returns Server prompts wrapped in an object with server name
   */
  private async getServerPrompts(
    serverName: string,
    serverConfig: MCPJamServerConfig,
    useCache: boolean = true,
  ): Promise<{ serverName: string; prompts: Prompt[] }> {
    // Check cache first if enabled
    if (useCache && this.isPromptsCacheValid(serverName)) {
      const cachedEntry = this.promptsCache.get(serverName);
      if (cachedEntry) {
        this.addClientLog(
          `Using cached ${cachedEntry.prompts.length} prompts for ${serverName}`,
          "debug",
        );
        return {
          serverName,
          prompts: cachedEntry.prompts,
        };
      }
    }

    // If not in cache or cache disabled, fetch from server
    try {
      this.addClientLog(`Fetching prompts from server ${serverName}`, "debug");
      const client = await this.getOrCreateClient(serverName, serverConfig);
      const promptsResponse = await client.listPrompts();

      // Update cache with new data
      this.promptsCache.set(serverName, {
        prompts: promptsResponse.prompts,
        timestamp: Date.now(),
      });

      this.addClientLog(
        `Received ${promptsResponse.prompts.length} prompts from ${serverName}`,
        "debug",
      );

      return {
        serverName,
        prompts: promptsResponse.prompts,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.addClientLog(
        `Failed to get prompts from server ${serverName}: ${errorMessage}`,
        "error",
      );
      console.error(`Failed to get prompts from server ${serverName}:`, error);
      return {
        serverName,
        prompts: [],
      };
    }
  }

  /**
   * Get all prompts from all servers
   * @param parallel Whether to fetch prompts in parallel (default: false)
   * @returns Array of prompts by server name
   */
  async getAllPrompts(
    parallel: boolean = false,
  ): Promise<{ serverName: string; prompts: Prompt[] }[]> {
    const serverEntries = Object.entries(this.serverConfigs);

    if (parallel) {
      // Process servers in parallel for faster performance
      this.addClientLog(
        `Fetching prompts from ${serverEntries.length} servers in parallel`,
        "debug",
      );
      const promptPromises = serverEntries.map(([serverName, serverConfig]) =>
        this.getServerPrompts(serverName, serverConfig),
      );

      return await Promise.all(promptPromises);
    } else {
      // Process servers sequentially to avoid overwhelming connections
      this.addClientLog(
        `Fetching prompts from ${serverEntries.length} servers sequentially`,
        "debug",
      );
      const allServerPrompts: { serverName: string; prompts: Prompt[] }[] = [];

      for (const [serverName, serverConfig] of serverEntries) {
        const serverPrompts = await this.getServerPrompts(
          serverName,
          serverConfig,
        );
        allServerPrompts.push(serverPrompts);
      }

      return allServerPrompts;
    }
  }

  /**
   * Call a specific tool on a specific server
   * @param serverName Name of the server
   * @param toolName Name of the tool to call
   * @param params Parameters to pass to the tool
   * @returns Tool execution result
   */
  async callToolOnServer(
    serverName: string,
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    const client = await this.getConnectedClientForServer(serverName);
    return await client.callTool({ name: toolName, arguments: params });
  }

  /**
   * Read a resource from a specific server
   * @param serverName Name of the server
   * @param uri URI of the resource
   * @returns Resource content
   * @throws Error if server not found or resource read fails
   */
  async readResourceFromServer(
    serverName: string,
    uri: string,
  ): Promise<unknown> {
    try {
      const client = await this.getConnectedClientForServer(serverName);
      this.addClientLog(
        `Reading resource '${uri}' from server ${serverName}`,
        "debug",
      );

      const resourceResult = await client.readResource({ uri });
      this.addClientLog(`Successfully read resource '${uri}'`, "debug");

      return resourceResult;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.addClientLog(
        `Failed to read resource '${uri}' from server ${serverName}: ${errorMessage}`,
        "error",
      );
      throw error; // Re-throw for proper handling by caller
    }
  }

  /**
   * Get a prompt from a specific server
   * @param serverName Name of the server
   * @param name Name of the prompt
   * @param args Arguments for the prompt
   * @returns Prompt content
   * @throws Error if server not found or connection fails
   */
  async getPromptFromServer(
    serverName: string,
    name: string,
    args: Record<string, string> = {},
  ): Promise<unknown> {
    try {
      const client = await this.getConnectedClientForServer(serverName);
      this.addClientLog(
        `Fetching prompt '${name}' from server ${serverName}`,
        "debug",
      );

      const promptResult = await client.getPrompt({ name, arguments: args });
      this.addClientLog(`Successfully fetched prompt '${name}'`, "debug");

      return promptResult;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.addClientLog(
        `Failed to get prompt '${name}' from server ${serverName}: ${errorMessage}`,
        "error",
      );
      throw error; // Re-throw for proper handling by caller
    }
  }

  /**
   * Update the inspector configuration
   * @param newInspectorConfig New configuration to merge
   */
  updateConfig(newInspectorConfig: Partial<InspectorConfig>): void {
    this.inspectorConfig = { ...this.inspectorConfig, ...newInspectorConfig };
  }

  /**
   * Update authentication credentials
   * @param bearerToken Optional bearer token
   * @param headerName Optional custom header name
   */
  updateCredentials(bearerToken?: string, headerName?: string): void {
    this.bearerToken = bearerToken;
    this.headerName = headerName;
  }

  /**
   * Get aggregated connection status across all servers
   * @returns Overall connection status
   */
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

  /**
   * Check if there are any connected remote servers (HTTP/SSE)
   * @returns true if at least one remote server is connected
   */
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

  /**
   * Get the name of the connected remote server (if any)
   * @returns Name of the first connected remote server or null
   */
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

  /**
   * Find servers with the specified capability
   * @param items Array of server data objects
   * @param itemsKey The key to access the array of items in each server data object
   * @param checkFn Function to check if server has the required capability
   * @returns Array of server names that match the criteria
   */
  private findServersWithCapability<T>(
    items: { serverName: string; [key: string]: unknown }[],
    itemsKey: string,
    checkFn: (items: T[]) => boolean,
  ): string[] {
    const matchingServers: string[] = [];

    for (const serverData of items) {
      const itemsArray = serverData[itemsKey] as T[];
      if (itemsArray && checkFn(itemsArray)) {
        matchingServers.push(serverData.serverName);
      }
    }

    return matchingServers;
  }

  /**
   * Find a server that has the specified tool
   * @param toolName Name of the tool to find
   * @returns The server name where the tool is available, or null if not found
   */
  private async findServerWithTool(toolName: string): Promise<string | null> {
    const allServerTools = await this.getAllTools();

    const matchingServers = this.findServersWithCapability(
      allServerTools,
      "tools",
      (tools: Tool[]) => tools.some((t) => t.name === toolName),
    );

    return matchingServers.length > 0 ? matchingServers[0] : null;
  }

  /**
   * Find servers that have a specific resource
   * @param resourceUri URI of the resource to find
   * @returns Array of server names where the resource is available
   */
  async findServersWithResource(resourceUri: string): Promise<string[]> {
    const allServerResources = await this.getAllResources();

    return this.findServersWithCapability(
      allServerResources,
      "resources",
      (resources: Resource[]) => resources.some((r) => r.uri === resourceUri),
    );
  }

  /**
   * Find servers that have a specific prompt
   * @param promptName Name of the prompt to find
   * @returns Array of server names where the prompt is available
   */
  async findServersWithPrompt(promptName: string): Promise<string[]> {
    const allServerPrompts = await this.getAllPrompts();

    return this.findServersWithCapability(
      allServerPrompts,
      "prompts",
      (prompts: Prompt[]) => prompts.some((p) => p.name === promptName),
    );
  }

  /**
   * Implementation of ToolCaller interface
   * Finds the server that has the requested tool and calls it
   * @param params Tool parameters including name and arguments
   * @returns Tool execution result
   * @throws Error if tool not found on any connected server
   */
  async callTool(params: {
    name: string;
    arguments?: Record<string, unknown>;
  }): Promise<unknown> {
    // Find which server has this tool
    const serverName = await this.findServerWithTool(params.name);

    if (serverName) {
      // Call the tool on the specific server
      return await this.callToolOnServer(
        serverName,
        params.name,
        params.arguments || {},
      );
    }

    throw new Error(`Tool ${params.name} not found on any connected server`);
  }

  /**
   * Process a query using the specified tools
   * @param query The query text
   * @param tools Tools available for the AI to use
   * @param onUpdate Optional callback for streaming updates
   * @param model Model identifier
   * @param provider Optional AI provider
   * @param signal Optional abort signal
   * @returns Model response text
   */
  async processQuery(
    query: string,
    tools: AnthropicTool[],
    onUpdate?: (content: string) => void,
    model: string = "claude-3-5-sonnet-latest",
    provider?: SupportedProvider,
    signal?: AbortSignal,
    toolCallApprover?: chatHelpers.ToolCallApprover,
  ): Promise<string> {
    return chatHelpers.processQuery(
      query,
      tools,
      this,
      toolCallApprover,
      onUpdate,
      model,
      provider,
      signal,
    );
  }
}
