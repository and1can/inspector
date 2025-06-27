import React from "react";

export const LoadingDots: React.FC = () => (
  <div className="flex items-center space-x-1 py-2">
    <div className="flex space-x-1">
      <div className="w-1 h-1 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
      <div className="w-1 h-1 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
      <div className="w-1 h-1 bg-muted-foreground/40 rounded-full animate-bounce"></div>
    </div>
  </div>
);