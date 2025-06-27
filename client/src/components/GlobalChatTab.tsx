import React from "react";
import Chat from "./Chat";
import { MCPJamAgent } from "@/mcpjamAgent";
import { createChatConfig } from "@/lib/utils";

interface GlobalChatTabProps {
  mcpAgent: MCPJamAgent | null;
  updateTrigger?: number;
}

const GlobalChatTab: React.FC<GlobalChatTabProps> = ({ mcpAgent, updateTrigger }) => {
  const config = createChatConfig("global", {
    subtitle: "Chat with access to tools from all connected servers",
    additionalSuggestions: ["What tools do you have access to?"],
  });

  const getServersCount = (): number => {
    if (!mcpAgent) return 0;
    try {
      const connectionInfo = mcpAgent.getAllConnectionInfo();
      return connectionInfo.filter((conn) => conn.connectionStatus === "connected").length;
    } catch {
      return 0;
    }
  };

  if (!mcpAgent) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">No MCP Agent Available</h2>
          <p className="text-muted-foreground">
            Please connect to a server to use global chat.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Chat
      provider={mcpAgent}
      config={config}
      getServersCount={getServersCount}
      updateTrigger={updateTrigger}
    />
  );
};

export default GlobalChatTab; 