/**
 * Validators for matching tool calls in eval tests
 *
 * All matching is case-sensitive and uses exact strings only (no wildcards).
 */

/**
 * Exact match - all expected tools must be present in exact order.
 * Case-sensitive exact string comparison.
 *
 * @param expected - The expected tool names in order
 * @param actual - The actual tool names that were called
 * @returns true if actual matches expected exactly
 *
 * @example
 * matchToolCalls(['add', 'multiply'], ['add', 'multiply']) // true
 * matchToolCalls(['add', 'multiply'], ['multiply', 'add']) // false (wrong order)
 * matchToolCalls(['add'], ['add', 'multiply']) // false (extra tool)
 */
export function matchToolCalls(expected: string[], actual: string[]): boolean {
  if (expected.length !== actual.length) {
    return false;
  }

  for (let i = 0; i < expected.length; i++) {
    if (expected[i] !== actual[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Subset match - all expected tools must be present, order doesn't matter.
 * Case-sensitive exact string comparison.
 *
 * @param expected - The expected tool names (any order)
 * @param actual - The actual tool names that were called
 * @returns true if all expected tools are present in actual
 *
 * @example
 * matchToolCallsSubset(['add', 'multiply'], ['multiply', 'add']) // true
 * matchToolCallsSubset(['add'], ['add', 'multiply']) // true
 * matchToolCallsSubset(['add', 'subtract'], ['add', 'multiply']) // false (missing subtract)
 */
export function matchToolCallsSubset(expected: string[], actual: string[]): boolean {
  for (const tool of expected) {
    if (!actual.includes(tool)) {
      return false;
    }
  }

  return true;
}

/**
 * Any match - at least one expected tool must be present.
 * Case-sensitive exact string comparison.
 *
 * @param expected - The expected tool names (at least one must match)
 * @param actual - The actual tool names that were called
 * @returns true if at least one expected tool is present in actual
 *
 * @example
 * matchAnyToolCall(['add', 'subtract'], ['multiply', 'add']) // true
 * matchAnyToolCall(['add', 'subtract'], ['multiply', 'divide']) // false
 * matchAnyToolCall([], ['add']) // false (empty expected)
 */
export function matchAnyToolCall(expected: string[], actual: string[]): boolean {
  if (expected.length === 0) {
    return false;
  }

  for (const tool of expected) {
    if (actual.includes(tool)) {
      return true;
    }
  }

  return false;
}

/**
 * Count match - check if a specific tool was called exactly N times.
 * Case-sensitive exact string comparison.
 *
 * @param toolName - The tool name to count
 * @param actual - The actual tool names that were called
 * @param count - The expected number of times the tool should be called
 * @returns true if the tool was called exactly count times
 *
 * @example
 * matchToolCallCount('add', ['add', 'add', 'multiply'], 2) // true
 * matchToolCallCount('add', ['add', 'multiply'], 2) // false
 */
export function matchToolCallCount(
  toolName: string,
  actual: string[],
  count: number
): boolean {
  const actualCount = actual.filter((t) => t === toolName).length;
  return actualCount === count;
}

/**
 * No tools match - check that no tools were called.
 *
 * @param actual - The actual tool names that were called
 * @returns true if no tools were called
 *
 * @example
 * matchNoToolCalls([]) // true
 * matchNoToolCalls(['add']) // false
 */
export function matchNoToolCalls(actual: string[]): boolean {
  return actual.length === 0;
}
