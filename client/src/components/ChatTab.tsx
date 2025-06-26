import React from "react";
import Chat from "./Chat";
import { useMcpClient } from "@/context/McpClientContext";
import { providerManager } from "@/lib/providers";
import { MCPJamClient } from "@/mcpjamClient";

const ChatTab: React.FC = () => {
  const mcpClient = useMcpClient() as MCPJamClient | null;

  const config = {
    mode: "single" as const,
    title: `${getProviderDisplayName()} Chat`,
    suggestions: [
      "Hello! How can you help me?",
      "Help me write some code",
      "Explain a concept to me",
      "Help me with writing",
    ],
  };

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

  return (
    <Chat
      provider={mcpClient}
      config={config}
    />
  );
};

export default ChatTab;
