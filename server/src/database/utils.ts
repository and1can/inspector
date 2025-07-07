/**
 * Database utilities for MCPJam Inspector
 * Includes directory setup, migration helpers, and validation utilities
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
 * Validates localStorage data for migration
 */
export function validateLocalStorageData(data: any): boolean {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Check if any expected properties exist
  const expectedProps = [
    'serverConfigs',
    'requestHistory', 
    'userPreferences',
    'providerConfigs',
    'appSettings',
    'sessions'
  ];

  return expectedProps.some(prop => data.hasOwnProperty(prop));
}

/**
 * Sanitizes data for database storage
 */
export function sanitizeDataForDatabase(data: any): any {
  if (data === null || data === undefined) {
    return null;
  }

  if (typeof data === 'string') {
    return data.trim();
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeDataForDatabase(item));
  }

  if (typeof data === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeDataForDatabase(value);
    }
    return sanitized;
  }

  return data;
}

/**
 * Generates a unique ID for database records
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Validates server configuration data
 */
export function validateServerConfig(config: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.id) errors.push('Missing required field: id');
  if (!config.name) errors.push('Missing required field: name');
  if (!config.transportType) errors.push('Missing required field: transportType');
  
  if (config.transportType && !['stdio', 'sse', 'http'].includes(config.transportType)) {
    errors.push('Invalid transportType. Must be one of: stdio, sse, http');
  }

  if (config.transportType === 'stdio' && !config.command) {
    errors.push('Command is required for stdio transport');
  }

  if (['sse', 'http'].includes(config.transportType) && !config.url) {
    errors.push('URL is required for sse and http transports');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates request history data
 */
export function validateRequestHistory(request: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!request.id) errors.push('Missing required field: id');
  if (!request.requestType) errors.push('Missing required field: requestType');
  if (!request.requestName) errors.push('Missing required field: requestName');
  
  if (request.requestType && !['tool', 'resource', 'prompt'].includes(request.requestType)) {
    errors.push('Invalid requestType. Must be one of: tool, resource, prompt');
  }

  if (request.success === undefined || typeof request.success !== 'boolean') {
    errors.push('Success field must be a boolean');
  }

  if (!request.requestData || typeof request.requestData !== 'object') {
    errors.push('requestData must be an object');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Creates a backup of the database
 */
export async function createDatabaseBackup(databasePath: string): Promise<string> {
  const backupPath = `${databasePath}.backup.${Date.now()}`;
  
  try {
    const { copyFile } = await import('fs/promises');
    await copyFile(databasePath, backupPath);
    console.log(`📦 Database backup created: ${backupPath}`);
    return backupPath;
  } catch (error) {
    console.error('❌ Failed to create database backup:', error);
    throw error;
  }
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
 * Environment configuration helper
 */
export function getDatabaseConfig() {
  return {
    url: process.env.LIBSQL_URL,
    authToken: process.env.LIBSQL_AUTH_TOKEN,
    syncUrl: process.env.LIBSQL_SYNC_URL,
    syncInterval: process.env.LIBSQL_SYNC_INTERVAL ? parseInt(process.env.LIBSQL_SYNC_INTERVAL) : undefined,
    localPath: process.env.MCPJAM_DB_PATH || getDefaultDatabasePath()
  };
}

/**
 * Database connection test
 */
export async function testDatabaseConnection(config: any): Promise<{ success: boolean; error?: string }> {
  try {
    const { createClient } = await import('@libsql/client');
    
    let client;
    if (config.url && config.authToken) {
      client = createClient({
        url: config.url,
        authToken: config.authToken
      });
    } else {
      await ensureDirectoryExists(config.localPath);
      client = createClient({
        url: `file:${config.localPath}`
      });
    }

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