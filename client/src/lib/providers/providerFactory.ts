import {
  AIProvider,
  ProviderConfig,
  SupportedProvider,
  ProviderFactory,
} from "./types";
import { AnthropicProvider } from "./anthropicProvider";
import { OpenAIProvider } from "./openaiProvider";
import { OllamaProvider } from "./ollamaProvider";

export class DefaultProviderFactory implements ProviderFactory {
  createProvider(type: SupportedProvider, config: ProviderConfig): AIProvider {
    switch (type) {
      case "anthropic":
        return new AnthropicProvider(config);
      case "openai":
        return new OpenAIProvider(config);
      case "ollama":
        return new OllamaProvider(config);
      default:
        throw new Error(`Unsupported provider type: ${type}`);
    }
  }
}

// Export singleton instance
export const providerFactory = new DefaultProviderFactory();
