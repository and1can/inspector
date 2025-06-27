import readline from "readline/promises";
import { Tool as AnthropicTool } from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import { Tool as MCPTool } from "@modelcontextprotocol/sdk/types.js";
import { ClientLogLevels } from "../hooks/helpers/types";
import {
  AIProvider,
  providerManager,
  ProviderResponse,
  SupportedProvider,
} from "@/lib/providers";
import {
  MessageParam,
  ContentBlock,
  TextBlock,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages/messages.mjs";

export interface ChatLoopProvider {
  processQuery(
    query: string,
    tools: AnthropicTool[],
    onUpdate?: (content: string) => void,
    model?: string,
    provider?: string,
    signal?: AbortSignal,
  ): Promise<string>;
  addClientLog(message: string, level: ClientLogLevels): void;
}

export interface ToolCaller {
  callTool(params: { name: string; arguments?: { [x: string]: unknown } }): Promise<unknown>;
  addClientLog(message: string, level: ClientLogLevels): void;
}

export interface ToolCallApprover {
  requestToolCallApproval(name: string, input: unknown, id: string): Promise<boolean>;
}

// Helper function to recursively sanitize schema objects
const sanitizeSchema = (schema: unknown): unknown => {
  if (!schema || typeof schema !== "object") return schema;

  // Handle array
  if (Array.isArray(schema)) {
    return schema.map((item) => sanitizeSchema(item));
  }

  // Now we know it's an object
  const schemaObj = schema as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(schemaObj)) {
    if (
      key === "properties" &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      // Handle properties object
      const propertiesObj = value as Record<string, unknown>;
      const sanitizedProps: Record<string, unknown> = {};
      const keyMapping: Record<string, string> = {};

      for (const [propKey, propValue] of Object.entries(propertiesObj)) {
        const sanitizedKey = propKey.replace(/[^a-zA-Z0-9_-]/g, "_");
        keyMapping[propKey] = sanitizedKey;
        sanitizedProps[sanitizedKey] = sanitizeSchema(propValue);
      }

      sanitized[key] = sanitizedProps;

      // Update required fields if they exist
      if ("required" in schemaObj && Array.isArray(schemaObj.required)) {
        sanitized.required = (schemaObj.required as string[]).map(
          (req: string) => keyMapping[req] || req,
        );
      }
    } else {
      sanitized[key] = sanitizeSchema(value);
    }
  }

  return sanitized;
};

export const mappedTools = (tools: MCPTool[]): AnthropicTool[] => {
  return tools.map((tool: MCPTool) => {
    // Deep copy and sanitize the schema
    let inputSchema;
    if (tool.inputSchema) {
      inputSchema = JSON.parse(JSON.stringify(tool.inputSchema));
    } else {
      // If no input schema, create a basic object schema
      inputSchema = {
        type: "object",
        properties: {},
        required: [],
      };
    }

    // Ensure the schema has a type field
    if (!inputSchema.type) {
      inputSchema.type = "object";
    }

    // Ensure properties exists for object types
    if (inputSchema.type === "object" && !inputSchema.properties) {
      inputSchema.properties = {};
    }

    const sanitizedSchema = sanitizeSchema(inputSchema);

    return {
      name: tool.name,
      description: tool.description,
      input_schema: sanitizedSchema,
    } as AnthropicTool;
  });
};

export class QueryProcessor {
  private toolCaller: ToolCaller;
  private toolCallApprover?: ToolCallApprover;

  constructor(toolCaller: ToolCaller, toolCallApprover?: ToolCallApprover) {
    this.toolCaller = toolCaller;
    this.toolCallApprover = toolCallApprover;
  }

