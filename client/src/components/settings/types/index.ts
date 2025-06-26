import { SupportedProvider } from "@/lib/providers";

export interface SettingsTabProps {
  disabled?: boolean;
}

export interface ApiKeyData {
  key: string;
  isValid: boolean;
  showKey: boolean;
}

export interface ApiKeysState {
  anthropic: ApiKeyData;
  openai: ApiKeyData;
  ollama: ApiKeyData;
}

export interface ProviderConfig {
  name: SupportedProvider;
  displayName: string;
  placeholder: string;
  description: string;
}
