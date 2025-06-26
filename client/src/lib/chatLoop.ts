import readline from "readline/promises";
import { Tool as AnthropicTool } from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import { Tool as MCPTool } from "@modelcontextprotocol/sdk/types.js";
import { ClientLogLevels } from "../hooks/helpers/types";

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
      console.log("\nMCP Client Started!");
      console.log("Type your queries or 'quit' to exit.");

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