import { Ollama } from "ollama/browser";
import {
  AIProvider,
  ProviderConfig,
  ProviderCreateOptions,
  ProviderResponse,
  ProviderMessage,
  ProviderTool,
  ProviderResponseContent,
  ProviderModel,
  isHostUrlConfig,
} from "./types";

// Ollama-specific types
interface OllamaMessage {
  role: string;
  content: string;
  tool_calls?: OllamaToolCall[];
}

interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

interface OllamaTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

interface OllamaResponse {
  message: {
    content: string;
    tool_calls?: OllamaToolCall[];
  };
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

// Add interface for Ollama tags/models response
interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    parent_model?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

export class OllamaProvider extends AIProvider {
  private ollama: Ollama;
  private cachedModels: ProviderModel[] | null = null;
  private lastFetchTime: number = 0;
  private readonly cacheTimeout = 30000; // 30 seconds cache

  constructor(config: ProviderConfig) {
    super(config);

    if (!isHostUrlConfig(config)) {
      throw new Error("OllamaProvider requires a HostUrlProviderConfig");
    }

    this.ollama = new Ollama({
      host: config.hostUrl || "http://127.0.0.1:11434",
    });
  }

  updateApiKey(hostUrl: string): void {
    // For Ollama, this updates the host URL
    if (isHostUrlConfig(this.config)) {
      this.config.hostUrl = hostUrl;
      // Recreate the Ollama instance with the new host
      this.ollama = new Ollama({
        host: hostUrl || "http://127.0.0.1:11434",
      });
    }
    // Clear cache when config changes
    this.cachedModels = null;
  }

  validateConfig(): boolean {
    // For Ollama, we don't require an API key since it runs locally
    // We could potentially ping the host to check connectivity
    return true;
  }

  getProviderName(): string {
    return "ollama";
  }

  getDefaultModel(): string {
    return "llama3.1";
  }

