import { r as reactExports, S as SESSION_KEYS, p as parseOAuthCallbackParams, j as jsxRuntimeExports, g as generateOAuthErrorDescription } from "./index-BT03cD-1.js";
const OAuthDebugCallback = ({ onConnect }) => {
  reactExports.useEffect(() => {
    let isProcessed = false;
    const handleCallback = async () => {
      if (isProcessed) {
        return;
      }
      isProcessed = true;
      const params = parseOAuthCallbackParams(window.location.search);
      if (!params.successful) {
        const errorMsg = generateOAuthErrorDescription(params);
        onConnect({ errorMsg });
        return;
      }
      const serverUrl = sessionStorage.getItem(SESSION_KEYS.SERVER_URL);
      if (!serverUrl) {
        return;
      }
      if (!params.code) {
        onConnect({ errorMsg: "Missing authorization code" });
        return;
      }
      onConnect({ authorizationCode: params.code });
    };
    handleCallback().finally(() => {
      if (sessionStorage.getItem(SESSION_KEYS.SERVER_URL)) {
        window.history.replaceState({}, document.title, "/");
      }
    });
    return () => {
      isProcessed = true;
    };
  }, [onConnect]);
  const callbackParams = parseOAuthCallbackParams(window.location.search);
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center justify-center h-screen", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-4 p-4 bg-secondary rounded-md max-w-md", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mb-2 text-sm", children: "Please copy this authorization code and return to the Auth Debugger:" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("code", { className: "block p-2 bg-muted rounded-sm overflow-x-auto text-xs", children: callbackParams.successful && "code" in callbackParams ? callbackParams.code : `No code found: ${callbackParams.error}, ${callbackParams.error_description}` }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-4 text-xs text-muted-foreground", children: "Close this tab and paste the code in the OAuth flow to complete authentication." })
  ] }) });
};
export {
  OAuthDebugCallback as default
};
