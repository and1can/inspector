/**
 * Database types and interfaces for MCPJam Inspector
 * Supports both existing functionality and future testing framework features
 */

// ============================================================================
// EXISTING FUNCTIONALITY TYPES
// ============================================================================

export interface ServerConfig {
  id: string;
  name: string;
  description?: string;
  command?: string;
  args?: string[]; // Stored as JSON array
  env?: Record<string, string>; // Stored as JSON object
  transportType: 'stdio' | 'sse' | 'http';
  url?: string;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
  usageCount: number;
}

export interface RequestHistory {
  id: string;
  serverId?: string;
  requestType: 'tool' | 'resource' | 'prompt';
  requestName: string;
  requestData: Record<string, any>; // Stored as JSON object
  responseData?: Record<string, any>; // Stored as JSON object
  success: boolean;
  errorMessage?: string;
  durationMs?: number;
  createdAt: Date;
  isFavorite: boolean;
  tags?: string[]; // Stored as JSON array
}

export interface UserPreferences {
  id: string;
  theme: 'light' | 'dark' | 'system';
  defaultTimeout: number;
  autoSaveRequests: boolean;
  showRequestDetails: boolean;
  layoutPreferences: Record<string, any>; // Stored as JSON object
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderConfig {
  id: string;
  providerType: 'openai' | 'anthropic' | 'ollama';
  name: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppSetting {
  key: string;
  value: any; // Stored as JSON string
  description?: string;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  sessionData: Record<string, any>; // Stored as JSON object
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// TESTING FRAMEWORK TYPES (Phase 4 - Future Features)
// ============================================================================

export interface TestCase {
  id?: string;
  name: string;
  description?: string;
  prompt: string;
  expectedTools?: string[];
  serverConfigs: ServerConfig[];
  timeout?: number;
  testSuite?: string;
  tags?: string[];
  judgeConfig?: JudgeConfig;
}

export interface TestResult {
  id: string;
  testCase: TestCase;
  toolCalls: ToolCall[];
  verdict?: JudgeVerdict;
  duration: number;
  success: boolean;
  error?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ToolCall {
  id: string;
  name: string;
  parameters: Record<string, any>;
  result?: any;
  success: boolean;
  error?: string;
  durationMs: number;
  timestamp: Date;
}

export interface JudgeConfig {
  provider: 'openai' | 'anthropic' | 'ollama';
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface JudgeVerdict {
  passed: boolean;
  confidence: number; // 0-1
  reasoning: string;
  toolAccuracy?: number; // 0-1
  suggestions?: string;
  provider: string;
  model: string;
  tokensUsed?: number;
  apiCostEstimate?: number;
}

export interface JudgeInput {
  prompt: string;
  expectedTools?: string[];
  actualToolCalls: ToolCall[];
  context?: string;
}

export interface TestConfiguration {
  id: string;
  name: string;
  description?: string;
  serverConfigs: ServerConfig[];
  judgeConfig?: JudgeConfig;
  defaultTimeout: number;
  defaultTags: string[];
  isTemplate: boolean;
  templateVariables: Record<string, any>;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
  usageCount: number;
}

export interface TestRun {
  id: string;
  name?: string;
  description?: string;
  configurationId?: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  startedAt: Date;
  completedAt?: Date;
  totalDurationMs?: number;
  parallelExecution: boolean;
  maxConcurrency?: number;
  stopOnFailure: boolean;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  errorMessage?: string;
  environment?: string;
  gitCommit?: string;
  gitBranch?: string;
  resultsSummary?: Record<string, any>;
}

export interface JudgeEvaluation {
  id: string;
  testResultId: string;
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  evaluationPrompt: string;
  contextData: string; // JSON string
  rawResponse?: string;
  parsedVerdict: string; // JSON string
  confidenceScore: number;
  reasoning?: string;
  suggestions?: string;
  toolAccuracyScore?: number;
  parameterAccuracyScore?: number;
  executionSuccessScore?: number;
  evaluationDurationMs?: number;
  tokensUsed?: number;
  apiCostEstimate?: number;
  createdAt: Date;
}

export interface TestMetrics {
  id: string;
  testResultId: string;
  connectionTimeMs?: number;
  toolDiscoveryTimeMs?: number;
  toolExecutionTimeMs?: number;
  judgeEvaluationTimeMs?: number;
  memoryUsageBytes?: number;
  cpuUsagePercent?: number;
  networkRequestsCount?: number;
  networkBytesTransferred?: number;
  createdAt: Date;
}

// ============================================================================
// DATABASE OPERATION TYPES
// ============================================================================

export interface DatabaseConfig {
  url?: string; // For remote Turso databases
  authToken?: string; // For remote Turso databases
  localPath?: string; // For local SQLite files
  syncUrl?: string; // For embedded replica sync
  syncInterval?: number; // Sync interval in seconds
}

export interface QueryFilter {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export interface ServerConfigFilter extends QueryFilter {
  name?: string;
  transportType?: string;
  since?: Date;
}

export interface RequestHistoryFilter extends QueryFilter {
  serverId?: string;
  requestType?: string;
  success?: boolean;
  isFavorite?: boolean;
  since?: Date;
  tags?: string[];
}

export interface TestResultFilter extends QueryFilter {
  testName?: string;
  success?: boolean;
  testSuite?: string;
  since?: Date;
  tags?: string[];
  hasJudgeVerdict?: boolean;
}

export interface TestRunFilter extends QueryFilter {
  status?: string;
  environment?: string;
  since?: Date;
  configurationId?: string;
}

export interface AnalyticsOptions {
  timeRange?: { start: Date; end: Date };
  testSuite?: string;
  environment?: string;
  groupBy?: 'day' | 'week' | 'month';
}

export interface TestAnalytics {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  passRate: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  testDate?: string;
  testSuite?: string;
  environment?: string;
}

export interface EvaluationStats {
  totalEvaluations: number;
  averageConfidence: number;
  passRate: number;
  totalCost: number;
  totalTokens: number;
  providerBreakdown: Record<string, {
    count: number;
    avgConfidence: number;
    passRate: number;
    totalCost: number;
    totalTokens: number;
  }>;
}

// ============================================================================
// MIGRATION TYPES
// ============================================================================

export interface MigrationInfo {
  version: number;
  name: string;
  appliedAt?: Date;
}

export interface LocalStorageData {
  serverConfigs?: any[];
  requestHistory?: any[];
  userPreferences?: any;
  providerConfigs?: any[];
  appSettings?: Record<string, any>;
  sessions?: any[];
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class MigrationError extends Error {
  constructor(
    message: string,
    public readonly version?: number,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'MigrationError';
  }
}

export class QueryError extends Error {
  constructor(
    message: string,
    public readonly query?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'QueryError';
  }
}