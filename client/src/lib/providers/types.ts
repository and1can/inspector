// Common provider types and interfaces

export interface ProviderMessage {
  role: "user" | "assistant";
  content: string | ProviderMessageContent[];
}

export interface ProviderMessageContent {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
  is_error?: boolean;
}

export interface ProviderTool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

export interface ProviderCreateOptions {
  model: string;
  max_tokens: number;
  messages: ProviderMessage[];
  tools?: ProviderTool[];
}

export interface ProviderResponse {
  content: ProviderResponseContent[];
  model: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface ProviderResponseContent {
  type: "text" | "tool_use";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

// Base configuration interface
export interface BaseProviderConfig {
  timeout?: number;
  dangerouslyAllowBrowser?: boolean;
}

// API key based providers (Anthropic, OpenAI)
export interface ApiKeyProviderConfig extends BaseProviderConfig {
  apiKey: string;
}

// Host URL based providers (Ollama)
export interface HostUrlProviderConfig extends BaseProviderConfig {
  hostUrl: string;
}

// Union type for all provider configurations
export type ProviderConfig = ApiKeyProviderConfig | HostUrlProviderConfig;

// Type guard to check if config uses API key
export function isApiKeyConfig(
  config: ProviderConfig,
): config is ApiKeyProviderConfig {
  return "apiKey" in config;
}

// Type guard to check if config uses host URL
export function isHostUrlConfig(
  config: ProviderConfig,
): config is HostUrlProviderConfig {
  return "hostUrl" in config;
}

export interface ProviderModel {
  id: string;
  name: string;
  description: string;
}

export abstract class AIProvider {
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  abstract updateApiKey(apiKey: string): void;
  abstract createMessage(
    options: ProviderCreateOptions,
  ): Promise<ProviderResponse>;
  abstract validateConfig(): boolean;
  abstract getProviderName(): string;
  abstract getDefaultModel(): string;
  abstract getSupportedModels(): ProviderModel[];

  // Optional method for providers that can refresh their model list dynamically
  async refreshModels?(): Promise<ProviderModel[]>;
}

export type SupportedProvider = "anthropic" | "openai" | "ollama";

export interface ProviderFactory {
  createProvider(type: SupportedProvider, config: ProviderConfig): AIProvider;
}
