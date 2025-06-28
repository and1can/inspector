import React from "react";
import { ProviderLogo } from "../ProviderLogo";

export const OllamaSetupInstructions: React.FC = () => (
  <div className="flex items-center justify-center h-full p-8">
    <div className="text-center max-w-md space-y-6">
      <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <ProviderLogo
          className="text-slate-600 dark:text-slate-300"
          size={20}
          provider="ollama"
        />
      </div>
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
          Get Started with Ollama
        </h3>
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
            <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">
              📥 Step 1: Download Ollama
            </p>
            <p>
              Visit{" "}
              <a
                href="https://ollama.com/download"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                ollama.com/download
              </a>{" "}
              to install Ollama on your system
            </p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
            <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">
              🔧 Step 2: Pull Tool-Calling Models
            </p>
            <p>
              Browse{" "}
              <a
                href="https://ollama.com/search?c=tools"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                tool-calling models
              </a>{" "}
              and run:{" "}
              <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-xs">
                ollama pull model-name
              </code>
            </p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
            <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">
              🔄 Step 3: Refresh Models
            </p>
            <p>
              Your downloaded models will appear automatically, or click the
              refresh button above
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
);