  // New method to fetch locally available models
  private async fetchLocalModels(): Promise<ProviderModel[]> {
    try {
      const host = isHostUrlConfig(this.config)
        ? this.config.hostUrl || "http://127.0.0.1:11434"
        : "http://127.0.0.1:11434";

      const response = await fetch(`${host}/api/tags`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Ollama server not found. Please ensure Ollama is running.");
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: OllamaTagsResponse = await response.json();

      // Return empty array if no models, don't fall back to static models
      if (!data.models || data.models.length === 0) {
        return [];
      }

      return data.models.map((model: OllamaModel): ProviderModel => {
        // Extract model name and format it nicely
        const modelName = model.name;
        const displayName = this.formatModelDisplayName(modelName);
        const description = this.generateModelDescription(model);

        return {
          id: modelName,
          name: displayName,
          description: description,
        };
      });
    } catch (error) {
      console.warn("Failed to fetch local Ollama models:", error);
      // Return empty array instead of static models
      return [];
    }
  }

  // Helper method to format model names for display
  private formatModelDisplayName(modelName: string): string {
    // Remove common suffixes and format the name nicely
    const cleanName = modelName
      .replace(/:latest$/, "")
      .replace(/[-_]/g, " ")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    return cleanName;
  }

  // Helper method to generate model descriptions
  private generateModelDescription(model: OllamaModel): string {
    const sizeGB = (model.size / (1024 * 1024 * 1024)).toFixed(1);

    let description = `Size: ${sizeGB}GB`;

    if (model.details?.parameter_size) {
      description += ` • ${model.details.parameter_size}`;
    }

    if (model.details?.family) {
      description += ` • ${model.details.family}`;
    }

    if (model.details?.quantization_level) {
      description += ` • ${model.details.quantization_level}`;
    }

    return description;
  }

  // Fallback static models (kept as backup)
  private getStaticModels(): ProviderModel[] {
    return [
      {
        id: "llama3.1",
        name: "Llama 3.1",
        description: "Meta's Llama 3.1 model (if available locally)",
      },
      {
        id: "llama3.1:8b",
        name: "Llama 3.1 8B",
        description:
          "Llama 3.1 8 billion parameter model (if available locally)",
      },
      {
        id: "llama3.1:70b",
        name: "Llama 3.1 70B",
        description:
          "Llama 3.1 70 billion parameter model (if available locally)",
      },
      {
        id: "llama3.2",
        name: "Llama 3.2",
        description: "Meta's Llama 3.2 model (if available locally)",
      },
      {
        id: "llama3.2:3b",
        name: "Llama 3.2 3B",
        description:
          "Llama 3.2 3 billion parameter model (if available locally)",
      },
      {
        id: "qwen2.5",
        name: "Qwen 2.5",
        description: "Alibaba's Qwen 2.5 model (if available locally)",
      },
      {
        id: "mistral",
        name: "Mistral",
        description: "Mistral 7B model (if available locally)",
      },
      {
        id: "codellama",
        name: "Code Llama",
        description:
          "Code generation model based on Llama (if available locally)",
      },
      {
        id: "phi3",
        name: "Phi-3",
        description: "Microsoft's Phi-3 model (if available locally)",
      },
      {
        id: "gemma2",
        name: "Gemma 2",
        description: "Google's Gemma 2 model (if available locally)",
      },
    ];
  }

  getSupportedModels(): ProviderModel[] {
    // Return cached models if still valid
    const now = Date.now();
    if (this.cachedModels && now - this.lastFetchTime < this.cacheTimeout) {
      return this.cachedModels;
    }

    // If no cache, trigger async fetch and return empty array initially
    if (!this.cachedModels) {
      // Trigger async fetch in background
      this.fetchLocalModels()
        .then((models) => {
          this.cachedModels = models;
          this.lastFetchTime = Date.now();
        })
        .catch((error) => {
          console.warn("Background model fetch failed:", error);
          this.cachedModels = []; // Set empty array on error
          this.lastFetchTime = Date.now();
        });

      // Return empty array while fetching
      return [];
    }

    return this.cachedModels;
  }

  // New public method to refresh the model cache
  async refreshModels(): Promise<ProviderModel[]> {
    this.cachedModels = null;
    this.lastFetchTime = 0;

    const models = await this.fetchLocalModels();
    this.cachedModels = models;
    this.lastFetchTime = Date.now();

    return models;
  }

  async createMessage(
    options: ProviderCreateOptions,
  ): Promise<ProviderResponse> {
    const ollamaMessages = this.convertToOllamaMessages(options.messages);
    const ollamaTools = options.tools
      ? this.convertToOllamaTools(options.tools)
      : undefined;

    try {
      const response = (await this.ollama.chat({
        model: options.model,
        messages: ollamaMessages,
        tools: ollamaTools,
        options: {
          num_predict: options.max_tokens,
        },
      })) as OllamaResponse;

      return this.convertFromOllamaResponse(response, options.model);
    } catch (error: unknown) {
      const ollamaError = error as { message?: string; name?: string };

      if (ollamaError?.message?.includes("connection")) {
        throw new Error(
          `Ollama Connection Error: Unable to connect to Ollama server. Please ensure Ollama is running and accessible at the configured host.`,
        );
      } else if (ollamaError?.message?.includes("model")) {
        throw new Error(
          `Ollama Model Error: ${ollamaError?.message || "Model not found. Please ensure the model is downloaded and available."}`,
        );
      } else if (ollamaError?.message?.includes("timeout")) {
        throw new Error(
          `Ollama Timeout Error: Request timed out. The model might be loading or the request is taking too long.`,
        );
      }

      // Re-throw the original error if it's not a recognized Ollama error
      throw new Error(
        `Ollama Error: ${ollamaError?.message || "An unknown error occurred"}`,
      );
    }
  }

  private convertToOllamaMessages(
    messages: ProviderMessage[],
  ): OllamaMessage[] {
    const result: OllamaMessage[] = [];

    for (const message of messages) {
      if (typeof message.content === "string") {
        result.push({
          role: message.role,
          content: message.content,
        });
        continue;
      }

      // Handle complex content with tool calls/results
      if (message.role === "assistant") {
        const textContent = message.content.find(
          (item) => item.type === "text",
        );
        const toolCalls = message.content.filter(
          (item) => item.type === "tool_use",
        );

        const ollamaMessage: OllamaMessage = {
          role: "assistant",
          content: textContent?.text || "",
        };

        if (toolCalls.length > 0) {
          ollamaMessage.tool_calls = toolCalls.map((toolCall) => ({
            function: {
              name: toolCall.name || "",
              arguments: toolCall.input || {},
            },
          }));
        }

        result.push(ollamaMessage);
      } else {
        // Handle user messages with tool results
        const toolResults = message.content.filter(
          (item) => item.type === "tool_result",
        );

        if (toolResults.length > 0) {
          // Ollama expects tool results as separate messages with role "tool"
          // This matches the working example format
          for (const result_item of toolResults) {
            let content = result_item.content || "";

            // Handle case where content is an array of content blocks
            if (Array.isArray(content)) {
              // Extract text from content blocks
              const textBlocks = content.filter(
                (block) => block.type === "text",
              );
              content = textBlocks.map((block) => block.text || "").join("\n");
            }

            result.push({
              role: "tool",
              content: content,
            });
          }

          // If there's also text content, add it as a user message
          const textContent = message.content.find(
            (item) => item.type === "text",
          );
          if (textContent && textContent.text) {
            result.push({
              role: "user",
              content: textContent.text,
            });
          }
        } else {
          // Regular user message
          const textContent = message.content.find(
            (item) => item.type === "text",
          );
          result.push({
            role: "user",
            content: textContent?.text || "",
          });
        }
      }
    }

    return result;
  }

  private convertToOllamaTools(tools: ProviderTool[]): OllamaTool[] {
    return tools.map(
      (tool): OllamaTool => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema,
        },
      }),
    );
  }

  private convertFromOllamaResponse(
    response: OllamaResponse,
    model: string,
  ): ProviderResponse {
    const content: ProviderResponseContent[] = [];

    // Add text content if present
    if (response.message?.content) {
      content.push({
        type: "text",
        text: response.message.content,
      });
    }

    // Add tool calls if present
    if (response.message?.tool_calls) {
      response.message.tool_calls.forEach((toolCall: OllamaToolCall) => {
        if (toolCall.function) {
          content.push({
            type: "tool_use",
            id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Generate a unique ID
            name: toolCall.function.name,
            input: toolCall.function.arguments || {},
          });
        }
      });
    }

    return {
      content,
      model: model,
      usage: response.usage
        ? {
            input_tokens: response.usage.prompt_tokens || 0,
            output_tokens: response.usage.completion_tokens || 0,
          }
        : undefined,
    };
  }
}
