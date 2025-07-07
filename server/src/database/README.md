# MCPJam Inspector Database Foundation

This directory contains the comprehensive libSQL database foundation for the MCPJam Inspector, supporting both current functionality and future testing framework features.

## Overview

The database layer provides:
- **Persistent storage** for existing functionality (server configs, request history, user preferences)
- **Foundation for future features** including E2E testing framework with LLM judge system
- **Migration support** from localStorage to database
- **Remote database support** via Turso/libSQL
- **Type-safe operations** with comprehensive TypeScript interfaces

## Structure

```
database/
├── DatabaseManager.ts    # Core database management class
├── schema.sql           # Complete database schema
├── types.ts            # TypeScript interfaces and types
├── routes.ts           # Express API routes
├── utils.ts            # Utility functions
├── index.ts            # Module exports
└── README.md           # This file
```

## Quick Start

### Basic Usage

```typescript
import { DatabaseManager, getDatabaseConfig } from './database/index.js';

// Initialize database
const config = getDatabaseConfig();
const db = new DatabaseManager(config);
await db.initialize();

// Store server configuration
await db.storeServerConfig({
  id: 'server-1',
  name: 'My MCP Server',
  transportType: 'stdio',
  command: 'node',
  args: ['server.js']
});

// Get request history
const history = await db.getRequestHistory({
  limit: 10,
  success: true
});
```

### API Endpoints

The database provides REST API endpoints under `/api/db/`:

```bash
# Server configurations
GET    /api/db/server-configs
POST   /api/db/server-configs
GET    /api/db/server-configs/:id
DELETE /api/db/server-configs/:id

# Request history
GET    /api/db/request-history
POST   /api/db/request-history
POST   /api/db/request-history/:id/favorite

# User preferences
GET    /api/db/user-preferences
POST   /api/db/user-preferences

# Provider configurations
GET    /api/db/provider-configs
POST   /api/db/provider-configs

# App settings
GET    /api/db/app-settings/:key
POST   /api/db/app-settings/:key

# Testing framework (future)
GET    /api/db/test-results
POST   /api/db/test-results
GET    /api/db/test-analytics

# Migration
POST   /api/db/migrate-from-localstorage
```

## Configuration

### Environment Variables

```bash
# For remote Turso database
LIBSQL_URL=libsql://your-database.turso.io
LIBSQL_AUTH_TOKEN=your-auth-token
LIBSQL_SYNC_URL=libsql://your-database.turso.io
LIBSQL_SYNC_INTERVAL=5000

# For local database (default)
MCPJAM_DB_PATH=/custom/path/to/data.db
```

### Local Database

By default, the database is stored locally at:
- `~/.mcpjam/data.db` (created automatically)

### Remote Database

To use a remote Turso database:
1. Set `LIBSQL_URL` and `LIBSQL_AUTH_TOKEN`
2. Optionally set sync parameters for embedded replica

## Database Schema

### Current Functionality Tables

- **server_configs**: MCP server configurations
- **request_history**: Tool/resource/prompt request history
- **user_preferences**: Theme, layout, and app preferences  
- **provider_configs**: AI provider (OpenAI, Anthropic, Ollama) configurations
- **app_settings**: Key-value app settings
- **sessions**: User session data

### Future Testing Framework Tables

- **test_results**: E2E test execution results
- **test_configurations**: Reusable test configurations
- **test_runs**: Batch test execution tracking
- **judge_evaluations**: LLM judge evaluation details
- **test_metrics**: Performance and resource metrics

## Migration from localStorage

The database supports automatic migration from existing localStorage data:

```typescript
// Programmatic migration
const localStorageData = {
  serverConfigs: [...],
  requestHistory: [...],
  userPreferences: {...},
  // ...
};

await db.migrateFromLocalStorage(localStorageData);
```

```bash
# API migration
curl -X POST http://localhost:6277/api/db/migrate-from-localstorage \
  -H "Content-Type: application/json" \
  -d '{"serverConfigs": [...], "requestHistory": [...]}'
```

## Type Safety

All database operations are fully typed with TypeScript:

```typescript
import { ServerConfig, RequestHistory, UserPreferences } from './database/types.js';

// Type-safe operations
const config: ServerConfig = await db.getServerConfig('server-1');
const history: RequestHistory[] = await db.getRequestHistory();
const prefs: UserPreferences = await db.getUserPreferences();
```

## Error Handling

The database layer provides custom error types:

```typescript
import { DatabaseError, QueryError, MigrationError } from './database/types.js';

try {
  await db.storeServerConfig(config);
} catch (error) {
  if (error instanceof DatabaseError) {
    console.error('Database error:', error.message, error.code);
  }
}
```

## Future Features

The database foundation is designed to support upcoming testing framework features:

### E2E Testing Framework
- Store test cases and results
- Track test execution metrics
- Support for test suites and configurations

### LLM Judge System
- Multi-provider AI evaluation (OpenAI, Anthropic, Ollama)
- Confidence scoring and reasoning tracking
- Cost and token usage analytics

### Advanced Analytics
- Test success rate trends
- Performance benchmarking
- Comprehensive reporting

## Development

### Adding New Tables

1. Update `schema.sql` with new table definitions
2. Add corresponding TypeScript interfaces in `types.ts`
3. Implement database operations in `DatabaseManager.ts`
4. Add API endpoints in `routes.ts`
5. Update tests and documentation

### Running Tests

```bash
# Run database tests
npm test -- database

# Test with real database
npm run test:integration
```

## Performance Considerations

- **Indexes**: Critical queries have appropriate indexes
- **Connection pooling**: libSQL handles connection management
- **Batch operations**: Support for bulk inserts and updates
- **Pagination**: All list operations support limit/offset
- **Caching**: Consider implementing caching layer for frequently accessed data

## Security

- **Environment variables**: Sensitive credentials via env vars only
- **Input validation**: All inputs validated before database operations
- **SQL injection**: Use parameterized queries exclusively
- **Access control**: API endpoints can be secured with authentication middleware

## Monitoring

The database layer provides:
- Comprehensive error logging
- Performance metrics (execution time, query counts)
- Health check endpoints
- Connection status monitoring

---

This database foundation provides a robust, scalable, and type-safe data layer that supports both current MCPJam Inspector functionality and future advanced features like the E2E testing framework with LLM judge capabilities.