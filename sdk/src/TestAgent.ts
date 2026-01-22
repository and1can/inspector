/**
 * TestAgent - Runs LLM queries with tool calling for evals
 */

import { generateText, stepCountIs } from "ai";
import type { ToolSet } from "ai";
import { createModelFromString } from "./model-factory.js";
import type { CreateModelOptions } from "./model-factory.js";
import { extractToolCalls } from "./tool-extraction.js";
import { QueryResult } from "./QueryResult.js";
import type { CustomProvider } from "./types.js";

/**
 * Configuration for creating a TestAgent
 */
export interface TestAgentConfig {
  /** Tools to provide to the LLM (AI SDK ToolSet format from manager.getToolsForAiSdk()) */
  tools: ToolSet;
  /** LLM provider and model string (e.g., "openai/gpt-4o", "anthropic/claude-3-5-sonnet-20241022") */
  llm: string;
  /** API key for the LLM provider */
  apiKey: string;
  /** System prompt for the LLM (default: "You are a helpful assistant.") */
  systemPrompt?: string;
  /** Temperature for LLM responses (0-2, default: 0.7) */
  temperature?: number;
  /** Maximum number of agentic steps/tool calls (default: 10) */
  maxSteps?: number;
  /** Custom providers registry for non-standard LLM providers */
  customProviders?:
    | Map<string, CustomProvider>
    | Record<string, CustomProvider>;
}

/**
 * Agent for running LLM queries with tool calling.
 * Wraps the AI SDK generateText function with proper tool integration.
 *
 * @example
 * ```typescript
 * const manager = new MCPClientManager({
 *   everything: { command: "npx", args: ["-y", "@modelcontextprotocol/server-everything"] },
 * });
 * await manager.connectToServer("everything");
 *
 * const agent = new TestAgent({
 *   tools: await manager.getToolsForAiSdk(["everything"]),
 *   llm: "openai/gpt-4o",
 *   apiKey: process.env.OPENAI_API_KEY!,
 * });
 *
 * const result = await agent.query("Add 2 and 3");
 * console.log(result.toolsCalled()); // ["add"]
 * console.log(result.text); // "The result of adding 2 and 3 is 5."
 * ```
 */
export class TestAgent {
  private readonly tools: ToolSet;
  private readonly llm: string;
  private readonly apiKey: string;
  private systemPrompt: string;
  private temperature: number;
  private readonly maxSteps: number;
  private readonly customProviders?:
    | Map<string, CustomProvider>
    | Record<string, CustomProvider>;

  /** The result of the last query (for toolsCalled() convenience method) */
  private lastResult: QueryResult | undefined;

  /**
   * Create a new TestAgent
   * @param config - Agent configuration
   */
  constructor(config: TestAgentConfig) {
    this.tools = config.tools;
    this.llm = config.llm;
    this.apiKey = config.apiKey;
    this.systemPrompt = config.systemPrompt ?? "You are a helpful assistant.";
    this.temperature = config.temperature ?? 0.7;
    this.maxSteps = config.maxSteps ?? 10;
    this.customProviders = config.customProviders;
  }

  /**
   * Run a query with the LLM, allowing tool calls.
   * Never throws - errors are returned in the QueryResult.
   *
   * @param prompt - The user prompt to send to the LLM
   * @returns QueryResult with text response, tool calls, token usage, and latency
   */
  async query(prompt: string): Promise<QueryResult> {
    const startTime = Date.now();

    try {
      const modelOptions: CreateModelOptions = {
        apiKey: this.apiKey,
        customProviders: this.customProviders,
      };
      const model = createModelFromString(this.llm, modelOptions);

      // Cast model to any to handle AI SDK version compatibility
      const result = await generateText({
        model: model as any,
        tools: this.tools,
        system: this.systemPrompt,
        prompt,
        temperature: this.temperature,
        // Use stopWhen with stepCountIs for controlling max agentic steps
        // AI SDK v6+ uses this instead of maxSteps
        stopWhen: stepCountIs(this.maxSteps),
      });

      const latencyMs = Date.now() - startTime;

      // Cast result to GenerateTextResultLike to extract tool calls
      // This is needed because the AI SDK types are complex and version-dependent
      const toolCalls = extractToolCalls(result as any);

      // Handle both old and new usage formats
      const usage = result.usage;
      const inputTokens =
        (usage as any)?.inputTokens ?? (usage as any)?.promptTokens ?? 0;
      const outputTokens =
        (usage as any)?.outputTokens ?? (usage as any)?.completionTokens ?? 0;

      this.lastResult = QueryResult.from({
        text: result.text,
        toolCalls,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens:
            (usage as any)?.totalTokens ?? inputTokens + outputTokens,
        },
        latencyMs,
      });

      return this.lastResult;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.lastResult = QueryResult.error(errorMessage, latencyMs);
      return this.lastResult;
    }
  }

  /**
   * Get the names of tools called in the last query.
   * Convenience method for quick checks in eval functions.
   *
   * @returns Array of tool names from the last query, or empty array if no query has been run
   */
  toolsCalled(): string[] {
    if (!this.lastResult) {
      return [];
    }
    return this.lastResult.toolsCalled();
  }

  /**
   * Create a new TestAgent with modified options.
   * Useful for creating variants for different test scenarios.
   *
   * @param options - Partial config to override
   * @returns A new TestAgent instance with the merged configuration
   */
  withOptions(options: Partial<TestAgentConfig>): TestAgent {
    return new TestAgent({
      tools: options.tools ?? this.tools,
      llm: options.llm ?? this.llm,
      apiKey: options.apiKey ?? this.apiKey,
      systemPrompt: options.systemPrompt ?? this.systemPrompt,
      temperature: options.temperature ?? this.temperature,
      maxSteps: options.maxSteps ?? this.maxSteps,
      customProviders: options.customProviders ?? this.customProviders,
    });
  }

  /**
   * Get the configured tools
   */
  getTools(): ToolSet {
    return this.tools;
  }

  /**
   * Get the LLM provider/model string
   */
  getLlm(): string {
    return this.llm;
  }

  /**
   * Get the API key
   */
  getApiKey(): string {
    return this.apiKey;
  }

  /**
   * Get the current system prompt
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  /**
   * Set a new system prompt
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  /**
   * Get the current temperature
   */
  getTemperature(): number {
    return this.temperature;
  }

  /**
   * Set the temperature (must be between 0 and 2)
   */
  setTemperature(temperature: number): void {
    if (temperature < 0 || temperature > 2) {
      throw new Error("Temperature must be between 0 and 2");
    }
    this.temperature = temperature;
  }

  /**
   * Get the max steps configuration
   */
  getMaxSteps(): number {
    return this.maxSteps;
  }

  /**
   * Get the result of the last query
   */
  getLastResult(): QueryResult | undefined {
    return this.lastResult;
  }
}
