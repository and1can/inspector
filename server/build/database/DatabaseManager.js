/**
 * DatabaseManager - Basic libSQL database manager for MCPJam Inspector
 * Simple local SQLite database foundation
 */
import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ensureDirectoryExists, ensureMCPJamDirectory, getResolvedDatabasePath, } from "./utils.js";
import { DatabaseError, QueryError, } from "./types.js";
const __dirname = dirname(fileURLToPath(import.meta.url));
export class DatabaseManager {
    client;
    initialized = false;
    config;
    constructor(config) {
        this.config = config || { localPath: getResolvedDatabasePath() };
        this.client = this.createClient();
    }
    createClient() {
        // Use the configured database path
        const dbPath = this.config.localPath;
        return createClient({
            url: `file:${dbPath}`,
        });
    }
    async initialize() {
        if (this.initialized)
            return;
        try {
            console.log("🔄 Initializing database...");
            // Ensure .mcpjam directory exists and database directory
            await ensureMCPJamDirectory();
            const dbPath = getResolvedDatabasePath();
            await ensureDirectoryExists(dbPath);
            // Read and execute schema
            const schemaPath = join(__dirname, "schema.sql");
            const schema = readFileSync(schemaPath, "utf-8");
            await this.client.executeMultiple(schema);
            this.initialized = true;
            console.log("✅ Database initialized successfully");
        }
        catch (error) {
            throw new DatabaseError("Failed to initialize database", "INIT_ERROR", error);
        }
    }
    // ============================================================================
    // APP METADATA OPERATIONS
    // ============================================================================
    async getMetadata(key) {
        try {
            const result = await this.client.execute({
                sql: "SELECT value FROM app_metadata WHERE key = ?",
                args: [key],
            });
            if (result.rows.length === 0)
                return null;
            return result.rows[0].value;
        }
        catch (error) {
            throw new QueryError("Failed to get metadata", undefined, error);
        }
    }
    async setMetadata(key, value) {
        try {
            await this.client.execute({
                sql: "INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)",
                args: [key, value],
            });
        }
        catch (error) {
            throw new QueryError("Failed to set metadata", undefined, error);
        }
    }
    async getAllMetadata() {
        try {
            const result = await this.client.execute({
                sql: "SELECT * FROM app_metadata ORDER BY key",
                args: [],
            });
            return result.rows.map((row) => ({
                key: row.key,
                value: row.value,
                createdAt: new Date(row.created_at),
                updatedAt: new Date(row.updated_at),
            }));
        }
        catch (error) {
            throw new QueryError("Failed to get all metadata", undefined, error);
        }
    }
    async deleteMetadata(key) {
        try {
            await this.client.execute({
                sql: "DELETE FROM app_metadata WHERE key = ?",
                args: [key],
            });
        }
        catch (error) {
            throw new QueryError("Failed to delete metadata", undefined, error);
        }
    }
    async close() {
        if (this.client) {
            this.client.close();
        }
    }
}
