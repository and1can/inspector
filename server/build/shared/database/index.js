/**
 * Shared database exports
 */
// Export main database class and utilities
export { MCPJamDatabase, database, initializeDatabase, closeDatabase } from './database.js';
// Export migration utilities
export { DatabaseMigrator, migrator, createMigrator } from './migration.js';
// Export all types
export * from './types.js';
// Export schema path for programmatic access
export const SCHEMA_PATH = './schema.sql';
