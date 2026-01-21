/**
 * QueryResult class - wraps the result of a TestAgent query
 */

import type { ToolCall, TokenUsage, QueryResultData } from "./types.js";

/**
 * Represents the result of a TestAgent query.
 * Provides convenient methods to inspect tool calls, token usage, and errors.
 */
export class QueryResult {
  /** The text response from the LLM */
  readonly text: string;

  /** End-to-end latency in milliseconds */
  readonly e2eLatencyMs: number;

  /** Tool calls made during the query */
  private readonly _toolCalls: ToolCall[];

  /** Token usage statistics */
  private readonly _usage: TokenUsage;

  /** Error message if the query failed */
  private readonly _error?: string;

  /**
   * Create a new QueryResult
   * @param data - The raw query result data
   */
  constructor(data: QueryResultData) {
    this.text = data.text;
    this.e2eLatencyMs = data.latencyMs;
    this._toolCalls = data.toolCalls;
    this._usage = data.usage;
    this._error = data.error;
  }

  /**
   * Get the names of all tools that were called during this query.
   * Returns a standard string[] that can be used with .includes().
   *
   * @returns Array of tool names
   */
  toolsCalled(): string[] {
    return this._toolCalls.map((tc) => tc.toolName);
  }

  /**
   * Check if a specific tool was called during this query.
   * Case-sensitive exact match.
   *
   * @param toolName - The name of the tool to check for
   * @returns true if the tool was called
   */
  hasToolCall(toolName: string): boolean {
    return this._toolCalls.some((tc) => tc.toolName === toolName);
  }

  /**
   * Get all tool calls with their arguments.
   *
   * @returns Array of ToolCall objects
   */
  getToolCalls(): ToolCall[] {
    return [...this._toolCalls];
  }

  /**
   * Get the arguments passed to a specific tool call.
   * Returns undefined if the tool was not called.
   * If the tool was called multiple times, returns the first call's arguments.
   *
   * @param toolName - The name of the tool
   * @returns The arguments object or undefined
   */
  getToolArguments(toolName: string): Record<string, unknown> | undefined {
    const call = this._toolCalls.find((tc) => tc.toolName === toolName);
    return call?.arguments;
  }

  /**
   * Get the total number of tokens used.
   *
   * @returns Total tokens (input + output)
   */
  totalTokens(): number {
    return this._usage.totalTokens;
  }

  /**
   * Get the number of input tokens used.
   *
   * @returns Input token count
   */
  inputTokens(): number {
    return this._usage.inputTokens;
  }

  /**
   * Get the number of output tokens used.
   *
   * @returns Output token count
   */
  outputTokens(): number {
    return this._usage.outputTokens;
  }

  /**
   * Get the full token usage statistics.
   *
   * @returns TokenUsage object
   */
  getUsage(): TokenUsage {
    return { ...this._usage };
  }

  /**
   * Check if this query resulted in an error.
   *
   * @returns true if there was an error
   */
  hasError(): boolean {
    return this._error !== undefined;
  }

  /**
   * Get the error message if the query failed.
   *
   * @returns The error message or undefined
   */
  getError(): string | undefined {
    return this._error;
  }

  /**
   * Create a QueryResult from raw data.
   * Factory method for convenience.
   *
   * @param data - The raw query result data
   * @returns A new QueryResult instance
   */
  static from(data: QueryResultData): QueryResult {
    return new QueryResult(data);
  }

  /**
   * Create an error QueryResult.
   * Factory method for error cases.
   *
   * @param error - The error message
   * @param latencyMs - The time taken before the error
   * @returns A new QueryResult instance with error state
   */
  static error(error: string, latencyMs: number = 0): QueryResult {
    return new QueryResult({
      text: "",
      toolCalls: [],
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      latencyMs,
      error,
    });
  }
}
