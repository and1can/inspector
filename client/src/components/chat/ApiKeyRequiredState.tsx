import React from "react";
import { Key } from "lucide-react";

export const ApiKeyRequiredState: React.FC = () => (
  <div className="flex items-center justify-center h-full p-8">
    <div className="text-center max-w-sm space-y-4">
      <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <Key className="w-5 h-5 text-slate-400" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
          API Key Required
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Configure your API key to start chatting
        </p>
      </div>
    </div>
  </div>
);
