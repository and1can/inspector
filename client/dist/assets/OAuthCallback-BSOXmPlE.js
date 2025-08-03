import { u as useToast, r as reactExports, S as SESSION_KEYS, j as jsxRuntimeExports, p as parseOAuthCallbackParams, g as generateOAuthErrorDescription, I as InspectorOAuthClientProvider, a as auth } from "./index-BT03cD-1.js";
const OAuthCallback = ({ onConnect }) => {
  const { toast } = useToast();
  const hasProcessedRef = reactExports.useRef(false);
  reactExports.useEffect(() => {
    const handleCallback = async () => {
      if (hasProcessedRef.current) {
        return;
      }
      hasProcessedRef.current = true;
      const notifyError = (description) => void toast({
        title: "OAuth Authorization Error",
        description,
        variant: "destructive"
      });
      const params = parseOAuthCallbackParams(window.location.search);
      if (!params.successful) {
        return notifyError(generateOAuthErrorDescription(params));
      }
      const serverUrl = sessionStorage.getItem(SESSION_KEYS.SERVER_URL);
      if (!serverUrl) {
        return notifyError("Missing Server URL");
      }
      let result;
      try {
        const serverAuthProvider = new InspectorOAuthClientProvider(serverUrl);
        result = await auth(serverAuthProvider, {
          serverUrl,
          authorizationCode: params.code
        });
      } catch (error) {
        console.error("OAuth callback error:", error);
        return notifyError(`Unexpected error occurred: ${error}`);
      }
      if (result !== "AUTHORIZED") {
        return notifyError(
          `Expected to be authorized after providing auth code, got: ${result}`
        );
      }
      toast({
        title: "Success",
        description: "Successfully authenticated with OAuth",
        variant: "default"
      });
      onConnect(serverUrl);
    };
    handleCallback().finally(() => {
      sessionStorage.removeItem(SESSION_KEYS.TRANSPORT_TYPE);
      window.history.replaceState({}, document.title, "/");
    });
  }, [toast, onConnect]);
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center justify-center h-screen", children: /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-lg text-gray-500", children: "Processing OAuth callback..." }) });
};
export {
  OAuthCallback as default
};
