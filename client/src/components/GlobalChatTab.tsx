import React from "react";
import Chat from "./Chat";
import { MCPJamAgent } from "@/mcpjamAgent";
import { providerManager } from "@/lib/providers";

interface GlobalChatTabProps {
  mcpAgent: MCPJamAgent | null;
}

const GlobalChatTab: React.FC<GlobalChatTabProps> = ({ mcpAgent }) => {
  function getProviderDisplayName(): string {
    const defaultProvider = providerManager.getDefaultProvider();
    if (defaultProvider) {
      const providerName = defaultProvider.constructor.name.toLowerCase();
      if (providerName.includes("anthropic")) return "Claude";
      if (providerName.includes("openai")) return "OpenAI";
      if (providerName.includes("ollama")) return "Ollama";
    }
    return "AI";
  }

  const config = {
    mode: "global" as const,
    title: `Global Chat - ${getProviderDisplayName()}`,
    subtitle: "Chat with access to tools from all connected servers",
    suggestions: [
      "Hello! How can you help me?",
      "What tools do you have access to?",
      "Help me write some code",
      "Explain a concept to me",
    ],
  };

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