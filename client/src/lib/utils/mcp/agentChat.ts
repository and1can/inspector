import { Tool as AnthropicTool } from "@anthropic-ai/sdk/resources/messages/messages.mjs";
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
import { MCPJamAgent } from "@/lib/utils/mcp/mcpjamAgent";

/**
 * Interface for objects that can approve tool calls
 */
export interface ToolCallApprover {
  requestToolCallApproval(
    name: string,
    input: unknown,
    id: string,
  ): Promise<boolean>;
}

/**
 * Initialize context for a query
 * @param query The query text
 * @param tools Tools available for the AI to use
 * @param model Model identifier
 * @returns Query context object
 */
export function initializeQueryContext(
  query: string,
  tools: AnthropicTool[],
  model: string,
  agent: MCPJamAgent,
) {
  agent.addClientLog(
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

/**
 * Make initial API call to the AI provider
 * @param context The query context
 * @param aiProvider The AI provider to use
 * @param signal Optional abort signal
 * @returns Provider response
 */
export async function makeInitialApiCall(
  context: ReturnType<typeof initializeQueryContext>,
  aiProvider: AIProvider,
  agent: MCPJamAgent,
  signal?: AbortSignal,
): Promise<ProviderResponse> {
  // Check if aborted before making API call
  if (signal?.aborted) {
    throw new Error("Chat was cancelled");
  }

  agent.addClientLog("Making initial API call to AI provider", "debug");
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

  // Return provider response
  return response;
}

/**
 * Process iterations of a chat conversation
 * @param initialResponse Initial response from the AI
 * @param context The query context
 * @param aiProvider The AI provider to use
 * @param agent The tool executor
 * @param toolCallApprover Optional tool call approver
 * @param onUpdate Optional callback for streaming updates
 * @param signal Optional abort signal
 * @returns Final processed text
 */
export async function processIterations(
  initialResponse: ProviderResponse,
  context: ReturnType<typeof initializeQueryContext>,
  aiProvider: AIProvider,
  agent: MCPJamAgent,
  toolCallApprover?: ToolCallApprover,
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
    agent.addClientLog(
      `Processing iteration ${iteration}/${context.MAX_ITERATIONS}`,
      "debug",
    );

    const iterationResult = await processIteration(
      response,
      context,
      agent,
      toolCallApprover,
      signal,
    );

    sendIterationUpdate(iterationResult.content, onUpdate);

    if (!iterationResult.hasToolUse) {
      agent.addClientLog("No tool use detected, ending iterations", "debug");
      break;
    }

    try {
      response = await makeFollowUpApiCall(context, aiProvider, agent, signal);
    } catch (error) {
      const errorMessage = `[API Error: ${error}]`;
      agent.addClientLog(
        `API error in iteration ${iteration}: ${error}`,
        "error",
      );
      context.finalText.push(errorMessage);
      sendIterationUpdate(errorMessage, onUpdate);
      break;
    }
  }

  handleMaxIterationsWarning(iteration, context, agent, onUpdate);
  agent.addClientLog(
    `Query processing completed in ${iteration} iterations`,
    "info",
  );
  return context.finalText.join("\n");
}

/**
 * Process a single iteration of chat
 * @param response The current response
 * @param context The query context
 * @param agent The tool executor
 * @param toolCallApprover Optional tool call approver
 * @param signal Optional abort signal
 * @returns Iteration result
 */
export async function processIteration(
  response: ProviderResponse,
  context: ReturnType<typeof initializeQueryContext>,
  agent: MCPJamAgent,
  toolCallApprover?: ToolCallApprover,
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
      handleTextContent(
        content,
        iterationContent,
        context.finalText,
        assistantContent,
      );
    } else if (content.type === "tool_use") {
      hasToolUse = true;
      agent.addClientLog(`Tool use detected: ${content.name}`, "debug");
      await handleToolUse(
        content,
        iterationContent,
        context,
        assistantContent,
        agent,
        toolCallApprover,
        signal,
      );
    }
  }

  return {
    content: iterationContent,
    hasToolUse,
  };
}

/**
 * Handle text content from AI
 * @param content The text content
 * @param iterationContent The current iteration content array
 * @param finalText The final text array
 * @param assistantContent The assistant content array
 */
