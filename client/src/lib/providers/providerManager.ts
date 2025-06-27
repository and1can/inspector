import {
  AIProvider,
  SupportedProvider,
  ProviderConfig,
  ApiKeyProviderConfig,
  HostUrlProviderConfig,
} from "./types";
import { providerFactory } from "./providerFactory";

interface ProviderInfo {
  provider: AIProvider | null;
  isValid: boolean;
  apiKey: string; // Keep as apiKey for backward compatibility in the interface
  hostUrl?: string; // Add hostUrl for Ollama
}

interface StorageKeys {
  [key: string]: string;
}

export class ProviderManager {
  private providers: Map<SupportedProvider, ProviderInfo> = new Map();
  private storageKeys: StorageKeys = {
    anthropic: "claude-api-key",
    openai: "openai-api-key",
    ollama: "ollama-host",
  };

  constructor() {
    this.initializeProviders();
    this.loadApiKeysFromStorage();
  }

  private initializeProviders() {
    // Initialize with null providers
    this.providers.set("anthropic", {
      provider: null,
      isValid: false,
      apiKey: "",
    });
    this.providers.set("openai", {
      provider: null,
      isValid: false,
      apiKey: "",
    });
    this.providers.set("ollama", {
      provider: null,
      isValid: false,
      apiKey: "",
      hostUrl: "",
    });
  }

  private loadApiKeysFromStorage() {
    this.providers.forEach((_, providerType) => {
      try {
        const storageKey = this.storageKeys[providerType];
        const storedValue = localStorage.getItem(storageKey) || "";
        if (storedValue && this.validateApiKey(providerType, storedValue)) {
          this.setApiKey(providerType, storedValue);
        } else if (providerType === "ollama") {
          // Auto-initialize Ollama with default host if no custom host is set
          this.setApiKey("ollama", "");
        }
      } catch (error) {
        console.warn(
          `Failed to load ${providerType} configuration from localStorage:`,
          error,
        );
      }
    });
  }

  private validateApiKey(
    providerType: SupportedProvider,
    value: string,
  ): boolean {
    switch (providerType) {
      case "anthropic":
        return /^sk-ant-api03-[A-Za-z0-9_-]+$/.test(value) && value.length > 20;
      case "openai":
        // Basic validation - just check it starts with sk- and has reasonable length
        return value.startsWith("sk-") && value.length > 20;
      case "ollama":
        // Ollama doesn't require an API key, just check if it's a valid URL or empty
        if (!value) return true; // Empty is fine, will use default host
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  private createProvider(
    providerType: SupportedProvider,
    value: string,
  ): AIProvider | null {
    try {
      let config: ProviderConfig;

      if (providerType === "ollama") {
        config = {
          hostUrl: value || "http://127.0.0.1:11434",
          dangerouslyAllowBrowser: true,
        } as HostUrlProviderConfig;
      } else {
        config = {
          apiKey: value,
          dangerouslyAllowBrowser: true,
        } as ApiKeyProviderConfig;
      }

      return providerFactory.createProvider(providerType, config);
    } catch (error) {
      console.error(`Failed to create ${providerType} provider:`, error);
      return null;
    }
  }

  setApiKey(providerType: SupportedProvider, value: string): boolean {
    const isValid = this.validateApiKey(providerType, value);
    let provider: AIProvider | null = null;

    if (isValid) {
      provider = this.createProvider(providerType, value);

      // Save to localStorage if provider creation succeeded and there's an actual value
      if (provider && value) {
        try {
          const storageKey = this.storageKeys[providerType];
          localStorage.setItem(storageKey, value);
        } catch (error) {
          console.warn(
            `Failed to save ${providerType} configuration to localStorage:`,
            error,
          );
        }
      }
    } else if (!value) {
      // Clear from localStorage if empty value
      try {
        const storageKey = this.storageKeys[providerType];
        localStorage.removeItem(storageKey);
      } catch (error) {
        console.warn(
          `Failed to remove ${providerType} configuration from localStorage:`,
          error,
        );
      }
    }

    // Update provider info with appropriate fields
    const providerInfo: ProviderInfo = {
      provider,
      isValid: isValid && provider !== null,
      apiKey: providerType === "ollama" ? "" : value, // Keep apiKey empty for Ollama
      hostUrl: providerType === "ollama" ? value : undefined, // Set hostUrl for Ollama
    };

    this.providers.set(providerType, providerInfo);

    return isValid && provider !== null;
  }

  getProvider(providerType: SupportedProvider): AIProvider | null {
    return this.providers.get(providerType)?.provider || null;
  }

  isProviderReady(providerType: SupportedProvider): boolean {
    const info = this.providers.get(providerType);
    return (info?.isValid && info?.provider !== null) || false;
  }

  getApiKey(providerType: SupportedProvider): string {
    const info = this.providers.get(providerType);
    if (providerType === "ollama") {
      return info?.hostUrl || "";
    }
    return info?.apiKey || "";
  }

  // New method specifically for getting Ollama host URL
  getOllamaHostUrl(): string {
    return this.providers.get("ollama")?.hostUrl || "";
  }

  getAllProviderStatus(): Record<
    SupportedProvider,
    { isValid: boolean; hasApiKey: boolean }
  > {
    const status: Record<string, { isValid: boolean; hasApiKey: boolean }> = {};

    this.providers.forEach((info, providerType) => {
      const hasValue =
        providerType === "ollama"
          ? (info.hostUrl?.length || 0) > 0
          : (info.apiKey?.length || 0) > 0;

      status[providerType] = {
        isValid: info.isValid,
        hasApiKey: hasValue,
      };
    });

    return status as Record<
      SupportedProvider,
      { isValid: boolean; hasApiKey: boolean }
    >;
  }

  // Get the first available provider (for backward compatibility)
  getDefaultProvider(): AIProvider | null {
    // Try Anthropic first, then others
    const priority: SupportedProvider[] = ["anthropic", "openai", "ollama"];

    for (const providerType of priority) {
      const provider = this.getProvider(providerType);
      if (provider && this.isProviderReady(providerType)) {
        return provider;
      }
    }

    return null;
  }

  // Get the provider type for the default provider
  getDefaultProviderType(): SupportedProvider | null {
    const priority: SupportedProvider[] = ["anthropic", "openai", "ollama"];

    for (const providerType of priority) {
      if (this.isProviderReady(providerType)) {
        return providerType;
      }
    }

    return null;
  }

  clearApiKey(providerType: SupportedProvider): void {
    this.setApiKey(providerType, "");
  }

  clearAllApiKeys(): void {
    this.providers.forEach((_, providerType) => {
      this.clearApiKey(providerType);
    });
  }
}

// Export singleton instance
export const providerManager = new ProviderManager();
