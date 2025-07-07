-- MCPJam Inspector Database Schema
-- LibSQL/SQLite compatible schema for comprehensive data persistence

-- Server configurations (existing functionality)
CREATE TABLE IF NOT EXISTS server_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  command TEXT,
  args TEXT, -- JSON array
  env TEXT,  -- JSON object
  transport_type TEXT NOT NULL, -- 'stdio', 'sse', 'http'
  url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME,
  usage_count INTEGER DEFAULT 0
);

-- Request history for MCP interactions (existing functionality)
CREATE TABLE IF NOT EXISTS request_history (
  id TEXT PRIMARY KEY,
  server_id TEXT,
  request_type TEXT NOT NULL, -- 'tool', 'resource', 'prompt'
  request_name TEXT NOT NULL,
  request_data TEXT, -- JSON object with full request details
  response_data TEXT, -- JSON object with response
  success BOOLEAN NOT NULL,
  error_message TEXT,
  duration_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_favorite BOOLEAN DEFAULT FALSE,
  tags TEXT, -- JSON array
  FOREIGN KEY (server_id) REFERENCES server_configs(id)
);

-- User preferences (existing functionality)
CREATE TABLE IF NOT EXISTS user_preferences (
  id TEXT PRIMARY KEY DEFAULT 'default',
  theme TEXT DEFAULT 'system', -- 'light', 'dark', 'system'
  default_timeout INTEGER DEFAULT 30000,
  auto_save_requests BOOLEAN DEFAULT TRUE,
  show_request_details BOOLEAN DEFAULT TRUE,
  layout_preferences TEXT, -- JSON object
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Provider configurations for AI services (existing functionality)
CREATE TABLE IF NOT EXISTS provider_configs (
  id TEXT PRIMARY KEY,
  provider_type TEXT NOT NULL, -- 'openai', 'anthropic', 'ollama'
  name TEXT NOT NULL,
  api_key TEXT,
  base_url TEXT,
  model TEXT,
  max_tokens INTEGER,
  temperature REAL,
  timeout INTEGER,
  is_default BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Application settings (existing functionality)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL, -- JSON value
  description TEXT,
  category TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User sessions (existing functionality)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  session_data TEXT NOT NULL, -- JSON object
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TESTING FRAMEWORK TABLES (Phase 4 - Future Features)
-- ============================================================================

-- Test results for E2E testing framework
CREATE TABLE IF NOT EXISTS test_results (
  id TEXT PRIMARY KEY,
  test_name TEXT NOT NULL,
  test_description TEXT,
  prompt TEXT NOT NULL,
  expected_tools TEXT, -- JSON array of expected tool names
  actual_tools TEXT,   -- JSON array of actual tool calls with full details
  
  -- Test execution metadata
  duration_ms INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  server_configs TEXT, -- JSON array of server configurations used
  
  -- Judge evaluation results
  judge_verdict TEXT,  -- JSON object with full judge evaluation
  judge_provider TEXT, -- Which LLM provider was used for judging
  judge_model TEXT,    -- Which model was used
  judge_confidence REAL, -- Confidence score 0-1
  
  -- Timestamps and tracking
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  
  -- Categorization and tagging
  test_suite TEXT,     -- Test suite or category name
  tags TEXT,           -- JSON array of tags for filtering
  metadata TEXT        -- JSON object for additional metadata
);

-- Test configurations for reusable setups
CREATE TABLE IF NOT EXISTS test_configurations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  
  -- Configuration data
  server_configs TEXT NOT NULL, -- JSON array of MCP server configs
  judge_config TEXT,            -- JSON object with LLM judge settings
  default_timeout INTEGER DEFAULT 30000,
  default_tags TEXT,            -- JSON array of default tags
  
  -- Template settings
  is_template BOOLEAN DEFAULT FALSE,
  template_variables TEXT,      -- JSON object defining template variables
  
  -- Metadata
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME,
  usage_count INTEGER DEFAULT 0
);

-- Test runs for batch execution tracking
CREATE TABLE IF NOT EXISTS test_runs (
  id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  configuration_id TEXT REFERENCES test_configurations(id),
  
  -- Execution summary
  total_tests INTEGER NOT NULL,
  passed_tests INTEGER NOT NULL,
  failed_tests INTEGER NOT NULL,
  skipped_tests INTEGER DEFAULT 0,
  
  -- Timing
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  total_duration_ms INTEGER,
  
  -- Execution metadata
  parallel_execution BOOLEAN DEFAULT FALSE,
  max_concurrency INTEGER,
  stop_on_failure BOOLEAN DEFAULT FALSE,
  
  -- Status tracking
  status TEXT CHECK (status IN ('running', 'completed', 'failed', 'cancelled')) DEFAULT 'running',
  error_message TEXT,
  
  -- Environment info
  environment TEXT,  -- e.g., 'development', 'staging', 'production'
  git_commit TEXT,   -- Git commit hash if available
  git_branch TEXT,   -- Git branch name if available
  
  -- Results summary
  results_summary TEXT -- JSON object with detailed summary
);

-- Detailed judge evaluations for analysis
CREATE TABLE IF NOT EXISTS judge_evaluations (
  id TEXT PRIMARY KEY,
  test_result_id TEXT NOT NULL REFERENCES test_results(id),
  
  -- Judge configuration
  provider TEXT NOT NULL, -- 'openai', 'anthropic', 'ollama'
  model TEXT NOT NULL,
  temperature REAL,
  max_tokens INTEGER,
  
  -- Evaluation input
  evaluation_prompt TEXT NOT NULL,
  context_data TEXT,      -- JSON object with context provided to judge
  
  -- Evaluation output
  raw_response TEXT,      -- Full LLM response
  parsed_verdict TEXT,    -- JSON object with structured verdict
  confidence_score REAL,  -- 0-1 confidence score
  reasoning TEXT,         -- Judge's reasoning
  suggestions TEXT,       -- Judge's suggestions for improvement
  
  -- Tool-specific evaluation
  tool_accuracy_score REAL,    -- 0-1 score for tool selection accuracy
  parameter_accuracy_score REAL, -- 0-1 score for parameter correctness
  execution_success_score REAL,  -- 0-1 score for successful execution
  
  -- Performance metadata
  evaluation_duration_ms INTEGER,
  tokens_used INTEGER,
  api_cost_estimate REAL, -- Estimated API cost in USD
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Performance and analytics tracking
CREATE TABLE IF NOT EXISTS test_metrics (
  id TEXT PRIMARY KEY,
  test_result_id TEXT NOT NULL REFERENCES test_results(id),
  
  -- Performance metrics
  connection_time_ms INTEGER,
  tool_discovery_time_ms INTEGER,
  tool_execution_time_ms INTEGER,
  judge_evaluation_time_ms INTEGER,
  
  -- Resource usage
  memory_usage_bytes INTEGER,
  cpu_usage_percent REAL,
  
  -- Network metrics
  network_requests_count INTEGER,
  network_bytes_transferred INTEGER,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Existing functionality indexes
CREATE INDEX IF NOT EXISTS idx_server_configs_name ON server_configs(name);
CREATE INDEX IF NOT EXISTS idx_server_configs_last_used ON server_configs(last_used_at);
CREATE INDEX IF NOT EXISTS idx_request_history_server_id ON request_history(server_id);
CREATE INDEX IF NOT EXISTS idx_request_history_created_at ON request_history(created_at);
CREATE INDEX IF NOT EXISTS idx_request_history_type ON request_history(request_type);
CREATE INDEX IF NOT EXISTS idx_request_history_favorite ON request_history(is_favorite);
CREATE INDEX IF NOT EXISTS idx_provider_configs_type ON provider_configs(provider_type);
CREATE INDEX IF NOT EXISTS idx_provider_configs_default ON provider_configs(is_default);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Testing framework indexes
CREATE INDEX IF NOT EXISTS idx_test_results_created_at ON test_results(created_at);
CREATE INDEX IF NOT EXISTS idx_test_results_success ON test_results(success);
CREATE INDEX IF NOT EXISTS idx_test_results_test_name ON test_results(test_name);
CREATE INDEX IF NOT EXISTS idx_test_results_test_suite ON test_results(test_suite);
CREATE INDEX IF NOT EXISTS idx_test_runs_status ON test_runs(status);
CREATE INDEX IF NOT EXISTS idx_test_runs_started_at ON test_runs(started_at);
CREATE INDEX IF NOT EXISTS idx_judge_evaluations_test_result_id ON judge_evaluations(test_result_id);
CREATE INDEX IF NOT EXISTS idx_judge_evaluations_provider ON judge_evaluations(provider);
CREATE INDEX IF NOT EXISTS idx_test_configurations_name ON test_configurations(name);
CREATE INDEX IF NOT EXISTS idx_test_configurations_template ON test_configurations(is_template);

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- ============================================================================

-- Update timestamps for server_configs
CREATE TRIGGER IF NOT EXISTS update_server_configs_timestamp 
    AFTER UPDATE ON server_configs
    BEGIN
        UPDATE server_configs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Update timestamps for user_preferences
CREATE TRIGGER IF NOT EXISTS update_user_preferences_timestamp 
    AFTER UPDATE ON user_preferences
    BEGIN
        UPDATE user_preferences SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Update timestamps for provider_configs
CREATE TRIGGER IF NOT EXISTS update_provider_configs_timestamp 
    AFTER UPDATE ON provider_configs
    BEGIN
        UPDATE provider_configs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Update timestamps for app_settings
CREATE TRIGGER IF NOT EXISTS update_app_settings_timestamp 
    AFTER UPDATE ON app_settings
    BEGIN
        UPDATE app_settings SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
    END;

-- Update timestamps for sessions
CREATE TRIGGER IF NOT EXISTS update_sessions_timestamp 
    AFTER UPDATE ON sessions
    BEGIN
        UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Update timestamps for test_configurations
CREATE TRIGGER IF NOT EXISTS update_test_configurations_timestamp 
    AFTER UPDATE ON test_configurations
    BEGIN
        UPDATE test_configurations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;