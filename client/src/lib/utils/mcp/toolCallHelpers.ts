import { ToolCallInfo } from "@/components/chat/ToolCallMessage";

export interface ParsedContent {
  text: string;
  toolCalls: ToolCallInfo[];
}

// Parse tool call messages from content
export const parseToolCallContent = (content: string): ParsedContent => {
  // Define the patterns to extract different types of tool messages
  // The order is important - more specific patterns first
  const patterns = [
    // Tool calls: [Calling tool TOOL_NAME with args ARGS]
    {
      regex: /\[Calling tool ([\w_]+) with args ([\s\S]*?)\]/g,
      process: (match: RegExpExecArray) => {
        const [, toolName, argsStr] = match;
        let args;
        try {
          // Try to parse the args as JSON
          args = JSON.parse(argsStr);
        } catch {
          // If parsing fails, use the raw string
          args = argsStr;
        }
        return { type: "tool_call" as const, toolName, args };
      },
    },

    // Tool results: [Tool TOOL_NAME result RESULT]
    {
      // Match the entire tool result - handle content that may contain brackets
      regex: /\[Tool ([\w_]+) result ([\s\S]*?)\](?=\s*(?:\[|$))/g,
      process: (match: RegExpExecArray) => {
        const [, toolName, result] = match;
        return {
          type: "tool_result" as const,
          toolName,
          result: result.trim(),
        };
      },
    },

    // Tool errors: [Tool TOOL_NAME failed: ERROR]
    {
      regex: /\[Tool ([\w_]+) failed: ([\s\S]*?)\](?![\]][^\s])/g,
      process: (match: RegExpExecArray) => {
        const [, toolName, error] = match;
        return { type: "tool_error" as const, toolName, error: error.trim() };
      },
    },

    // Warnings: [Warning: MESSAGE]
    {
      regex: /\[Warning: ([\s\S]*?)\]/g,
      process: (match: RegExpExecArray) => {
        const [, message] = match;
        return { type: "tool_warning" as const, toolName: "system", message };
      },
    },
  ];

  // Create a map to track positions of all matches
  const allMatches: Array<{ start: number; end: number; info: ToolCallInfo }> =
    [];

  // Extract all tool calls from the content string using each pattern
  for (const pattern of patterns) {
    let match;
    // Set lastIndex to 0 to ensure we search from the beginning for each pattern
    pattern.regex.lastIndex = 0;
    while ((match = pattern.regex.exec(content)) !== null) {
      const info = pattern.process(match);
      allMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        info,
      });
    }
  }

  // Sort matches by their position in the original string
  allMatches.sort((a, b) => a.start - b.start);

  // Extract all tool call info objects
  const extractedToolCalls = allMatches.map((match) => match.info);

  // Remove all matched portions from the clean text
  let cleanText = content;
  // Process in reverse order to avoid position shifts
  for (let i = allMatches.length - 1; i >= 0; i--) {
    const { start, end } = allMatches[i];
    cleanText = cleanText.substring(0, start) + cleanText.substring(end);
  }

  return {
    text: cleanText.trim(),
    toolCalls: extractedToolCalls,
  };
};
