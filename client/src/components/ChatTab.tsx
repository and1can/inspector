import React from "react";
import Chat from "./Chat";
import { useMcpClient } from "@/context/McpClientContext";
import { MCPJamClient } from "@/mcpjamClient";
import { createChatConfig } from "@/lib/utils";

const ChatTab: React.FC = () => {
  const mcpClient = useMcpClient() as MCPJamClient | null;

  const config = createChatConfig("single", {
    additionalSuggestions: ["Help me with writing"],
  });

  return (
    <Chat
      provider={mcpClient}
      config={config}
    />
  );
};

export default ChatTab;
