import { AIProvider, ProviderConfig, SupportedProvider, ProviderFactory } from "./types";
import { AnthropicProvider } from "./anthropicProvider";

export class DefaultProviderFactory implements ProviderFactory {
  createProvider(type: SupportedProvider, config: ProviderConfig): AIProvider {
    switch (type) {
      case "anthropic":
        return new AnthropicProvider(config);
      case "openai":
        // TODO: Implement OpenAI provider
        throw new Error("OpenAI provider not yet implemented");
      case "deepseek":
        // TODO: Implement DeepSeek provider
        throw new Error("DeepSeek provider not yet implemented");
      default:
        throw new Error(`Unsupported provider type: ${type}`);
    }
  }
}

// Export singleton instance
export const providerFactory = new DefaultProviderFactory(); 