import { randomUUID } from "crypto";
export function generateSessionId() {
    return randomUUID();
}
export function validateServerConfig(config) {
    if (!config.id || !config.type || !config.name) {
        throw new Error("Invalid server configuration: id, type, and name are required");
    }
    if (config.type === "stdio" && !config.command) {
        throw new Error("STDIO transport requires command");
    }
    if ((config.type === "sse" || config.type === "streamable-http") &&
        !config.url) {
        throw new Error("SSE and StreamableHTTP transports require URL");
    }
}
export class ConsoleLogger {
    info(message, ...args) {
        console.log(`[INFO] ${message}`, ...args);
    }
    error(message, ...args) {
        console.error(`[ERROR] ${message}`, ...args);
    }
    warn(message, ...args) {
        console.warn(`[WARN] ${message}`, ...args);
    }
}