export function handleTextContent(
  content: TextBlock,
  iterationContent: string[],
  finalText: string[],
  assistantContent: ContentBlock[],
) {
  iterationContent.push(content.text);
  finalText.push(content.text);
  assistantContent.push(content);
}

/**
 * Handle tool use request
 * @param content Tool use content block
 * @param iterationContent The current iteration content array
 * @param context The query context
 * @param assistantContent The assistant content array
 * @param agent The tool executor
 * @param toolCallApprover Optional tool call approver
 * @param signal Optional abort signal
 */
export async function handleToolUse(
  content: ToolUseBlock,
  iterationContent: string[],
  context: ReturnType<typeof initializeQueryContext>,
  assistantContent: ContentBlock[],
  agent: MCPJamAgent,
  toolCallApprover?: ToolCallApprover,
  signal?: AbortSignal,
) {
  assistantContent.push(content);

  const toolMessage = createToolMessage(content.name, content.input);
  iterationContent.push(toolMessage);
  context.finalText.push(toolMessage);

  try {
    // Request approval before executing the tool
    let approved = true;
    if (toolCallApprover) {
      agent.addClientLog(
        `Requesting approval for tool: ${content.name}`,
        "debug",
      );
      approved = await toolCallApprover.requestToolCallApproval(
        content.name,
        content.input,
        content.id,
      );
    }

    if (approved) {
      agent.addClientLog(`Executing tool: ${content.name}`, "debug");
      const toolResultMessage = await executeToolAndUpdateMessages(
        content,
        context,
        assistantContent,
        agent,
        signal,
      );
      // Add the tool result to iteration content for real-time display
      if (toolResultMessage) {
        iterationContent.push(toolResultMessage);
      }
      agent.addClientLog(`Tool execution successful: ${content.name}`, "debug");
    } else {
      // Tool execution was rejected
      agent.addClientLog(
        `Tool execution rejected by user: ${content.name}`,
        "info",
      );
      const rejectMessage = `[Tool ${content.name} execution was rejected by user]`;
      iterationContent.push(rejectMessage);
      context.finalText.push(rejectMessage);

      // Add rejection message as tool result
      addMessagesToContext(
        context,
        assistantContent,
        content.id,
        "Tool execution was rejected by user",
        true,
      );
    }
  } catch (error) {
    agent.addClientLog(
      `Tool execution failed: ${content.name} - ${error}`,
      "error",
    );
    handleToolError(
      error,
      content,
      iterationContent,
      context,
      assistantContent,
    );
  }
}

/**
 * Create a message for tool execution
 * @param toolName Name of the tool
 * @param toolArgs Tool arguments
 * @returns Formatted tool message
 */
export function createToolMessage(toolName: string, toolArgs: unknown): string {
  return `[Calling tool ${toolName} with args ${JSON.stringify(toolArgs)}]`;
}

/**
 * Execute a tool and update messages with the result
 * @param content Tool use content
 * @param context Query context
 * @param assistantContent Assistant content array
 * @param agent Tool executor
 * @param signal Optional abort signal
 * @returns Tool result message
 */
export async function executeToolAndUpdateMessages(
  content: ToolUseBlock,
  context: ReturnType<typeof initializeQueryContext>,
  assistantContent: ContentBlock[],
  agent: MCPJamAgent,
  signal?: AbortSignal,
): Promise<string> {
  // Check if aborted before tool execution
  if (signal?.aborted) {
    throw new Error("Chat was cancelled");
  }

  const result = await agent.callTool({
    name: content.name,
    arguments: content.input as { [x: string]: unknown } | undefined,
  });

  // Check if aborted after tool execution
  if (signal?.aborted) {
    throw new Error("Chat was cancelled");
  }

  // Extract content from MCP result structure
  let resultContent: string;
  if (result && typeof result === "object" && "content" in result) {
    // Handle MCP SDK CompatibilityCallToolResult format
    const mcpResult = result as {
      content: Array<{ type: string; text?: string }>;
    };
    if (Array.isArray(mcpResult.content) && mcpResult.content.length > 0) {
      // Extract text from content array
      const textItems = mcpResult.content
        .filter((item) => item.type === "text" && item.text)
        .map((item) => item.text)
        .join("\n");
      resultContent = textItems || JSON.stringify(result);
    } else {
      resultContent = JSON.stringify(result);
    }
  } else {
    // Handle direct string result or other formats
    resultContent =
      typeof result === "string" ? result : JSON.stringify(result);
  }

  // Add tool result to the displayed text (for user to see)
  const toolResultMessage = `[Tool ${content.name} result ${resultContent}]`;
  context.finalText.push(toolResultMessage);

  addMessagesToContext(context, assistantContent, content.id, resultContent);

  return toolResultMessage;
}

