import React, { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

export const OllamaSetupGuide: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  const setupSteps = [
    {
      title: "Download Ollama",
      description: "Get the Ollama installer for your operating system",
      link: "https://ollama.com/download",
      linkText: "ollama.com/download",
    },
    {
      title: "Pull a Tool-Calling Model",
      description: "Download a model that supports function calling",
      command: "ollama pull llama3.1:8b",
    },
    {
      title: "Start Ollama Service",
      description: "Run Ollama in your terminal or start the desktop app",
      command: "ollama serve",
    },
    {
      title: "Verify Setup",
      description: "Check that Ollama is running and models are available",
      command: "ollama list",
    },
  ];

  return (
    <div className="pt-2 w-full max-w-lg mt-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors border border-blue-200 dark:border-blue-800"
      >
        <div className="flex items-center space-x-2">
          <span className="text-blue-900 dark:text-blue-100">
            How do I setup Ollama?
          </span>
        </div>
        {isExpanded ? (
          <ChevronDownIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        ) : (
          <ChevronRightIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-2 p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
            Follow these steps to get Ollama running with tool-calling support:
          </p>

          {setupSteps.map((step, index) => (
            <div key={index} className="flex space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  {index + 1}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {step.title}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {step.description}
                </p>
                {step.link && (
                  <a
                    href={step.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex space-x-1 text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
                  >
                    <span>{step.linkText}</span>
                  </a>
                )}

                {step.command && (
                  <div className="mt-2">
                    <code className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 rounded text-slate-800 dark:text-slate-200 font-mono">
                      {step.command}
                    </code>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
