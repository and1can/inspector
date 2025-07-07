/**
 * DatabaseManager - Comprehensive libSQL database manager for MCPJam Inspector
 * Supports both existing functionality and future testing framework features
 */

import { createClient, Client as LibSQLClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ensureDirectoryExists, ensureMCPJamDirectory, getDefaultDatabasePath } from './utils.js';
import {
  DatabaseConfig,
  ServerConfig,
  RequestHistory,
  UserPreferences,
  ProviderConfig,
  AppSetting,
  Session,
  TestResult,
  TestConfiguration,
  TestRun,
  JudgeEvaluation,
  TestMetrics,
  ServerConfigFilter,
  RequestHistoryFilter,
  TestResultFilter,
  TestRunFilter,
  AnalyticsOptions,
  TestAnalytics,
  EvaluationStats,
  LocalStorageData,
  DatabaseError,
  QueryError,
  MigrationError
} from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class DatabaseManager {
  private client: LibSQLClient;
  private initialized = false;

  constructor(private config: DatabaseConfig) {
    this.client = this.createClient();
  }

  private createClient(): LibSQLClient {
    if (this.config.url && this.config.authToken) {
      // Remote Turso database
      return createClient({
        url: this.config.url,
        authToken: this.config.authToken,
        syncUrl: this.config.syncUrl,
        syncInterval: this.config.syncInterval
      });
    } else {
      // Local SQLite database
      const dbPath = this.config.localPath || getDefaultDatabasePath();
      return createClient({
        url: `file:${dbPath}`
      });
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('🔄 Initializing database...');
      
      // Ensure .mcpjam directory exists for local databases
      if (!this.config.url) {
        await ensureMCPJamDirectory();
        const dbPath = this.config.localPath || getDefaultDatabasePath();
        await ensureDirectoryExists(dbPath);
      }
      
      // Read and execute schema
      const schemaPath = join(__dirname, 'schema.sql');
      const schema = readFileSync(schemaPath, 'utf-8');
      
      await this.client.executeMultiple(schema);
      
      // Initialize default user preferences if not exists
      await this.ensureDefaultUserPreferences();
      
      this.initialized = true;
      console.log('✅ Database initialized successfully');
    } catch (error) {
      throw new DatabaseError('Failed to initialize database', 'INIT_ERROR', error as Error);
    }
  }

  // ============================================================================
  // SERVER CONFIGURATIONS
  // ============================================================================

  async storeServerConfig(config: Omit<ServerConfig, 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<void> {
    try {
      await this.client.execute({
        sql: `INSERT OR REPLACE INTO server_configs 
              (id, name, description, command, args, env, transport_type, url, last_used_at, usage_count)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT usage_count FROM server_configs WHERE id = ?), 0))`,
        args: [
          config.id,
          config.name,
          config.description || null,
          config.command || null,
          config.args ? JSON.stringify(config.args) : null,
          config.env ? JSON.stringify(config.env) : null,
          config.transportType,
          config.url || null,
          config.lastUsedAt?.toISOString() || null,
          config.id // For the COALESCE subquery
        ]
      });
    } catch (error) {
      throw new QueryError('Failed to store server config', undefined, error as Error);
    }
  }

  async getServerConfig(id: string): Promise<ServerConfig | null> {
    try {
      const result = await this.client.execute({
        sql: 'SELECT * FROM server_configs WHERE id = ?',
        args: [id]
      });

      if (result.rows.length === 0) return null;
      return this.rowToServerConfig(result.rows[0]);
    } catch (error) {
      throw new QueryError('Failed to get server config', undefined, error as Error);
    }
  }

  async getServerConfigs(filter: ServerConfigFilter = {}): Promise<ServerConfig[]> {
    try {
      let sql = 'SELECT * FROM server_configs WHERE 1=1';
      const args: any[] = [];

      if (filter.name) {
        sql += ' AND name LIKE ?';
        args.push(`%${filter.name}%`);
      }

      if (filter.transportType) {
        sql += ' AND transport_type = ?';
        args.push(filter.transportType);
      }

      if (filter.since) {
        sql += ' AND created_at >= ?';
        args.push(filter.since.toISOString());
      }

      sql += ` ORDER BY ${filter.orderBy || 'name'} ${filter.orderDirection || 'ASC'}`;

      if (filter.limit) {
        sql += ' LIMIT ?';
        args.push(filter.limit);
      }

      if (filter.offset) {
        sql += ' OFFSET ?';
        args.push(filter.offset);
      }

      const result = await this.client.execute({ sql, args });
      return result.rows.map(row => this.rowToServerConfig(row));
    } catch (error) {
      throw new QueryError('Failed to get server configs', undefined, error as Error);
    }
  }

  async updateServerConfigUsage(id: string): Promise<void> {
    try {
      await this.client.execute({
        sql: 'UPDATE server_configs SET last_used_at = CURRENT_TIMESTAMP, usage_count = usage_count + 1 WHERE id = ?',
        args: [id]
      });
    } catch (error) {
      throw new QueryError('Failed to update server config usage', undefined, error as Error);
    }
  }

  async deleteServerConfig(id: string): Promise<void> {
    try {
      await this.client.execute({
        sql: 'DELETE FROM server_configs WHERE id = ?',
        args: [id]
      });
    } catch (error) {
      throw new QueryError('Failed to delete server config', undefined, error as Error);
    }
  }

  // ============================================================================
  // REQUEST HISTORY
  // ============================================================================

  async storeRequestHistory(request: Omit<RequestHistory, 'createdAt'>): Promise<void> {
    try {
      await this.client.execute({
        sql: `INSERT INTO request_history 
              (id, server_id, request_type, request_name, request_data, response_data, 
               success, error_message, duration_ms, is_favorite, tags)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          request.id,
          request.serverId || null,
          request.requestType,
          request.requestName,
          JSON.stringify(request.requestData),
          request.responseData ? JSON.stringify(request.responseData) : null,
          request.success ? 1 : 0,
          request.errorMessage || null,
          request.durationMs || null,
          request.isFavorite ? 1 : 0,
          request.tags ? JSON.stringify(request.tags) : null
        ]
      });
    } catch (error) {
      throw new QueryError('Failed to store request history', undefined, error as Error);
    }
  }

  async getRequestHistory(filter: RequestHistoryFilter = {}): Promise<RequestHistory[]> {
    try {
      let sql = 'SELECT * FROM request_history WHERE 1=1';
      const args: any[] = [];

      if (filter.serverId) {
        sql += ' AND server_id = ?';
        args.push(filter.serverId);
      }

      if (filter.requestType) {
        sql += ' AND request_type = ?';
        args.push(filter.requestType);
      }

      if (filter.success !== undefined) {
        sql += ' AND success = ?';
        args.push(filter.success ? 1 : 0);
      }

      if (filter.isFavorite) {
        sql += ' AND is_favorite = 1';
      }

      if (filter.since) {
        sql += ' AND created_at >= ?';
        args.push(filter.since.toISOString());
      }

      if (filter.tags && filter.tags.length > 0) {
        const tagConditions = filter.tags.map(() => 
          'EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?)'
        ).join(' AND ');
        sql += ` AND (${tagConditions})`;
        args.push(...filter.tags);
      }

      sql += ` ORDER BY ${filter.orderBy || 'created_at'} ${filter.orderDirection || 'DESC'}`;

      if (filter.limit) {
        sql += ' LIMIT ?';
        args.push(filter.limit);
      }

      if (filter.offset) {
        sql += ' OFFSET ?';
        args.push(filter.offset);
      }

      const result = await this.client.execute({ sql, args });
      return result.rows.map(row => this.rowToRequestHistory(row));
    } catch (error) {
      throw new QueryError('Failed to get request history', undefined, error as Error);
    }
  }

  async toggleRequestFavorite(id: string): Promise<void> {
    try {
      await this.client.execute({
        sql: 'UPDATE request_history SET is_favorite = NOT is_favorite WHERE id = ?',
        args: [id]
      });
    } catch (error) {
      throw new QueryError('Failed to toggle request favorite', undefined, error as Error);
    }
  }

  // ============================================================================
  // USER PREFERENCES
  // ============================================================================

  async getUserPreferences(): Promise<UserPreferences> {
    try {
      const result = await this.client.execute({
        sql: 'SELECT * FROM user_preferences WHERE id = ?',
        args: ['default']
      });

      if (result.rows.length === 0) {
        return this.getDefaultUserPreferences();
      }

      return this.rowToUserPreferences(result.rows[0]);
    } catch (error) {
      throw new QueryError('Failed to get user preferences', undefined, error as Error);
    }
  }

  async updateUserPreferences(preferences: Partial<UserPreferences>): Promise<void> {
    try {
      const current = await this.getUserPreferences();
      const updated = { ...current, ...preferences };

      await this.client.execute({
        sql: `INSERT OR REPLACE INTO user_preferences 
              (id, theme, default_timeout, auto_save_requests, show_request_details, layout_preferences)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          'default',
          updated.theme,
          updated.defaultTimeout,
          updated.autoSaveRequests ? 1 : 0,
          updated.showRequestDetails ? 1 : 0,
          JSON.stringify(updated.layoutPreferences)
        ]
      });
    } catch (error) {
      throw new QueryError('Failed to update user preferences', undefined, error as Error);
    }
  }

  // ============================================================================
  // PROVIDER CONFIGURATIONS
  // ============================================================================

  async storeProviderConfig(config: Omit<ProviderConfig, 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
      await this.client.execute({
        sql: `INSERT OR REPLACE INTO provider_configs 
              (id, provider_type, name, api_key, base_url, model, max_tokens, temperature, timeout, is_default)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          config.id,
          config.providerType,
          config.name,
          config.apiKey || null,
          config.baseUrl || null,
          config.model || null,
          config.maxTokens || null,
          config.temperature || null,
          config.timeout || null,
          config.isDefault ? 1 : 0
        ]
      });
    } catch (error) {
      throw new QueryError('Failed to store provider config', undefined, error as Error);
    }
  }

  async getProviderConfigs(providerType?: string): Promise<ProviderConfig[]> {
    try {
      let sql = 'SELECT * FROM provider_configs';
      const args: any[] = [];

      if (providerType) {
        sql += ' WHERE provider_type = ?';
        args.push(providerType);
      }

      sql += ' ORDER BY provider_type, name';

      const result = await this.client.execute({ sql, args });
      return result.rows.map(row => this.rowToProviderConfig(row));
    } catch (error) {
      throw new QueryError('Failed to get provider configs', undefined, error as Error);
    }
  }

  // ============================================================================
  // APP SETTINGS
  // ============================================================================

  async getAppSetting(key: string): Promise<any> {
    try {
      const result = await this.client.execute({
        sql: 'SELECT value FROM app_settings WHERE key = ?',
        args: [key]
      });

      if (result.rows.length === 0) return null;
      return JSON.parse(result.rows[0].value as string);
    } catch (error) {
      throw new QueryError('Failed to get app setting', undefined, error as Error);
    }
  }

  async setAppSetting(key: string, value: any, description?: string, category?: string): Promise<void> {
    try {
      await this.client.execute({
        sql: `INSERT OR REPLACE INTO app_settings (key, value, description, category)
              VALUES (?, ?, ?, ?)`,
        args: [key, JSON.stringify(value), description || null, category || null]
      });
    } catch (error) {
      throw new QueryError('Failed to set app setting', undefined, error as Error);
    }
  }

  // ============================================================================
  // TESTING FRAMEWORK METHODS (Future Features)
  // ============================================================================

  async storeTestResult(result: TestResult): Promise<void> {
    try {
      await this.client.execute({
        sql: `INSERT INTO test_results 
              (id, test_name, test_description, prompt, expected_tools, actual_tools,
               duration_ms, success, error_message, server_configs, judge_verdict,
               judge_provider, judge_model, judge_confidence, completed_at,
               test_suite, tags, metadata)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          result.id,
          result.testCase.name,
          result.testCase.description || null,
          result.testCase.prompt,
          JSON.stringify(result.testCase.expectedTools || []),
          JSON.stringify(result.toolCalls),
          result.duration,
          result.success ? 1 : 0,
          result.error || null,
          JSON.stringify(result.testCase.serverConfigs),
          result.verdict ? JSON.stringify(result.verdict) : null,
          result.verdict?.provider || null,
          result.verdict?.model || null,
          result.verdict?.confidence || null,
          result.timestamp.toISOString(),
          result.testCase.testSuite || null,
          JSON.stringify(result.testCase.tags || []),
          JSON.stringify(result.metadata || {})
        ]
      });
    } catch (error) {
      throw new QueryError('Failed to store test result', undefined, error as Error);
    }
  }

  async getTestResults(filter: TestResultFilter = {}): Promise<TestResult[]> {
    try {
      let sql = 'SELECT * FROM test_results WHERE 1=1';
      const args: any[] = [];

      if (filter.testName) {
        sql += ' AND test_name LIKE ?';
        args.push(`%${filter.testName}%`);
      }

      if (filter.success !== undefined) {
        sql += ' AND success = ?';
        args.push(filter.success ? 1 : 0);
      }

      if (filter.testSuite) {
        sql += ' AND test_suite = ?';
        args.push(filter.testSuite);
      }

      if (filter.since) {
        sql += ' AND created_at >= ?';
        args.push(filter.since.toISOString());
      }

      if (filter.hasJudgeVerdict !== undefined) {
        sql += filter.hasJudgeVerdict ? ' AND judge_verdict IS NOT NULL' : ' AND judge_verdict IS NULL';
      }

      sql += ` ORDER BY ${filter.orderBy || 'created_at'} ${filter.orderDirection || 'DESC'}`;

      if (filter.limit) {
        sql += ' LIMIT ?';
        args.push(filter.limit);
      }

      if (filter.offset) {
        sql += ' OFFSET ?';
        args.push(filter.offset);
      }

      const result = await this.client.execute({ sql, args });
      return result.rows.map(row => this.rowToTestResult(row));
    } catch (error) {
      throw new QueryError('Failed to get test results', undefined, error as Error);
    }
  }

  async getTestAnalytics(options: AnalyticsOptions = {}): Promise<TestAnalytics[]> {
    try {
      let sql = `
        SELECT 
          COUNT(*) as total_tests,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as passed_tests,
          SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_tests,
          ROUND(AVG(duration_ms), 2) as avg_duration,
          MIN(duration_ms) as min_duration,
          MAX(duration_ms) as max_duration,
          DATE(created_at) as test_date
        FROM test_results
        WHERE 1=1`;
      
      const args: any[] = [];

      if (options.timeRange) {
        sql += ' AND created_at BETWEEN ? AND ?';
        args.push(options.timeRange.start.toISOString());
        args.push(options.timeRange.end.toISOString());
      }

      if (options.testSuite) {
        sql += ' AND test_suite = ?';
        args.push(options.testSuite);
      }

      if (options.groupBy) {
        sql += ' GROUP BY DATE(created_at)';
      }

      sql += ' ORDER BY test_date DESC';

      const result = await this.client.execute({ sql, args });
      return result.rows.map(row => ({
        totalTests: Number(row.total_tests),
        passedTests: Number(row.passed_tests),
        failedTests: Number(row.failed_tests),
        passRate: Number(row.passed_tests) / Number(row.total_tests),
        avgDuration: Number(row.avg_duration),
        minDuration: Number(row.min_duration),
        maxDuration: Number(row.max_duration),
        testDate: row.test_date as string
      }));
    } catch (error) {
      throw new QueryError('Failed to get test analytics', undefined, error as Error);
    }
  }

  // ============================================================================
  // MIGRATION AND UTILITY METHODS
  // ============================================================================

  async migrateFromLocalStorage(data: LocalStorageData): Promise<void> {
    try {
      console.log('Starting migration from localStorage...');

      // Migrate server configs
      if (data.serverConfigs) {
        for (const config of data.serverConfigs) {
          await this.storeServerConfig({
            id: config.id || this.generateId(),
            name: config.name,
            description: config.description,
            command: config.command,
            args: config.args,
            env: config.env,
            transportType: config.transportType || 'stdio',
            url: config.url,
            lastUsedAt: config.lastUsedAt ? new Date(config.lastUsedAt) : undefined
          });
        }
      }

      // Migrate request history
      if (data.requestHistory) {
        for (const request of data.requestHistory) {
          await this.storeRequestHistory({
            id: request.id || this.generateId(),
            serverId: request.serverId,
            requestType: request.requestType || 'tool',
            requestName: request.requestName,
            requestData: request.requestData || {},
            responseData: request.responseData,
            success: request.success !== false,
            errorMessage: request.errorMessage,
            durationMs: request.durationMs,
            isFavorite: request.isFavorite || false,
            tags: request.tags
          });
        }
      }

      // Migrate user preferences
      if (data.userPreferences) {
        await this.updateUserPreferences({
          theme: data.userPreferences.theme || 'system',
          defaultTimeout: data.userPreferences.defaultTimeout || 30000,
          autoSaveRequests: data.userPreferences.autoSaveRequests !== false,
          showRequestDetails: data.userPreferences.showRequestDetails !== false,
          layoutPreferences: data.userPreferences.layoutPreferences || {}
        });
      }

      // Migrate provider configs
      if (data.providerConfigs) {
        for (const config of data.providerConfigs) {
          await this.storeProviderConfig({
            id: config.id || this.generateId(),
            providerType: config.providerType,
            name: config.name,
            apiKey: config.apiKey,
            baseUrl: config.baseUrl,
            model: config.model,
            maxTokens: config.maxTokens,
            temperature: config.temperature,
            timeout: config.timeout,
            isDefault: config.isDefault || false
          });
        }
      }

      // Migrate app settings
      if (data.appSettings) {
        for (const [key, value] of Object.entries(data.appSettings)) {
          await this.setAppSetting(key, value);
        }
      }

      console.log('Migration from localStorage completed successfully');
    } catch (error) {
      throw new MigrationError('Failed to migrate from localStorage', undefined, error as Error);
    }
  }

  private async ensureDefaultUserPreferences(): Promise<void> {
    const existing = await this.client.execute({
      sql: 'SELECT id FROM user_preferences WHERE id = ?',
      args: ['default']
    });

    if (existing.rows.length === 0) {
      const defaults = this.getDefaultUserPreferences();
      await this.updateUserPreferences(defaults);
    }
  }

  private getDefaultUserPreferences(): UserPreferences {
    return {
      id: 'default',
      theme: 'system',
      defaultTimeout: 30000,
      autoSaveRequests: true,
      showRequestDetails: true,
      layoutPreferences: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // ============================================================================
  // ROW MAPPING METHODS
  // ============================================================================

  private rowToServerConfig(row: any): ServerConfig {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      command: row.command,
      args: row.args ? JSON.parse(row.args) : undefined,
      env: row.env ? JSON.parse(row.env) : undefined,
      transportType: row.transport_type,
      url: row.url,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at) : undefined,
      usageCount: row.usage_count
    };
  }

  private rowToRequestHistory(row: any): RequestHistory {
    return {
      id: row.id,
      serverId: row.server_id,
      requestType: row.request_type,
      requestName: row.request_name,
      requestData: JSON.parse(row.request_data),
      responseData: row.response_data ? JSON.parse(row.response_data) : undefined,
      success: row.success === 1,
      errorMessage: row.error_message,
      durationMs: row.duration_ms,
      createdAt: new Date(row.created_at),
      isFavorite: row.is_favorite === 1,
      tags: row.tags ? JSON.parse(row.tags) : undefined
    };
  }

  private rowToUserPreferences(row: any): UserPreferences {
    return {
      id: row.id,
      theme: row.theme,
      defaultTimeout: row.default_timeout,
      autoSaveRequests: row.auto_save_requests === 1,
      showRequestDetails: row.show_request_details === 1,
      layoutPreferences: JSON.parse(row.layout_preferences),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private rowToProviderConfig(row: any): ProviderConfig {
    return {
      id: row.id,
      providerType: row.provider_type,
      name: row.name,
      apiKey: row.api_key,
      baseUrl: row.base_url,
      model: row.model,
      maxTokens: row.max_tokens,
      temperature: row.temperature,
      timeout: row.timeout,
      isDefault: row.is_default === 1,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private rowToTestResult(row: any): TestResult {
    return {
      id: row.id,
      testCase: {
        id: row.id,
        name: row.test_name,
        description: row.test_description,
        prompt: row.prompt,
        expectedTools: JSON.parse(row.expected_tools || '[]'),
        serverConfigs: JSON.parse(row.server_configs),
        testSuite: row.test_suite,
        tags: JSON.parse(row.tags || '[]')
      },
      toolCalls: JSON.parse(row.actual_tools || '[]'),
      verdict: row.judge_verdict ? JSON.parse(row.judge_verdict) : undefined,
      duration: row.duration_ms,
      success: row.success === 1,
      error: row.error_message,
      timestamp: new Date(row.created_at),
      metadata: JSON.parse(row.metadata || '{}')
    };
  }

  async close(): Promise<void> {
    if (this.client) {
      this.client.close();
    }
  }
}