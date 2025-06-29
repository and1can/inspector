import { ClientRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { useMCPOperations } from "../hooks/useMCPOperations";

// MCP Request Service
export const createMCPRequestService = (
  makeRequest: (request: ClientRequest) => Promise<unknown>,
  mcpOperations: ReturnType<typeof useMCPOperations>,
) => {
  const sendMCPRequest = async <T extends z.ZodType>(
    request: ClientRequest,
    schema: T,
    tabKey?: keyof typeof mcpOperations.errors,
  ) => {
    try {
      const response = await makeRequest(request);
      return schema.parse(response);
    } catch (error) {
      if (tabKey) {
        mcpOperations.setErrors((prev) => ({
          ...prev,
          [tabKey]: (error as Error).message,
        }));
      }
      throw error;
    }
  };

  return {
    sendMCPRequest,
  };
};
