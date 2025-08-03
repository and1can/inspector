/**
 * Database types and interfaces for MCPJam Inspector
 * Basic foundation types for local SQLite database
 */
// ============================================================================
// ERROR TYPES
// ============================================================================
export class DatabaseError extends Error {
    code;
    cause;
    constructor(message, code, cause) {
        super(message);
        this.code = code;
        this.cause = cause;
        this.name = "DatabaseError";
    }
}
export class QueryError extends Error {
    query;
    cause;
    constructor(message, query, cause) {
        super(message);
        this.query = query;
        this.cause = cause;
        this.name = "QueryError";
    }
}
