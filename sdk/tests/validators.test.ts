import {
  matchToolCalls,
  matchToolCallsSubset,
  matchAnyToolCall,
  matchToolCallCount,
  matchNoToolCalls,
} from "../src/validators";

describe("validators", () => {
  describe("matchToolCalls", () => {
    it("should match exact order and content", () => {
      expect(matchToolCalls(["add", "multiply"], ["add", "multiply"])).toBe(
        true
      );
    });

    it("should fail on wrong order", () => {
      expect(matchToolCalls(["add", "multiply"], ["multiply", "add"])).toBe(
        false
      );
    });

    it("should fail on extra tools", () => {
      expect(matchToolCalls(["add"], ["add", "multiply"])).toBe(false);
    });

    it("should fail on missing tools", () => {
      expect(matchToolCalls(["add", "multiply"], ["add"])).toBe(false);
    });

    it("should match empty arrays", () => {
      expect(matchToolCalls([], [])).toBe(true);
    });

    it("should be case-sensitive", () => {
      expect(matchToolCalls(["Add"], ["add"])).toBe(false);
      expect(matchToolCalls(["ADD"], ["add"])).toBe(false);
    });

    it("should handle duplicate tool names", () => {
      expect(matchToolCalls(["add", "add"], ["add", "add"])).toBe(true);
      expect(matchToolCalls(["add", "add"], ["add"])).toBe(false);
    });
  });

  describe("matchToolCallsSubset", () => {
    it("should match when all expected are present", () => {
      expect(matchToolCallsSubset(["add"], ["add", "multiply"])).toBe(true);
    });

    it("should match regardless of order", () => {
      expect(
        matchToolCallsSubset(["multiply", "add"], ["add", "multiply"])
      ).toBe(true);
    });

    it("should match exact set", () => {
      expect(
        matchToolCallsSubset(["add", "multiply"], ["add", "multiply"])
      ).toBe(true);
    });

    it("should fail when expected tool is missing", () => {
      expect(
        matchToolCallsSubset(["add", "subtract"], ["add", "multiply"])
      ).toBe(false);
    });

    it("should match empty expected against any actual", () => {
      expect(matchToolCallsSubset([], ["add", "multiply"])).toBe(true);
      expect(matchToolCallsSubset([], [])).toBe(true);
    });

    it("should be case-sensitive", () => {
      expect(matchToolCallsSubset(["Add"], ["add"])).toBe(false);
    });

    it("should not require multiple occurrences", () => {
      // Even if expected has duplicate, only checks presence
      expect(matchToolCallsSubset(["add", "add"], ["add", "multiply"])).toBe(
        true
      );
    });
  });

  describe("matchAnyToolCall", () => {
    it("should match when at least one expected is present", () => {
      expect(matchAnyToolCall(["add", "subtract"], ["multiply", "add"])).toBe(
        true
      );
    });

    it("should fail when none of expected are present", () => {
      expect(
        matchAnyToolCall(["add", "subtract"], ["multiply", "divide"])
      ).toBe(false);
    });

    it("should fail with empty expected", () => {
      expect(matchAnyToolCall([], ["add"])).toBe(false);
    });

    it("should fail with empty actual when expected is non-empty", () => {
      expect(matchAnyToolCall(["add"], [])).toBe(false);
    });

    it("should be case-sensitive", () => {
      expect(matchAnyToolCall(["Add"], ["add"])).toBe(false);
    });

    it("should match on first found", () => {
      expect(matchAnyToolCall(["z", "a"], ["a", "b", "c"])).toBe(true);
    });
  });

  describe("matchToolCallCount", () => {
    it("should match exact count", () => {
      expect(matchToolCallCount("add", ["add", "add", "multiply"], 2)).toBe(
        true
      );
    });

    it("should fail on wrong count", () => {
      expect(matchToolCallCount("add", ["add", "multiply"], 2)).toBe(false);
    });

    it("should match zero occurrences", () => {
      expect(matchToolCallCount("subtract", ["add", "multiply"], 0)).toBe(true);
    });

    it("should be case-sensitive", () => {
      expect(matchToolCallCount("Add", ["add", "add"], 2)).toBe(false);
      expect(matchToolCallCount("Add", ["add", "add"], 0)).toBe(true);
    });

    it("should count single occurrence", () => {
      expect(matchToolCallCount("add", ["add", "multiply", "divide"], 1)).toBe(
        true
      );
    });
  });

  describe("matchNoToolCalls", () => {
    it("should return true for empty array", () => {
      expect(matchNoToolCalls([])).toBe(true);
    });

    it("should return false when tools were called", () => {
      expect(matchNoToolCalls(["add"])).toBe(false);
      expect(matchNoToolCalls(["add", "multiply"])).toBe(false);
    });
  });
});
