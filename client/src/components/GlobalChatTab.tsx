import React from "react";
import Chat from "./Chat";
import { MCPJamAgent } from "@/mcpjamAgent";
import { createChatConfig } from "@/lib/utils";

interface GlobalChatTabProps {
  mcpAgent: MCPJamAgent | null;
}

const GlobalChatTab: React.FC<GlobalChatTabProps> = ({ mcpAgent }) => {
  const config = createChatConfig("global", {
    subtitle: "Chat with access to tools from all connected servers",
    additionalSuggestions: ["What tools do you have access to?"],
  });

  const getToolsCount = async (): Promise<number> => {
    if (!mcpAgent) return 0;
    try {
      const allServerTools = await mcpAgent.getAllTools();
      return allServerTools.reduce((total, serverTools) => total + serverTools.tools.length, 0);
    } catch {
      return 0;
    }
  };

  const getServersCount = (): number => {
    if (!mcpAgent) return 0;
    return mcpAgent.getAllConnectionInfo().filter(
      (conn) => conn.connectionStatus === "connected"
    ).length;
  };

  return (
    <Chat
      provider={mcpAgent}
      config={config}
      getToolsCount={getToolsCount}
      getServersCount={getServersCount}
    />
  );
};

export default GlobalChatTab; 