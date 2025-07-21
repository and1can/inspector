import { NextRequest } from "next/server";
import {
  validateServerConfig,
  createMCPClient,
  createErrorResponse,
} from "@/lib/mcp-utils";
import { Agent } from "@mastra/core/agent";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { ChatMessage } from "@/lib/chat-types";
import { MCPClient } from "@mastra/mcp";
import { getModelById, isModelSupported } from "@/lib/types";

export async function POST(request: NextRequest) {
  let client: MCPClient | null = null;

  try {
    const { serverConfig, model, apiKey, systemPrompt, messages } =
      await request.json();

    if (!model || !apiKey || !messages) {
      return createErrorResponse(
        "Missing required fields",
        "model, apiKey, and messages are required",
      );
    }

    const validation = validateServerConfig(serverConfig);
    if (!validation.success) {
      return validation.error!;
    }

    // Create and connect the MCP client
    client = createMCPClient(validation.config!, `chat-${Date.now()}`);

    // Get tools and ensure client is connected
    const tools = await client.getTools();
    console.log(
      `MCP client connected, available tools: ${Object.keys(tools || {}).length}`,
    );

    const llmModel = getLlmModel(model, apiKey);

    // Create a custom event emitter for streaming tool events
    let toolCallId = 0;
    let streamController: ReadableStreamDefaultController | null = null;
    let encoder: TextEncoder | null = null;

    // Wrap tools to capture tool calls and results
    const originalTools = tools && Object.keys(tools).length > 0 ? tools : {};
    const wrappedTools: Record<string, any> = {};

    for (const [name, tool] of Object.entries(originalTools)) {
      wrappedTools[name] = {
        ...tool,
        execute: async (params: any) => {
          const currentToolCallId = ++toolCallId;

          // Stream tool call event immediately
          if (streamController && encoder) {
            streamController.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "tool_call",
                  toolCall: {
                    id: currentToolCallId,
                    name,
                    parameters: params,
                    timestamp: new Date(),
                    status: "executing",
                  },
                })}\n\n`,
              ),
            );
          }

          try {
            const result = await tool.execute(params);

            // Stream tool result event immediately
            if (streamController && encoder) {
              streamController.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "tool_result",
                    toolResult: {
                      id: currentToolCallId,
                      toolCallId: currentToolCallId,
                      result,
                      timestamp: new Date(),
                    },
                  })}\n\n`,
                ),
              );
            }

            return result;
          } catch (error) {
            // Stream tool error event immediately
            if (streamController && encoder) {
              streamController.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "tool_result",
                    toolResult: {
                      id: currentToolCallId,
                      toolCallId: currentToolCallId,
                      error:
                        error instanceof Error ? error.message : String(error),
                      timestamp: new Date(),
                    },
                  })}\n\n`,
                ),
              );
            }
            throw error;
          }
        },
      };
    }

    // Create a Mastra agent with the wrapped MCP tools
    const agent = new Agent({
      name: "MCP Chat Agent",
      instructions:
        systemPrompt || "You are a helpful assistant with access to MCP tools.",
      model: llmModel,
      tools: Object.keys(wrappedTools).length > 0 ? wrappedTools : undefined,
    });

    // Convert ChatMessage[] to the format expected by Mastra Agent
    const formattedMessages = messages.map((msg: ChatMessage) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Start streaming
    const stream = await agent.stream(formattedMessages, {
      maxSteps: 10, // Allow up to 10 steps for tool usage
    });

    // Create a ReadableStream for streaming response
    encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        streamController = controller;

        try {
          // Stream text content
          for await (const chunk of stream.textStream) {
            controller.enqueue(
              encoder!.encode(
                `data: ${JSON.stringify({ type: "text", content: chunk })}\n\n`,
              ),
            );
          }

          controller.enqueue(encoder!.encode(`data: [DONE]\n\n`));
        } catch (error) {
          console.error("Streaming error:", error);
          controller.enqueue(
            encoder!.encode(
              `data: ${JSON.stringify({
                type: "error",
                error: error instanceof Error ? error.message : "Unknown error",
              })}\n\n`,
            ),
          );
        } finally {
          // Clean up client after streaming is complete
          if (client) {
            try {
              await client.disconnect();
              console.log("MCP client disconnected after streaming");
            } catch (cleanupError) {
              console.warn(
                "Error cleaning up MCP client after streaming:",
                cleanupError,
              );
            }
          }
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in chat API:", error);

    // Clean up client on error
    if (client) {
      try {
        await client.disconnect();
        console.log("MCP client disconnected after error");
      } catch (cleanupError) {
        console.warn("Error cleaning up MCP client after error:", cleanupError);
      }
    }

    return createErrorResponse(
      "Failed to process chat request",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

const getLlmModel = (model: string, apiKey: string) => {
  if (!isModelSupported(model)) {
    throw new Error(`Unsupported model: ${model}`);
  }

  const modelDefinition = getModelById(model);
  if (!modelDefinition) {
    throw new Error(`Model not found: ${model}`);
  }

  switch (modelDefinition.provider) {
    case "anthropic":
      return createAnthropic({ apiKey })(model);
    case "openai":
      return createOpenAI({ apiKey })(model);
    default:
      throw new Error(`Unsupported provider for model: ${model}`);
  }
};
