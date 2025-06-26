import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Eye,
  EyeOff,
  Key,
  CheckCircle,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { SupportedProvider } from "@/lib/providers";
import { ApiKeyData, ProviderConfig } from "@/components/settings/types";

interface ProviderSectionProps {
  providerName: SupportedProvider;
  config: ProviderConfig;
  keyData: ApiKeyData;
  isCollapsed: boolean;
  disabled?: boolean;
  onApiKeyChange: (providerName: SupportedProvider, value: string) => void;
  onClearApiKey: (providerName: SupportedProvider) => void;
  onToggleShowKey: (providerName: SupportedProvider) => void;
  onToggleCollapse: (providerName: SupportedProvider) => void;
}

const ProviderSection: React.FC<ProviderSectionProps> = ({
  providerName,
  config,
  keyData,
  isCollapsed,
  disabled = false,
  onApiKeyChange,
  onClearApiKey,
  onToggleShowKey,
  onToggleCollapse,
}) => {
  // Collapsed view
  if (isCollapsed) {
    return (
      <div
        key={providerName}
        className="p-3 bg-green-50/80 dark:bg-green-900/20 backdrop-blur-sm rounded-lg border border-green-200/60 dark:border-green-700/60 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-green-600 dark:text-green-400" />
            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              {config.displayName} API Key Configured
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleCollapse(providerName)}
              disabled={disabled}
              className="h-7 px-2 text-green-700 dark:text-green-300 hover:bg-green-100/50 dark:hover:bg-green-800/30"
            >
              <ChevronRight className="w-4 h-4" />
              <span className="ml-1 text-xs">Manage</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Expanded view
  return (
    <div
      key={providerName}
      className="p-4 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-xl border border-slate-200/60 dark:border-slate-700/60 shadow-lg"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            {config.displayName}
          </h3>
          {keyData.isValid && (
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          )}
          {keyData.key.length > 0 && !keyData.isValid && (
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          )}
        </div>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
        {config.description}
      </p>

      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Input
              type={keyData.showKey ? "text" : "password"}
              placeholder={config.placeholder}
              value={keyData.key}
              onChange={(e) => onApiKeyChange(providerName, e.target.value)}
              disabled={disabled}
              className={`font-mono pr-10 ${
                keyData.key.length > 0
                  ? keyData.isValid
                    ? "border-green-500 dark:border-green-400"
                    : "border-red-500 dark:border-red-400"
                  : ""
              }`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8"
              onClick={() => onToggleShowKey(providerName)}
              disabled={disabled}
            >
              {keyData.showKey ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
          {keyData.key.length > 0 && (
            <Button
              variant="outline"
              onClick={() => onClearApiKey(providerName)}
              disabled={disabled}
              className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-slate-300/60 dark:border-slate-600/60 hover:border-red-400/60 dark:hover:border-red-500/60 hover:bg-red-50/80 dark:hover:bg-red-900/20"
            >
              Clear
            </Button>
          )}
        </div>

        {keyData.key.length > 0 && !keyData.isValid && (
          <p className="text-sm text-red-600 dark:text-red-400">
            Please enter a valid {config.displayName} API key with the correct
            format
          </p>
        )}

        {!keyData.key.length && (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Enter your {config.displayName} API key to enable related
            functionality. Your key will be securely stored in your browser's
            local storage.
          </p>
        )}

        {keyData.isValid && (
          <p className="text-sm text-green-600 dark:text-green-400">
            ✓ Valid {config.displayName} API key configured.
          </p>
        )}
      </div>
    </div>
  );
};

export default ProviderSection;
