import { InspectorConfig } from "@/lib/configurationTypes";
import {
  DEFAULT_MCP_PROXY_LISTEN_PORT,
  DEFAULT_INSPECTOR_CONFIG,
} from "@/lib/constants";

// Cache for the actual port to avoid repeated fetches
let cachedActualPort: string | null = null;

// Function to fetch the actual port from the server
const fetchActualPort = async (): Promise<string> => {
  if (cachedActualPort !== null) {
    return cachedActualPort;
  }

  // Try multiple ports starting from the default port
  const startPort = parseInt(DEFAULT_MCP_PROXY_LISTEN_PORT);
  const maxAttempts = 5; // Try 5 consecutive ports

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const tryPort = startPort + attempt;
    
    try {
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:${tryPort}/port`);
      
      if (response.ok) {
        const data = await response.json();
        const actualPort = data.port.toString();
        cachedActualPort = actualPort;
        return actualPort;
      }
    } catch (error) {
      // Continue to next port
      console.debug(`Port discovery: failed to connect to port ${tryPort}:`, error);
    }
  }

  console.warn('Failed to discover actual port, using default:', DEFAULT_MCP_PROXY_LISTEN_PORT);
  return DEFAULT_MCP_PROXY_LISTEN_PORT;
};

export const getMCPProxyAddress = (config: InspectorConfig): string => {
  const proxyFullAddress = config.MCP_PROXY_FULL_ADDRESS.value as string;
  if (proxyFullAddress) {
    return proxyFullAddress;
  }
  return `${window.location.protocol}//${window.location.hostname}:${DEFAULT_MCP_PROXY_LISTEN_PORT}`;
};

// New async version that fetches the actual port
export const getMCPProxyAddressAsync = async (config: InspectorConfig): Promise<string> => {
  const proxyFullAddress = config.MCP_PROXY_FULL_ADDRESS.value as string;
  if (proxyFullAddress) {
    return proxyFullAddress;
  }
  
  const actualPort = await fetchActualPort();
  console.log("xcxc actualPort", actualPort);
  return `${window.location.protocol}//${window.location.hostname}:${actualPort}`;
};

export const getMCPServerRequestTimeout = (config: InspectorConfig): number => {
  return config.MCP_SERVER_REQUEST_TIMEOUT.value as number;
};

export const resetRequestTimeoutOnProgress = (
  config: InspectorConfig,
): boolean => {
  return config.MCP_REQUEST_TIMEOUT_RESET_ON_PROGRESS.value as boolean;
};

export const getMCPServerRequestMaxTotalTimeout = (
  config: InspectorConfig,
): number => {
  return config.MCP_REQUEST_MAX_TOTAL_TIMEOUT.value as number;
};

const getSearchParam = (key: string): string | null => {
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get(key);
  } catch {
    return null;
  }
};

export const getInitialTransportType = ():
  | "stdio"
  | "sse"
  | "streamable-http" => {
  const param = getSearchParam("transport");
  if (param === "stdio" || param === "sse" || param === "streamable-http") {
    return param;
  }
  return (
    (localStorage.getItem("lastTransportType") as
      | "stdio"
      | "sse"
      | "streamable-http") || "stdio"
  );
};

export const getInitialSseUrl = (): string => {
  const param = getSearchParam("serverUrl");
  if (param) return param;
  return localStorage.getItem("lastSseUrl") || "http://localhost:6277/sse";
};

export const getInitialCommand = (): string => {
  const param = getSearchParam("serverCommand");
  if (param) return param;
  return localStorage.getItem("lastCommand") || "mcp-server-everything";
};

export const getInitialArgs = (): string => {
  const param = getSearchParam("serverArgs");
  if (param) return param;
  return localStorage.getItem("lastArgs") || "";
};

// Returns a map of config key -> value from query params if present
export const getConfigOverridesFromQueryParams = (
  defaultConfig: InspectorConfig,
): Partial<InspectorConfig> => {
  const url = new URL(window.location.href);
  const overrides: Partial<InspectorConfig> = {};
  for (const key of Object.keys(defaultConfig)) {
    const param = url.searchParams.get(key);
    if (param !== null) {
      const defaultConfigItem = defaultConfig[key as keyof InspectorConfig];
      if (defaultConfigItem) {
        // Try to coerce to correct type based on default value
        const defaultValue = defaultConfigItem.value;
        let value: string | number | boolean = param;
        if (typeof defaultValue === "number") {
          value = Number(param);
        } else if (typeof defaultValue === "boolean") {
          value = param === "true";
        }
        overrides[key as keyof InspectorConfig] = {
          ...defaultConfigItem,
          value,
        };
      }
    }
  }
  return overrides;
};

export const initializeInspectorConfig = (
  localStorageKey: string,
): InspectorConfig => {
  const savedConfig = localStorage.getItem(localStorageKey);
  let baseConfig: InspectorConfig;
  if (savedConfig) {
    // merge default config with saved config
    const mergedConfig = {
      ...DEFAULT_INSPECTOR_CONFIG,
      ...JSON.parse(savedConfig),
    } as InspectorConfig;

    // update description of keys to match the new description (in case of any updates to the default config description)
    for (const [key, value] of Object.entries(mergedConfig)) {
      const defaultConfigItem =
        DEFAULT_INSPECTOR_CONFIG[key as keyof InspectorConfig];
      if (defaultConfigItem) {
        mergedConfig[key as keyof InspectorConfig] = {
          ...value,
          label: defaultConfigItem.label,
        };
      }
    }
    baseConfig = mergedConfig;
  } else {
    baseConfig = DEFAULT_INSPECTOR_CONFIG;
  }
  // Apply query param overrides
  const overrides = getConfigOverridesFromQueryParams(DEFAULT_INSPECTOR_CONFIG);
  return { ...baseConfig, ...overrides };
};

/**
 * Creates a default InspectorConfig with standard values
 * @returns InspectorConfig with default values
 */
export const createDefaultConfig = (): InspectorConfig => {
  return {
    MCP_SERVER_REQUEST_TIMEOUT: {
      label: "MCP Server Request Timeout",
      description:
        "Maximum time in milliseconds to wait for a response from the MCP server",
      value: 30000,
    },
    MCP_REQUEST_TIMEOUT_RESET_ON_PROGRESS: {
      label: "Reset Timeout on Progress",
      description: "Whether to reset the timeout on progress notifications",
      value: true,
    },
    MCP_REQUEST_MAX_TOTAL_TIMEOUT: {
      label: "Max Total Timeout",
      description: "Maximum total time in milliseconds to wait for a response",
      value: 300000,
    },
    MCP_PROXY_FULL_ADDRESS: {
      label: "MCP Proxy Address",
      description: "The full address of the MCP Proxy Server",
      value: "http://localhost:6277",
    },
  };
};
