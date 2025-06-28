import React from "react";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToolCallMessage } from "./ToolCallMessage";
import { parseToolCallContent } from "@/utils/toolCallHelpers";
import { ProviderLogo } from "../ProviderLogo";
import { SupportedProvider } from "@/lib/providers";

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface MessageBubbleProps {
  message: Message;
  selectedProvider: SupportedProvider;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, selectedProvider }) => {
  const isUser = message.role === "user";
  const parsedContent = parseToolCallContent(message.content);
  console.log("parsedContent", parsedContent.toolCalls);
  return (
    <div
      className={cn(
        "flex gap-3 px-6 py-4",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <ProviderLogo
            className="text-slate-600 dark:text-slate-300"
            size={20}
            provider={selectedProvider}
          />
        </div>
      )}

      <div
        className={cn(
          "max-w-[75%] rounded-xl px-4 py-3 break-words",
          isUser
            ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
            : "bg-slate-50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100",
        )}
      >
        {/* Regular text content */}
        {parsedContent.text && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {parsedContent.text}
          </p>
        )}

        {/* Tool calls */}
        {parsedContent.toolCalls.length > 0 && (
          <div className="mt-3">
            {parsedContent.toolCalls.map((toolCall, index) => (
              <ToolCallMessage key={index} toolCall={toolCall} />
            ))}
          </div>
        )}

        <div
          className={cn(
            "text-xs mt-2 opacity-50",
            isUser
              ? "text-white/60 dark:text-slate-900/60"
              : "text-slate-500 dark:text-slate-400",
          )}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>

      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
          <User className="w-3 h-3 text-slate-600 dark:text-slate-300" />
        </div>
      )}
    </div>
  );
}; 