/**
 * Database utilities for MCPJam Inspector
 * Basic utilities for local SQLite database setup
 */

import { mkdir, access } from 'fs/promises';
import { dirname } from 'path';
import { homedir } from 'os';
import { join } from 'path';

/**
 * Ensures the .mcpjam directory exists in the user's home directory
 */
export async function ensureMCPJamDirectory(): Promise<string> {
  const mcpjamDir = join(homedir(), '.mcpjam');
  
  try {
    await access(mcpjamDir);
  } catch {
    // Directory doesn't exist, create it
    await mkdir(mcpjamDir, { recursive: true });
    console.log(`📁 Created MCPJam directory: ${mcpjamDir}`);
  }
  
  return mcpjamDir;
}

/**
 * Ensures the directory for a given file path exists
 */
export async function ensureDirectoryExists(filePath: string): Promise<void> {
  const dir = dirname(filePath);
  try {
    await access(dir);
  } catch {
    await mkdir(dir, { recursive: true });
  }
}

/**
 * Gets the default database path
 */
export function getDefaultDatabasePath(): string {
  return join(homedir(), '.mcpjam', 'data.db');
}

/**
 * Environment configuration helper
 */
export function getDatabaseConfig() {
  return {
    localPath: process.env.MCPJAM_DB_PATH || getDefaultDatabasePath()
  };
}

/**
 * Checks if the database file exists
 */
export async function databaseExists(databasePath: string): Promise<boolean> {
  try {
    await access(databasePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Database connection test
 */
export async function testDatabaseConnection(config: any): Promise<{ success: boolean; error?: string }> {
  try {
    const { createClient } = await import('@libsql/client');
    
    await ensureDirectoryExists(config.localPath);
    const client = createClient({
      url: `file:${config.localPath}`
    });

    // Test the connection with a simple query
    await client.execute('SELECT 1');
    client.close();
    
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}