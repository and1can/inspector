"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// index.ts
var index_exports = {};
__export(index_exports, {
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_node_server = require("@hono/node-server");
var import_hono2 = require("hono");
var import_cors = require("hono/cors");
var import_logger = require("hono/logger");
var import_serve_static = require("@hono/node-server/serve-static");

// routes/mcp/index.ts
var import_hono = require("hono");
var mcp = new import_hono.Hono();
mcp.get("/health", (c) => {
  return c.json({
    service: "MCP API",
    status: "ready",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
mcp.post("/chat", (c) => {
  return c.json({
    message: "Chat endpoint - will be implemented in Phase 3",
    status: "placeholder"
  });
});
mcp.post("/connect", (c) => {
  return c.json({
    message: "Connect endpoint - will be implemented in Phase 2",
    status: "placeholder"
  });
});
mcp.get("/tools", (c) => {
  return c.json({
    message: "Tools endpoint - will be implemented in Phase 2",
    status: "placeholder",
    tools: []
  });
});
mcp.get("/resources/list", (c) => {
  return c.json({
    message: "Resources list endpoint - will be implemented in Phase 2",
    status: "placeholder",
    resources: []
  });
});
mcp.post("/resources/read", (c) => {
  return c.json({
    message: "Resources read endpoint - will be implemented in Phase 2",
    status: "placeholder"
  });
});
mcp.get("/prompts/list", (c) => {
  return c.json({
    message: "Prompts list endpoint - will be implemented in Phase 2",
    status: "placeholder",
    prompts: []
  });
});
mcp.post("/prompts/get", (c) => {
  return c.json({
    message: "Prompts get endpoint - will be implemented in Phase 2",
    status: "placeholder"
  });
});
var mcp_default = mcp;

// index.ts
var app = new import_hono2.Hono();
app.use("*", (0, import_logger.logger)());
app.use("*", (0, import_cors.cors)({
  origin: ["http://localhost:5173", "http://localhost:3000"],
  credentials: true
}));
app.route("/api/mcp", mcp_default);
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
if (process.env.NODE_ENV === "production") {
  app.use("/*", (0, import_serve_static.serveStatic)({ root: "./dist/client" }));
  app.get("*", (0, import_serve_static.serveStatic)({ path: "./dist/client/index.html" }));
} else {
  app.get("/", (c) => {
    return c.json({
      message: "MCP Inspector API Server",
      environment: "development",
      frontend: "http://localhost:5173"
    });
  });
}
var port = parseInt(process.env.PORT || "3001");
console.log(`\u{1F680} MCP Inspector Server starting on port ${port}`);
console.log(`\u{1F4E1} API available at: http://localhost:${port}/api`);
if (process.env.NODE_ENV !== "production") {
  console.log(`\u{1F3A8} Frontend dev server: http://localhost:5173`);
}
(0, import_node_server.serve)({
  fetch: app.fetch,
  port
});
var index_default = app;