/**
 * Handle tool execution errors
 * @param error Error that occurred
 * @param content Tool use content
 * @param iterationContent Iteration content array
 * @param context Query context
 * @param assistantContent Assistant content array
 */
export function handleToolError(
  error: unknown,
  content: ToolUseBlock,
  iterationContent: string[],
  context: ReturnType<typeof initializeQueryContext>,
  assistantContent: ContentBlock[],
) {
  console.error(`Tool ${content.name} failed:`, error);
  const errorMessage = `[Tool ${content.name} failed: ${error}]`;
  iterationContent.push(errorMessage);
  context.finalText.push(errorMessage);

  addMessagesToContext(
    context,
    assistantContent,
    content.id,
    `Error: ${error}`,
    true,
  );
}

/**
 * Add messages to the context
 * @param context Query context
 * @param assistantContent Assistant content array
 * @param toolUseId Tool use ID
 * @param resultContent Result content
 * @param isError Whether this is an error
 */
export function addMessagesToContext(
  context: ReturnType<typeof initializeQueryContext>,
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

/**
 * Make a follow-up API call
 * @param context Query context
 * @param aiProvider AI provider
 * @param agent Tool executor
 * @param signal Optional abort signal
 * @returns Provider response
 */
export async function makeFollowUpApiCall(
  context: ReturnType<typeof initializeQueryContext>,
  aiProvider: AIProvider,
  agent: MCPJamAgent,
  signal?: AbortSignal,
): Promise<ProviderResponse> {
  // Check if aborted before making API call
  if (signal?.aborted) {
    throw new Error("Chat was cancelled");
  }
  agent.addClientLog("Making follow-up API call to AI provider", "debug");
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

/**
 * Send iteration update to callback if provided
 * @param content Content to send
 * @param onUpdate Optional update callback
 */
export function sendIterationUpdate(
  content: string | string[],
  onUpdate?: (content: string) => void,
) {
  if (!onUpdate) return;

  const message = Array.isArray(content) ? content.join("\n") : content;
  if (message.length > 0) {
    onUpdate(message);
  }
}

/**
 * Handle maximum iterations warning
 * @param iteration Current iteration
 * @param context Query context
 * @param agent Tool executor
 * @param onUpdate Optional update callback
 */
export function handleMaxIterationsWarning(
  iteration: number,
  context: ReturnType<typeof initializeQueryContext>,
  agent: MCPJamAgent,
  onUpdate?: (content: string) => void,
) {
  if (iteration >= context.MAX_ITERATIONS) {
    const warningMessage = `[Warning: Reached maximum iterations (${context.MAX_ITERATIONS}). Stopping to prevent excessive API usage.]`;
    agent.addClientLog(
      `Maximum iterations reached (${context.MAX_ITERATIONS})`,
      "warn",
    );
    context.finalText.push(warningMessage);
    sendIterationUpdate(warningMessage, onUpdate);
  }
}

/**
 * Process a query using AI and tools
 * @param query The query text
 * @param tools Tools available for the AI to use
 * @param agent The tool executor
 * @param toolCallApprover Optional tool call approver
 * @param onUpdate Optional callback for streaming updates
 * @param model Model identifier
 * @param provider Optional AI provider
 * @param signal Optional abort signal
 * @returns Model response text
 */
export async function processQuery(
  query: string,
  tools: AnthropicTool[],
  agent: MCPJamAgent,
  toolCallApprover?: ToolCallApprover,
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

  agent.addClientLog(
    `Processing query with ${tools.length} tools using model ${model}`,
    "info",
  );
  const context = initializeQueryContext(query, tools, model, agent);
  const response = await makeInitialApiCall(context, aiProvider, agent, signal);

  return processIterations(
    response,
    context,
    aiProvider,
    agent,
    toolCallApprover,
    onUpdate,
    signal,
  );
}
