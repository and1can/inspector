import { CompatibilityCallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { useEffect, useState, useCallback } from "react";
import { History, ChevronDown, GripHorizontal } from "lucide-react";
import { useDraggablePane } from "../lib/hooks/useDraggablePane";
import TabbedHistoryPanel from "./TabbedHistoryPanel";
import { ClientLogInfo } from "@/hooks/helpers/types";

const HistoryAndNotifications = ({
  requestHistory,
  toolResult,
  clientLogs,
  onClearHistory,
  onClearLogs,
}: {
  requestHistory: Array<{
    request: string;
    response?: string;
    timestamp: string;
    latency?: number;
  }>;
  toolResult: CompatibilityCallToolResult | null;
  clientLogs: ClientLogInfo[];
  onClearHistory: () => void;
  onClearLogs: () => void;
}) => {
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(true);

  const {
    height: historyPaneHeight,
    isDragging,
    handleDragStart,
    resetHeight,
    setCustomHeight,
  } = useDraggablePane(500, "historyPaneHeight");

  const toggleCollapse = useCallback(() => {
    setIsHistoryCollapsed(!isHistoryCollapsed);
  }, [isHistoryCollapsed]);

  // Handle double-click to reset height
  const handleDoubleClick = useCallback(() => {
    if (!isHistoryCollapsed) {
      resetHeight();
    }
  }, [isHistoryCollapsed, resetHeight]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when history is not collapsed and not in an input field
      if (isHistoryCollapsed || 
          (e.target as HTMLElement)?.tagName?.toLowerCase() === 'input' ||
          (e.target as HTMLElement)?.tagName?.toLowerCase() === 'textarea') {
        return;
      }

      // Alt + Up/Down to adjust height
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const increment = e.shiftKey ? 50 : 25; // Shift for larger increments
        const newHeight = e.key === 'ArrowUp' 
          ? historyPaneHeight + increment 
          : historyPaneHeight - increment;
        setCustomHeight(newHeight);
      }
      
      // Alt + R to reset height
      if (e.altKey && e.key === 'r') {
        e.preventDefault();
        resetHeight();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHistoryCollapsed, historyPaneHeight, setCustomHeight, resetHeight]);

  useEffect(() => {
    if (toolResult) {
      // Only expand if collapsed, but don't reset the height
      setIsHistoryCollapsed(false);
    }
  }, [toolResult]);

  useEffect(() => {
    if (clientLogs.length > 0) {
      const isLastError = clientLogs[clientLogs.length - 1].level === "error";
      if (isLastError) {
        // Only expand if collapsed, but don't reset the height
        setIsHistoryCollapsed(false);
      }
    }
  }, [clientLogs]);

  return (
    <div
      className={`relative bg-gradient-to-r from-card/95 via-card to-card/95 backdrop-blur-md border-t border-border/30 transition-all duration-500 ease-out ${
        isHistoryCollapsed
          ? "shadow-lg shadow-black/5"
          : "shadow-2xl shadow-black/10"
      }`}
      style={{
        height: `${isHistoryCollapsed ? 60 : historyPaneHeight}px`,
      }}
    >
      {/* Enhanced Drag Handle */}
      <div
        className={`absolute w-full h-3 -top-1.5 cursor-row-resize group flex items-center justify-center ${
          isDragging ? "bg-primary/20" : "hover:bg-border/20"
        } transition-all duration-200`}
        onMouseDown={handleDragStart}
        onDoubleClick={handleDoubleClick}
        title="Drag to resize • Double-click to reset • Alt+↑/↓ to adjust • Alt+R to reset"
      >
        <div className={`flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${isDragging ? "opacity-100" : ""}`}>
          <GripHorizontal className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>

      {/* Visual indicator line */}
      <div 
        className={`absolute w-full h-0.5 -top-0.5 transition-all duration-200 ${
          isDragging ? "bg-primary" : "bg-border/50"
        }`} 
      />

      {/* Content */}
      <div className="h-full overflow-hidden">
        {!isHistoryCollapsed ? (
          <TabbedHistoryPanel
            requestHistory={requestHistory}
            toolResult={toolResult}
            clientLogs={clientLogs}
            onClearHistory={onClearHistory}
            onClearLogs={onClearLogs}
            onToggleCollapse={toggleCollapse}
          />
        ) : (
          <div
            className="h-full flex items-center justify-center bg-gradient-to-r from-muted/20 via-muted/30 to-muted/20 cursor-pointer hover:bg-gradient-to-r hover:from-muted/30 hover:via-muted/40 hover:to-muted/30 transition-all duration-200"
            onClick={toggleCollapse}
          >
            <div className="flex items-center space-x-4 text-muted-foreground">
              <History className="w-5 h-5" />
              <span className="text-sm font-medium">History & Results</span>
              {requestHistory.length > 0 && (
                <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">
                  {requestHistory.length}
                </span>
              )}
              {clientLogs.length > 0 && (
                <span className="px-2 py-1 text-xs bg-blue-500/10 text-blue-500 rounded-full">
                  {clientLogs.length}
                </span>
              )}
              <ChevronDown className="w-4 h-4 rotate-180" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryAndNotifications;