import { useEffect } from "react";
import { useServerState } from "../useServerState";

// Local Storage Persistence Hook
export const useLocalStoragePersistence = (
  serverState: ReturnType<typeof useServerState>,
) => {
  useEffect(() => {
    const currentConfig =
      serverState.serverConfigs[serverState.selectedServerName];
    if (
      currentConfig?.transportType === "stdio" &&
      "command" in currentConfig
    ) {
      localStorage.setItem("lastCommand", currentConfig.command || "");
    }
  }, [serverState.serverConfigs, serverState.selectedServerName]);

  useEffect(() => {
    const currentConfig =
      serverState.serverConfigs[serverState.selectedServerName];
    if (currentConfig?.transportType === "stdio" && "args" in currentConfig) {
      localStorage.setItem("lastArgs", currentConfig.args?.join(" ") || "");
    }
  }, [serverState.serverConfigs, serverState.selectedServerName]);

  useEffect(() => {
    const currentConfig =
      serverState.serverConfigs[serverState.selectedServerName];
    if (currentConfig && "url" in currentConfig && currentConfig.url) {
      localStorage.setItem("lastSseUrl", currentConfig.url.toString());
    }
  }, [serverState.serverConfigs, serverState.selectedServerName]);

  useEffect(() => {
    localStorage.setItem(
      "lastTransportType",
      serverState.serverConfigs[serverState.selectedServerName]
        ?.transportType || "",
    );
  }, [serverState.serverConfigs, serverState.selectedServerName]);
};
