import React, { useState, useEffect, useRef } from "react";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { Tool as AnthropicTool } from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import { Send, ChevronDown, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProviderLogo } from "../ProviderLogo";
import { providerManager, SupportedProvider } from "@/lib/providers";
import { MCPJamAgent } from "@/mcpjamAgent";
import { MCPJamClient } from "@/mcpjamClient";
import { ChatLoopProvider, ToolCaller, QueryProcessor } from "@/lib/chatLoop";
import { MessageBubble, Message } from "./MessageBubble";
import { LoadingDots } from "./LoadingDots";
import { ApiKeyRequiredState } from "./ApiKeyRequiredState";
import { EmptyChatsState, ChatConfig } from "./EmptyChatsState";
import { ToolCallApproval, PendingToolCall } from "./ToolCallApproval";

interface ChatProvider extends ChatLoopProvider, ToolCaller {}

interface ChatProps {
  provider: ChatProvider | null;
  config: ChatConfig;
  getServersCount?: () => number;
  updateTrigger?: number;
}

const Chat: React.FC<ChatProps> = ({
  provider,
  config,
  getServersCount,
  updateTrigger,
}) => {
  // Core state
  const [input, setInput] = useState("");
  const [chat, setChat] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);
  const [pendingToolCalls, setPendingToolCalls] = useState<
    Map<string, PendingToolCall>
  >(new Map());
  const [toolCallResolutions, setToolCallResolutions] = useState<
    Map<string, Promise<boolean>>
  >(new Map());

  // Tools and server state
  const [tools, setTools] = useState<Tool[]>([]);
  const [toolsCount, setToolsCount] = useState(0);
  const [serversCount, setServersCount] = useState(0);

  // Provider and model state
  const [selectedProvider, setSelectedProvider] =
    useState<SupportedProvider>("anthropic");
  const [selectedModel, setSelectedModel] = useState<string>(
    "claude-3-5-sonnet-latest",
  );
  const [showProviderSelector, setShowProviderSelector] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const providerSelectorRef = useRef<HTMLDivElement>(null);
  const modelSelectorRef = useRef<HTMLDivElement>(null);

  // Computed values
  const availableProviders = (): SupportedProvider[] => {
    return (["anthropic", "openai", "ollama"] as SupportedProvider[]).filter(
      (p) => providerManager.isProviderReady(p),
    );
  };

  const hasApiKey = availableProviders().length > 0;
  const availableModels =
    providerManager.getProvider(selectedProvider)?.getSupportedModels() || [];
  const canSend = input.trim() && provider && hasApiKey && !loading;
  const hasPendingToolCalls = pendingToolCalls.size > 0;

  // Message helpers
  const createMessage = (
    role: "user" | "assistant",
    content: string,
  ): Message => ({
    role,
    content,
    timestamp: new Date(),
  });

  const addMessageToChat = (message: Message) => {
    setChat((prev) => [...prev, message]);
  };

  // Tool fetching
  const fetchTools = React.useCallback(async () => {
    if (!provider) return;

    try {
      let tools: Tool[] = [];

      if (config.mode === "global" && "getAllTools" in provider) {
        const allServerTools = await (provider as MCPJamAgent).getAllTools();
        tools = allServerTools.flatMap((serverTools) => serverTools.tools);
      } else if (config.mode === "single" && "listTools" in provider) {
        const response = await (provider as MCPJamClient).listTools();
        tools = response.tools || [];
      }

      setTools(tools);
      setToolsCount(tools.length);
      setServersCount(getServersCount?.() || 0);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to fetch tools",
      );
    }
  }, [
    provider,
    config,
    getServersCount,
    setTools,
    setToolsCount,
    setServersCount,
    setError,
  ]);

  // Message processing
  // Tool call approval handlers
  const handleApproveToolCall = (toolCall: PendingToolCall) => {
    // Get the corresponding resolver for this tool call
    const resolver = toolCallResolutions.get(toolCall.id);
    if (resolver) {
      // Resolve the promise with true (approved)
      (resolver as unknown as { resolve: (value: boolean) => void }).resolve(
        true,
      );

      // Remove the tool call from pending list
      setPendingToolCalls((prev) => {
        const newMap = new Map(prev);
        newMap.delete(toolCall.id);
        return newMap;
      });
    }
  };

  const handleRejectToolCall = (toolCall: PendingToolCall) => {
    // Get the corresponding resolver for this tool call
    const resolver = toolCallResolutions.get(toolCall.id);
    if (resolver) {
      // Resolve the promise with false (rejected)
      (resolver as unknown as { resolve: (value: boolean) => void }).resolve(
        false,
      );

      // Remove the tool call from pending list
      setPendingToolCalls((prev) => {
        const newMap = new Map(prev);
        newMap.delete(toolCall.id);
        return newMap;
      });
    }
  };

  // Implement the ToolCallApprover interface method
  const requestToolCallApproval = React.useCallback(
    (name: string, input: unknown, id: string): Promise<boolean> => {
      return new Promise((resolve) => {
        // Create a pending tool call
        const toolCall: PendingToolCall = {
          id,
          name,
          input,
          timestamp: new Date(),
        };

        // Add to the pending tool calls
        setPendingToolCalls((prev) => {
          const newMap = new Map(prev);
          newMap.set(id, toolCall);
          return newMap;
        });

        // Store the resolver so we can call it when user approves/rejects
        setToolCallResolutions((prev) => {
          const newMap = new Map(prev);
          newMap.set(id, { resolve } as unknown as Promise<boolean>);
          return newMap;
        });
      });
    },
    [setPendingToolCalls, setToolCallResolutions],
  );

  const processMessage = async (userMessage: string) => {
    if (!provider) return;

    const controller = new AbortController();
    setAbortController(controller);
    setLoading(true);
    setError(null);

    addMessageToChat(createMessage("user", userMessage));
    setInput("");

    let fullResponse = "";
    let hasStarted = false;

    const onUpdate = (content: string) => {
      fullResponse = content;
      if (!hasStarted) {
        addMessageToChat(createMessage("assistant", content));
        hasStarted = true;
      } else {
        addMessageToChat(createMessage("assistant", content));
      }
    };

    try {
      const convertedTools: AnthropicTool[] = tools.map((tool) => ({
        name: tool.name,
        description: tool.description || "",
        input_schema: tool.inputSchema || { type: "object", properties: {} },
      }));

      // Pass to the tool call processing
      // If the provider is already a QueryProcessor, it would have been instantiated
      // with a tool call approver in the component that created it
      const queryProcessor =
        provider instanceof QueryProcessor
          ? provider
          : new QueryProcessor(provider, {
              requestToolCallApproval, // Use our approval implementation
            });

      await queryProcessor.processQuery(
        userMessage,
        convertedTools,
        onUpdate,
        selectedModel,
        selectedProvider,
        controller.signal,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error sending message";
      if (errorMessage !== "Chat was cancelled") {
        if (hasStarted) {
          addMessageToChat(
            createMessage(
              "assistant",
              fullResponse + `\n\n*[Error: ${errorMessage}]*`,
            ),
          );
        } else {
          addMessageToChat(
            createMessage("assistant", `*[Error: ${errorMessage}]*`),
          );
        }
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
      setAbortController(null);
    }
  };

  // Event handlers
  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSend) {
      processMessage(input.trim());
    }
  };

  const handleStop = () => {
    abortController?.abort();
    setAbortController(null);
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) {
        handleSend(e as unknown as React.FormEvent);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target;
    setInput(target.value);

    // Auto-resize textarea
    target.style.height = "auto";
    target.style.height = Math.min(target.scrollHeight, 128) + "px";
  };

  const selectProvider = (provider: SupportedProvider) => {
    setSelectedProvider(provider);
    setShowProviderSelector(false);

    // Update model to first available for this provider
    const models =
      providerManager.getProvider(provider)?.getSupportedModels() || [];
    if (models.length > 0) {
      setSelectedModel(models[0].id);
    }
  };

  const selectModel = (modelId: string) => {
    setSelectedModel(modelId);
    setShowModelSelector(false);
  };

  // Effects
  useEffect(() => {
    const providers = availableProviders();
    if (providers.length > 0) {
      const firstProvider = providers[0];
      setSelectedProvider(firstProvider);

      const models =
        providerManager.getProvider(firstProvider)?.getSupportedModels() || [];
      if (models.length > 0) {
        setSelectedModel(models[0].id);
      }
    }
  }, []);

  useEffect(() => {
    fetchTools();
  }, [provider, updateTrigger, config, fetchTools]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  useEffect(() => {
    if (hasApiKey && inputRef.current) {
      inputRef.current.focus();
    }
  }, [hasApiKey]);

  // Handle clicks outside dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        providerSelectorRef.current &&
        !providerSelectorRef.current.contains(event.target as Node)
      ) {
        setShowProviderSelector(false);
      }
      if (
        modelSelectorRef.current &&
        !modelSelectorRef.current.contains(event.target as Node)
      ) {
        setShowModelSelector(false);
      }
    };

    if (showProviderSelector || showModelSelector) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showProviderSelector, showModelSelector]);

  // Cleanup
  useEffect(() => {
    return () => abortController?.abort();
  }, [abortController]);

  const getProviderDisplayName = (provider: SupportedProvider): string => {
    const names = { anthropic: "Claude", openai: "OpenAI", ollama: "Ollama" };
    return names[provider] || provider;
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-800">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <ProviderLogo
                  className="text-slate-600 dark:text-slate-300"
                  size={20}
                  provider={selectedProvider}
                />
              </div>
              <div>
                <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {config.title}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {hasApiKey
                    ? config.mode === "global"
                      ? `${serversCount} servers • ${toolsCount} tools`
                      : `${toolsCount} tools available`
                    : "API key required"}
                </p>
              </div>
            </div>

            {hasApiKey && (
              <div className="flex items-center gap-2">
                {/* Provider Selector */}
                <div className="relative" ref={providerSelectorRef}>
                  <button
                    onClick={() =>
                      setShowProviderSelector(!showProviderSelector)
                    }
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                    disabled={loading}
                  >
                    <span className="text-slate-700 dark:text-slate-200 font-medium">
                      {getProviderDisplayName(selectedProvider)}
                    </span>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </button>

                  {showProviderSelector && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50">
                      <div className="py-2">
                        {availableProviders().map((provider) => (
                          <button
                            key={provider}
                            onClick={() => selectProvider(provider)}
                            className={cn(
                              "w-full px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
                              selectedProvider === provider &&
                                "bg-slate-50 dark:bg-slate-800",
                            )}
                          >
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {getProviderDisplayName(provider)}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Model Selector */}
                <div className="relative" ref={modelSelectorRef}>
                  <button
                    onClick={() => setShowModelSelector(!showModelSelector)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                    disabled={loading}
                  >
                    <span className="text-slate-700 dark:text-slate-200 font-medium">
                      {availableModels.find((m) => m.id === selectedModel)
                        ?.name || selectedModel}
                    </span>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </button>

                  {showModelSelector && (
                    <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50">
                      <div className="py-2">
                        {availableModels.map((model) => (
                          <button
                            key={model.id}
                            onClick={() => selectModel(model.id)}
                            className={cn(
                              "w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
                              selectedModel === model.id &&
                                "bg-slate-50 dark:bg-slate-800",
                            )}
                          >
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {model.name}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {model.description}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto">
        {!hasApiKey ? (
          <ApiKeyRequiredState />
        ) : chat.length === 0 ? (
          <EmptyChatsState
            onSuggestionClick={setInput}
            selectedProvider={selectedProvider}
            config={config}
            toolsCount={toolsCount}
            serversCount={serversCount}
          />
        ) : (
          <div className="py-2">
            {chat.map((message, idx) => (
              <MessageBubble
                key={idx}
                message={message}
                selectedProvider={selectedProvider}
              />
            ))}
            {/* Pending Tool Calls */}
            {hasPendingToolCalls && (
              <div className="px-6 mb-2">
                <div className="mb-2 text-sm text-amber-600 dark:text-amber-400 font-medium">
                  Pending Tool Calls:
                </div>
                {Array.from(pendingToolCalls.values()).map((toolCall) => (
                  <ToolCallApproval
                    key={toolCall.id}
                    toolCall={toolCall}
                    onApprove={handleApproveToolCall}
                    onReject={handleRejectToolCall}
                  />
                ))}
              </div>
            )}
            {loading && (
              <div className="flex gap-3 px-6 py-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <ProviderLogo
                    className="text-slate-600 dark:text-slate-300"
                    size={20}
                    provider={selectedProvider}
                  />
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-3">
                  <LoadingDots />
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex-shrink-0 px-6 py-3 bg-red-50 dark:bg-red-950/50 border-t border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300 text-sm">
            <span className="text-xs">⚠️</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Input Form */}
      <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-800">
        <div className="p-6">
          <form onSubmit={handleSend} className="relative">
            <div className="relative flex items-end gap-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  !hasApiKey
                    ? "API key required..."
                    : loading
                      ? `${getProviderDisplayName(selectedProvider)} is thinking...`
                      : `Message ${getProviderDisplayName(selectedProvider)}...`
                }
                disabled={!hasApiKey || loading}
                rows={1}
                className={cn(
                  "flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 resize-none",
                  "focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500 focus:border-transparent",
                  "placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm",
                  "min-h-[48px] max-h-32 overflow-y-auto",
                  (!hasApiKey || loading) && "opacity-50 cursor-not-allowed",
                )}
                style={{
                  height: "auto",
                  minHeight: "48px",
                  maxHeight: "128px",
                }}
              />

              {loading ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-red-600 hover:bg-red-700 text-white transition-colors"
                >
                  <Square className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!canSend}
                  className={cn(
                    "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                    !canSend
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                      : "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200",
                  )}
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>

            {hasApiKey && !loading && (
              <div className="text-xs text-slate-400 dark:text-slate-500 mt-3 px-1">
                <span className="hidden sm:inline">
                  Press Enter to send • Shift+Enter for new line
                  {config.mode === "global" &&
                    ` • ${toolsCount} tools from ${serversCount} servers`}
                </span>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chat;
