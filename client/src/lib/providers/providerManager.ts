import { AIProvider, SupportedProvider, ProviderConfig } from "./types";
import { providerFactory } from "./providerFactory";

export interface StoredProviderConfig {
  apiKey: string;
  isValid: boolean;
  provider: SupportedProvider;
}

export class ProviderManager {
  private static instance: ProviderManager;
  private providers: Map<SupportedProvider, AIProvider> = new Map();
  private providerConfigs: Map<SupportedProvider, StoredProviderConfig> = new Map();
  private defaultProvider: SupportedProvider = "anthropic";

  private constructor() {
    // Load stored configurations on initialization
    this.loadStoredConfigurations();
  }

  static getInstance(): ProviderManager {
    if (!ProviderManager.instance) {
      ProviderManager.instance = new ProviderManager();
    }
    return ProviderManager.instance;
  }

  /**
   * Load stored API keys from localStorage
   */
  private loadStoredConfigurations(): void {
    const providerStorageKeys: Record<SupportedProvider, string> = {
      anthropic: "claude-api-key",
      openai: "openai-api-key",
      deepseek: "deepseek-api-key",
    };

    Object.entries(providerStorageKeys).forEach(([provider, storageKey]) => {
      try {
        const storedApiKey = localStorage.getItem(storageKey) || "";
        if (storedApiKey) {
          this.updateProvider(provider as SupportedProvider, storedApiKey);
        }
      } catch (error) {
        console.warn(`Failed to load ${provider} API key from localStorage:`, error);
      }
    });
  }

  /**
   * Update a provider with a new API key
   */
  updateProvider(providerType: SupportedProvider, apiKey: string): boolean {
    try {
      // Validate API key format based on provider
      const isValid = this.validateApiKey(providerType, apiKey);
      
      if (isValid && apiKey.trim() !== "") {
        // Create or update the provider
        const provider = providerFactory.createProvider(providerType, {
          apiKey,
          dangerouslyAllowBrowser: true,
        });

        this.providers.set(providerType, provider);
        this.providerConfigs.set(providerType, {
          apiKey,
          isValid: true,
          provider: providerType,
        });

        // Save to localStorage
        this.saveToStorage(providerType, apiKey);
        return true;
      } else {
        // Remove invalid provider
        this.removeProvider(providerType);
        return false;
      }
    } catch (error) {
      console.error(`Failed to update ${providerType} provider:`, error);
      this.removeProvider(providerType);
      return false;
    }
  }

  /**
   * Remove a provider
   */
  removeProvider(providerType: SupportedProvider): void {
    this.providers.delete(providerType);
    this.providerConfigs.delete(providerType);
    
    // Remove from localStorage
    const storageKey = this.getStorageKey(providerType);
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn(`Failed to remove ${providerType} API key from localStorage:`, error);
    }
  }

  /**
   * Get a specific provider
   */
  getProvider(providerType: SupportedProvider): AIProvider | null {
    return this.providers.get(providerType) || null;
  }

  /**
   * Get the default provider (first available or anthropic)
   */
  getDefaultProvider(): AIProvider | null {
    // Try to get the set default provider first
    const defaultProvider = this.providers.get(this.defaultProvider);
    if (defaultProvider) {
      return defaultProvider;
    }

    // Fallback to first available provider
    for (const provider of this.providers.values()) {
      return provider;
    }

    return null;
  }

  /**
   * Set the default provider type
   */
  setDefaultProvider(providerType: SupportedProvider): void {
    if (this.providers.has(providerType)) {
      this.defaultProvider = providerType;
    }
  }

  /**
   * Get all available providers
   */
  getAvailableProviders(): SupportedProvider[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if any provider is available
   */
  hasAnyProvider(): boolean {
    return this.providers.size > 0;
  }

  /**
   * Get provider configuration
   */
  getProviderConfig(providerType: SupportedProvider): StoredProviderConfig | null {
    return this.providerConfigs.get(providerType) || null;
  }

  /**
   * Get all provider configurations
   */
  getAllProviderConfigs(): Record<SupportedProvider, StoredProviderConfig | null> {
    return {
      anthropic: this.getProviderConfig("anthropic"),
      openai: this.getProviderConfig("openai"),
      deepseek: this.getProviderConfig("deepseek"),
    };
  }

  /**
   * Validate API key format for specific provider
   */
  private validateApiKey(providerType: SupportedProvider, apiKey: string): boolean {
    if (!apiKey || apiKey.trim() === "") {
      return false;
    }

    switch (providerType) {
      case "anthropic":
        return /^sk-ant-api03-[A-Za-z0-9_-]+$/.test(apiKey) && apiKey.length > 20;
      case "openai":
        return /^sk-[A-Za-z0-9_-]+$/.test(apiKey) && apiKey.length > 20;
      case "deepseek":
        // Add DeepSeek validation when implemented
        return apiKey.length > 10;
      default:
        return false;
    }
  }

  /**
   * Get storage key for provider
   */
  private getStorageKey(providerType: SupportedProvider): string {
    const storageKeys: Record<SupportedProvider, string> = {
      anthropic: "claude-api-key",
      openai: "openai-api-key",
      deepseek: "deepseek-api-key",
    };
    return storageKeys[providerType];
  }

  /**
   * Save API key to localStorage
   */
  private saveToStorage(providerType: SupportedProvider, apiKey: string): void {
    const storageKey = this.getStorageKey(providerType);
    try {
      localStorage.setItem(storageKey, apiKey);
    } catch (error) {
      console.warn(`Failed to save ${providerType} API key to localStorage:`, error);
    }
  }

  /**
   * Clear all providers and their stored keys
   */
  clearAll(): void {
    const providerTypes = Array.from(this.providers.keys());
    providerTypes.forEach(providerType => {
      this.removeProvider(providerType);
    });
  }
}

// Export singleton instance
export const providerManager = ProviderManager.getInstance();