import { Anthropic } from "@anthropic-ai/sdk";
import {
  MessageParam,
  Tool,
  Message,
  ContentBlock,
  TextBlock,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import {
  AIProvider,
  ProviderConfig,
  ProviderCreateOptions,
  ProviderResponse,
  ProviderMessage,
  ProviderTool,
  ProviderResponseContent,
} from "./types";

export class AnthropicProvider extends AIProvider {
  private anthropic: Anthropic;

  constructor(config: ProviderConfig) {
    super(config);
    this.anthropic = new Anthropic({
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: config.dangerouslyAllowBrowser ?? true,
    });
  }

  updateApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    this.anthropic = new Anthropic({
      apiKey: apiKey,
      dangerouslyAllowBrowser: this.config.dangerouslyAllowBrowser ?? true,
    });
  }

  validateConfig(): boolean {
    return Boolean(this.config.apiKey && this.config.apiKey.length > 0);
  }

  getProviderName(): string {
    return "anthropic";
  }

  getDefaultModel(): string {
    return "claude-3-5-sonnet-latest";
  }

  getSupportedModels(): string[] {
    return [
      "claude-3-5-sonnet-latest",
      "claude-3-5-sonnet-20241022",
      "claude-3-5-haiku-latest",
      "claude-3-5-haiku-20241022",
      "claude-3-opus-latest",
      "claude-3-opus-20240229",
      "claude-3-sonnet-20240229",
      "claude-3-haiku-20240307",
    ];
  }

  async createMessage(options: ProviderCreateOptions): Promise<ProviderResponse> {
    const anthropicMessages = this.convertToAnthropicMessages(options.messages);
    const anthropicTools = options.tools ? this.convertToAnthropicTools(options.tools) : undefined;

    const response = await this.anthropic.messages.create({
      model: options.model,
      max_tokens: options.max_tokens,
      messages: anthropicMessages,
      tools: anthropicTools,
    });

    return this.convertFromAnthropicResponse(response);
  }

  private convertToAnthropicMessages(messages: ProviderMessage[]): MessageParam[] {
    return messages.map((message): MessageParam => {
      if (typeof message.content === "string") {
        return {
          role: message.role,
          content: message.content,
        };
      }

      const content = message.content.map((item) => {
        switch (item.type) {
          case "text":
            return {
              type: "text",
              text: item.text || "",
            } as TextBlock;
          case "tool_use":
            return {
              type: "tool_use",
              id: item.id || "",
              name: item.name || "",
              input: item.input || {},
            } as ToolUseBlock;
          case "tool_result":
            return {
              type: "tool_result" as const,
              tool_use_id: item.tool_use_id || "",
              content: item.content || "",
              ...(item.is_error && { is_error: true }),
            };
          default:
            throw new Error(`Unsupported content type`);
        }
      });

      return {
        role: message.role,
        content: content,
      };
    });
  }

  private convertToAnthropicTools(tools: ProviderTool[]): Tool[] {
    return tools.map((tool): Tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: "object",
        ...tool.input_schema,
      },
    }));
  }

  private convertFromAnthropicResponse(response: Message): ProviderResponse {
    const content: ProviderResponseContent[] = response.content.map((item: ContentBlock) => {
      if (item.type === "text") {
        return {
          type: "text",
          text: item.text,
        };
      } else if (item.type === "tool_use") {
        return {
          type: "tool_use",
          id: item.id,
          name: item.name,
          input: item.input as Record<string, unknown>,
        };
      }
      throw new Error(`Unsupported response content type`);
    });

    return {
      content,
      model: response.model,
      usage: response.usage ? {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      } : undefined,
    };
  }
} 