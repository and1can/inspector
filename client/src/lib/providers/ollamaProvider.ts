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

export class OllamaProvider extends AIProvider {
  private ollama: Ollama;

  constructor(config: ProviderConfig) {
    super(config);
    this.ollama = new Ollama({
      host: config.baseURL || "http://127.0.0.1:11434",
    });
  }

  updateApiKey(apiKey: string): void {
    // Ollama doesn't use API keys in the traditional sense
    // but we keep this for consistency with the interface
    this.config.apiKey = apiKey;
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

  getSupportedModels(): ProviderModel[] {
    return [
      {
        id: "llama3.1",
        name: "Llama 3.1",
        description: "Meta's Llama 3.1 model"
      },
      {
        id: "llama3.1:8b",
        name: "Llama 3.1 8B",
        description: "Llama 3.1 8 billion parameter model"
      },
      {
        id: "llama3.1:70b",
        name: "Llama 3.1 70B",
        description: "Llama 3.1 70 billion parameter model"
      },
      {
        id: "llama3.2",
        name: "Llama 3.2",
        description: "Meta's Llama 3.2 model"
      },
      {
        id: "llama3.2:3b",
        name: "Llama 3.2 3B",
        description: "Llama 3.2 3 billion parameter model"
      },
      {
        id: "qwen2.5",
        name: "Qwen 2.5",
        description: "Alibaba's Qwen 2.5 model"
      },
      {
        id: "mistral",
        name: "Mistral",
        description: "Mistral 7B model"
      },
      {
        id: "codellama",
        name: "Code Llama",
        description: "Code generation model based on Llama"
      },
      {
        id: "phi3",
        name: "Phi-3",
        description: "Microsoft's Phi-3 model"
      },
      {
        id: "gemma2",
        name: "Gemma 2",
        description: "Google's Gemma 2 model"
      }
    ];
  }

  async createMessage(options: ProviderCreateOptions): Promise<ProviderResponse> {
    const ollamaMessages = this.convertToOllamaMessages(options.messages);
    const ollamaTools = options.tools ? this.convertToOllamaTools(options.tools) : undefined;

    try {
      const response = await this.ollama.chat({
        model: options.model,
        messages: ollamaMessages,
        tools: ollamaTools,
        options: {
          num_predict: options.max_tokens,
        },
      }) as OllamaResponse;

      return this.convertFromOllamaResponse(response, options.model);
    } catch (error: unknown) {
      const ollamaError = error as { message?: string; name?: string };
      
      if (ollamaError?.message?.includes("connection")) {
        throw new Error(
          `Ollama Connection Error: Unable to connect to Ollama server. Please ensure Ollama is running and accessible at the configured host.`
        );
      } else if (ollamaError?.message?.includes("model")) {
        throw new Error(
          `Ollama Model Error: ${ollamaError?.message || 'Model not found. Please ensure the model is downloaded and available.'}`
        );
      } else if (ollamaError?.message?.includes("timeout")) {
        throw new Error(
          `Ollama Timeout Error: Request timed out. The model might be loading or the request is taking too long.`
        );
      }
      
      // Re-throw the original error if it's not a recognized Ollama error
      throw new Error(`Ollama Error: ${ollamaError?.message || 'An unknown error occurred'}`);
    }
  }

  private convertToOllamaMessages(messages: ProviderMessage[]): OllamaMessage[] {
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
        const textContent = message.content.find(item => item.type === "text");
        const toolCalls = message.content.filter(item => item.type === "tool_use");

        const ollamaMessage: OllamaMessage = {
          role: "assistant",
          content: textContent?.text || "",
        };

        if (toolCalls.length > 0) {
          ollamaMessage.tool_calls = toolCalls.map(toolCall => ({
            function: {
              name: toolCall.name || "",
              arguments: toolCall.input || {},
            },
          }));
        }

        result.push(ollamaMessage);
      } else {
        // Handle user messages with tool results
        const toolResults = message.content.filter(item => item.type === "tool_result");

        if (toolResults.length > 0) {
          // For tool results, we might need to format them differently for Ollama
          const textContent = message.content.find(item => item.type === "text");
          let content = textContent?.text || "";
          
          // Append tool results to the content
          for (const result_item of toolResults) {
            content += `\n\nTool Result (${result_item.tool_use_id}): ${result_item.content}`;
          }

          result.push({
            role: "user",
            content: content,
          });
        } else {
          // Regular user message
          const textContent = message.content.find(item => item.type === "text");
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
    return tools.map((tool): OllamaTool => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }));
  }

  private convertFromOllamaResponse(response: OllamaResponse, model: string): ProviderResponse {
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
      usage: response.usage ? {
        input_tokens: response.usage.prompt_tokens || 0,
        output_tokens: response.usage.completion_tokens || 0,
      } : undefined,
    };
  }
} 