  async processQuery(
    query: string,
    tools: AnthropicTool[],
    onUpdate?: (content: string) => void,
    model: string = "claude-3-5-sonnet-latest",
    provider?: SupportedProvider,
    signal?: AbortSignal,
  ): Promise<string> {
    // Get the specified provider or fall back to default
    const aiProvider = provider
      ? providerManager.getProvider(provider)
      : providerManager.getDefaultProvider();

    if (!aiProvider) {
      const providerName = provider || "default";
      throw new Error(
        `No ${providerName} provider available. Please check your API key configuration.`,
      );
    }

    if (signal?.aborted) {
      throw new Error("Chat was cancelled");
    }

    this.toolCaller.addClientLog(
      `Processing query with ${tools.length} tools using model ${model}`,
      "info",
    );
    const context = this.initializeQueryContext(query, tools, model);
    const response = await this.makeInitialApiCall(context, aiProvider, signal);

    return this.processIterations(
      response,
      context,
      aiProvider,
      onUpdate,
      signal,
    );
  }

  private initializeQueryContext(query: string, tools: AnthropicTool[], model: string) {
    this.toolCaller.addClientLog(
      `Initializing query context with ${tools.length} tools`,
      "debug",
    );
    return {
      messages: [{ role: "user" as const, content: query }] as MessageParam[],
      finalText: [] as string[],
      sanitizedTools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.input_schema,
      })),
      model,
      MAX_ITERATIONS: 50,
    };
  }

  private async makeInitialApiCall(
    context: ReturnType<typeof this.initializeQueryContext>,
    aiProvider: AIProvider,
    signal?: AbortSignal,
  ): Promise<ProviderResponse> {
    // Check if aborted before making API call
    if (signal?.aborted) {
      throw new Error("Chat was cancelled");
    }

    this.toolCaller.addClientLog("Making initial API call to AI provider", "debug");
    const response = await aiProvider.createMessage({
      model: context.model,
      max_tokens: 1000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: context.messages as any,
      tools: context.sanitizedTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.input_schema,
      })),
    });

    // Check if aborted after API call
    if (signal?.aborted) {
      throw new Error("Chat was cancelled");
    }

    // Convert provider response back to Anthropic Message format
    // This is a temporary adapter - for now we'll assume Anthropic format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return response;
  }

  private async processIterations(
    initialResponse: ProviderResponse,
    context: ReturnType<typeof this.initializeQueryContext>,
    aiProvider: AIProvider,
    onUpdate?: (content: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    let response = initialResponse;
    let iteration = 0;

    while (iteration < context.MAX_ITERATIONS) {
      // Check if aborted at the start of each iteration
      if (signal?.aborted) {
        throw new Error("Chat was cancelled");
      }

      iteration++;
      this.toolCaller.addClientLog(
        `Processing iteration ${iteration}/${context.MAX_ITERATIONS}`,
        "debug",
      );

      const iterationResult = await this.processIteration(
        response,
        context,
        signal,
      );

      this.sendIterationUpdate(iterationResult.content, onUpdate);

      if (!iterationResult.hasToolUse) {
        this.toolCaller.addClientLog("No tool use detected, ending iterations", "debug");
        break;
      }

      try {
        response = await this.makeFollowUpApiCall(context, aiProvider, signal);
      } catch (error) {
        const errorMessage = `[API Error: ${error}]`;
        this.toolCaller.addClientLog(
          `API error in iteration ${iteration}: ${error}`,
          "error",
        );
        context.finalText.push(errorMessage);
        this.sendIterationUpdate(errorMessage, onUpdate);
        break;
      }
    }

    this.handleMaxIterationsWarning(iteration, context, onUpdate);
    this.toolCaller.addClientLog(
      `Query processing completed in ${iteration} iterations`,
      "info",
    );
    return context.finalText.join("\n");
  }

  private async processIteration(
    response: ProviderResponse,
    context: ReturnType<typeof this.initializeQueryContext>,
    signal?: AbortSignal,
  ) {
    const iterationContent: string[] = [];
    const assistantContent: ContentBlock[] = [];
    let hasToolUse = false;

    for (const content of response.content as ContentBlock[]) {
      // Check if aborted during content processing
      if (signal?.aborted) {
        throw new Error("Chat was cancelled");
      }

      if (content.type === "text") {
        this.handleTextContent(
          content,
          iterationContent,
          context.finalText,
          assistantContent,
        );
      } else if (content.type === "tool_use") {
        hasToolUse = true;
        this.toolCaller.addClientLog(`Tool use detected: ${content.name}`, "debug");
        await this.handleToolUse(
          content,
          iterationContent,
          context,
          assistantContent,
          signal,
        );
      }
    }

    return {
      content: iterationContent,
      hasToolUse,
    };
  }

  private handleTextContent(
    content: TextBlock,
    iterationContent: string[],
    finalText: string[],
    assistantContent: ContentBlock[],
  ) {
    iterationContent.push(content.text);
    finalText.push(content.text);
    assistantContent.push(content);
  }

  private async handleToolUse(
    content: ToolUseBlock,
    iterationContent: string[],
    context: ReturnType<typeof this.initializeQueryContext>,
    assistantContent: ContentBlock[],
    signal?: AbortSignal,
  ) {
    assistantContent.push(content);

    const toolMessage = this.createToolMessage(content.name, content.input);
    iterationContent.push(toolMessage);
    context.finalText.push(toolMessage);

    try {
      // Request approval before executing the tool
      let approved = true;
      if (this.toolCallApprover) {
        this.toolCaller.addClientLog(`Requesting approval for tool: ${content.name}`, "debug");
        approved = await this.toolCallApprover.requestToolCallApproval(
          content.name, 
          content.input, 
          content.id
        );
      }

      if (approved) {
        this.toolCaller.addClientLog(`Executing tool: ${content.name}`, "debug");
        const toolResultMessage = await this.executeToolAndUpdateMessages(
          content,
          context,
          assistantContent,
          signal,
        );
        // Add the tool result to iteration content for real-time display
        if (toolResultMessage) {
          iterationContent.push(toolResultMessage);
        }
        this.toolCaller.addClientLog(`Tool execution successful: ${content.name}`, "debug");
      } else {
        // Tool execution was rejected
        this.toolCaller.addClientLog(`Tool execution rejected by user: ${content.name}`, "info");
        const rejectMessage = `[Tool ${content.name} execution was rejected by user]`;
        iterationContent.push(rejectMessage);
        context.finalText.push(rejectMessage);
        
        // Add rejection message as tool result
        this.addMessagesToContext(
          context,
          assistantContent,
          content.id,
          "Tool execution was rejected by user",
          true
        );
      }
    } catch (error) {
      this.toolCaller.addClientLog(
        `Tool execution failed: ${content.name} - ${error}`,
        "error",
      );
      this.handleToolError(
        error,
        content,
        iterationContent,
        context,
        assistantContent,
      );
    }
  }

  private createToolMessage(toolName: string, toolArgs: unknown): string {
    return `[Calling tool ${toolName} with args ${JSON.stringify(toolArgs)}]`;
  }

  private async executeToolAndUpdateMessages(
    content: ToolUseBlock,
    context: ReturnType<typeof this.initializeQueryContext>,
    assistantContent: ContentBlock[],
    signal?: AbortSignal,
  ): Promise<string> {
    // Check if aborted before tool execution
    if (signal?.aborted) {
      throw new Error("Chat was cancelled");
    }

    const result = await this.toolCaller.callTool({
      name: content.name,
      arguments: content.input as { [x: string]: unknown } | undefined,
    });

    // Check if aborted after tool execution
    if (signal?.aborted) {
      throw new Error("Chat was cancelled");
    }

    // Extract content from MCP result structure
    let resultContent: string;
    if (result && typeof result === 'object' && 'content' in result) {
      // Handle MCP SDK CompatibilityCallToolResult format
      const mcpResult = result as { content: Array<{ type: string; text?: string }> };
      if (Array.isArray(mcpResult.content) && mcpResult.content.length > 0) {
        // Extract text from content array
        const textItems = mcpResult.content
          .filter(item => item.type === 'text' && item.text)
          .map(item => item.text)
          .join('\n');
        resultContent = textItems || JSON.stringify(result);
      } else {
        resultContent = JSON.stringify(result);
      }
    } else {
      // Handle direct string result or other formats
      resultContent = typeof result === 'string' ? result : JSON.stringify(result);
    }

    // Add tool result to the displayed text (for user to see)
    const toolResultMessage = `[Tool ${content.name} result: ${resultContent}]`;
    context.finalText.push(toolResultMessage);

    this.addMessagesToContext(
      context,
      assistantContent,
      content.id,
      resultContent,
    );

    return toolResultMessage;
  }

  private handleToolError(
    error: unknown,
    content: ToolUseBlock,
    iterationContent: string[],
    context: ReturnType<typeof this.initializeQueryContext>,
    assistantContent: ContentBlock[],
  ) {
    console.error(`Tool ${content.name} failed:`, error);
    const errorMessage = `[Tool ${content.name} failed: ${error}]`;
    iterationContent.push(errorMessage);
    context.finalText.push(errorMessage);

    this.addMessagesToContext(
      context,
      assistantContent,
      content.id,
      `Error: ${error}`,
      true,
    );
  }

  private addMessagesToContext(
    context: ReturnType<typeof this.initializeQueryContext>,
    assistantContent: ContentBlock[],
    toolUseId: string,
    resultContent: string,
    isError = false,
  ) {
    if (assistantContent.length > 0) {
      context.messages.push({
        role: "assistant",
        content: assistantContent,
      });
    }

    context.messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: toolUseId,
          content: resultContent,
          ...(isError && { is_error: true }),
        },
      ],
    });
  }

  private async makeFollowUpApiCall(
    context: ReturnType<typeof this.initializeQueryContext>,
    aiProvider: AIProvider,
    signal?: AbortSignal,
  ): Promise<ProviderResponse> {
    // Check if aborted before making API call
    if (signal?.aborted) {
      throw new Error("Chat was cancelled");
    }
    this.toolCaller.addClientLog("Making follow-up API call to AI provider", "debug");
    const response = await aiProvider.createMessage({
      model: context.model,
      max_tokens: 1000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: context.messages as any,
      tools: context.sanitizedTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.input_schema,
      })),
    });

    // Check if aborted after API call
    if (signal?.aborted) {
      throw new Error("Chat was cancelled");
    }

    return response;
  }

  private sendIterationUpdate(
    content: string | string[],
    onUpdate?: (content: string) => void,
  ) {
    if (!onUpdate) return;

    const message = Array.isArray(content) ? content.join("\n") : content;
    if (message.length > 0) {
      onUpdate(message);
    }
  }

  private handleMaxIterationsWarning(
    iteration: number,
    context: ReturnType<typeof this.initializeQueryContext>,
    onUpdate?: (content: string) => void,
  ) {
    if (iteration >= context.MAX_ITERATIONS) {
      const warningMessage = `[Warning: Reached maximum iterations (${context.MAX_ITERATIONS}). Stopping to prevent excessive API usage.]`;
      this.toolCaller.addClientLog(
        `Maximum iterations reached (${context.MAX_ITERATIONS})`,
        "warn",
      );
      context.finalText.push(warningMessage);
      this.sendIterationUpdate(warningMessage, onUpdate);
    }
  }
}


export class ChatLoop {
  private provider: ChatLoopProvider;

  constructor(provider: ChatLoopProvider) {
    this.provider = provider;
  }

  async start(tools: AnthropicTool[]) {
    this.provider.addClientLog("Starting interactive chat loop", "info");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      while (true) {
        const message = await rl.question("\nQuery: ");
        if (message.toLowerCase() === "quit") {
          this.provider.addClientLog("Chat loop terminated by user", "info");
          break;
        }
        this.provider.addClientLog(
          `Processing user query: ${message.substring(0, 50)}${message.length > 50 ? "..." : ""}`,
          "debug",
        );
        const response = await this.provider.processQuery(message, tools);
        console.log("\n" + response);
      }
    } finally {
      rl.close();
      this.provider.addClientLog("Chat loop interface closed", "debug");
    }
  }
} 