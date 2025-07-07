/**
 * Database API routes for MCPJam Inspector
 * Provides HTTP endpoints for database operations
 */

import { Router } from 'express';
import { DatabaseManager } from './DatabaseManager.js';
import { DatabaseConfig, ServerConfig, RequestHistory, UserPreferences, ProviderConfig } from './types.js';

export function createDatabaseRoutes(databaseManager: DatabaseManager): Router {
  const router = Router();

  // Middleware for JSON parsing
  router.use((req, res, next) => {
    if (req.is('application/json')) {
      next();
    } else {
      res.status(400).json({ error: 'Content-Type must be application/json' });
    }
  });

  // Error handler wrapper
  const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

  // ============================================================================
  // SERVER CONFIGURATIONS
  // ============================================================================

  // Get all server configurations
  router.get('/server-configs', asyncHandler(async (req: any, res: any) => {
    const filter = {
      name: req.query.name,
      transportType: req.query.transportType,
      since: req.query.since ? new Date(req.query.since) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset) : undefined,
      orderBy: req.query.orderBy,
      orderDirection: req.query.orderDirection
    };

    const configs = await databaseManager.getServerConfigs(filter);
    res.json({
      success: true,
      data: configs,
      count: configs.length
    });
  }));

  // Get single server configuration
  router.get('/server-configs/:id', asyncHandler(async (req: any, res: any) => {
    const config = await databaseManager.getServerConfig(req.params.id);
    if (!config) {
      res.status(404).json({
        success: false,
        error: 'Server configuration not found'
      });
      return;
    }

    res.json({
      success: true,
      data: config
    });
  }));

  // Create or update server configuration
  router.post('/server-configs', asyncHandler(async (req: any, res: any) => {
    const config: Omit<ServerConfig, 'createdAt' | 'updatedAt' | 'usageCount'> = req.body;
    
    if (!config.id || !config.name || !config.transportType) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: id, name, transportType'
      });
      return;
    }

    await databaseManager.storeServerConfig(config);
    res.json({
      success: true,
      message: 'Server configuration stored successfully'
    });
  }));

  // Update server configuration usage
  router.post('/server-configs/:id/usage', asyncHandler(async (req: any, res: any) => {
    await databaseManager.updateServerConfigUsage(req.params.id);
    res.json({
      success: true,
      message: 'Server configuration usage updated'
    });
  }));

  // Delete server configuration
  router.delete('/server-configs/:id', asyncHandler(async (req: any, res: any) => {
    await databaseManager.deleteServerConfig(req.params.id);
    res.json({
      success: true,
      message: 'Server configuration deleted successfully'
    });
  }));

  // ============================================================================
  // REQUEST HISTORY
  // ============================================================================

  // Get request history
  router.get('/request-history', asyncHandler(async (req: any, res: any) => {
    const filter = {
      serverId: req.query.serverId,
      requestType: req.query.requestType,
      success: req.query.success !== undefined ? req.query.success === 'true' : undefined,
      isFavorite: req.query.isFavorite === 'true',
      since: req.query.since ? new Date(req.query.since) : undefined,
      tags: req.query.tags ? req.query.tags.split(',') : undefined,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset) : undefined,
      orderBy: req.query.orderBy,
      orderDirection: req.query.orderDirection
    };

    const history = await databaseManager.getRequestHistory(filter);
    res.json({
      success: true,
      data: history,
      count: history.length
    });
  }));

  // Store request history
  router.post('/request-history', asyncHandler(async (req: any, res: any) => {
    const request: Omit<RequestHistory, 'createdAt'> = req.body;
    
    if (!request.id || !request.requestType || !request.requestName) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: id, requestType, requestName'
      });
      return;
    }

    await databaseManager.storeRequestHistory(request);
    res.json({
      success: true,
      message: 'Request history stored successfully'
    });
  }));

  // Toggle request favorite
  router.post('/request-history/:id/favorite', asyncHandler(async (req: any, res: any) => {
    await databaseManager.toggleRequestFavorite(req.params.id);
    res.json({
      success: true,
      message: 'Request favorite status toggled'
    });
  }));

  // ============================================================================
  // USER PREFERENCES
  // ============================================================================

  // Get user preferences
  router.get('/user-preferences', asyncHandler(async (req: any, res: any) => {
    const preferences = await databaseManager.getUserPreferences();
    res.json({
      success: true,
      data: preferences
    });
  }));

  // Update user preferences
  router.post('/user-preferences', asyncHandler(async (req: any, res: any) => {
    const preferences: Partial<UserPreferences> = req.body;
    await databaseManager.updateUserPreferences(preferences);
    res.json({
      success: true,
      message: 'User preferences updated successfully'
    });
  }));

  // ============================================================================
  // PROVIDER CONFIGURATIONS
  // ============================================================================

  // Get provider configurations
  router.get('/provider-configs', asyncHandler(async (req: any, res: any) => {
    const providerType = req.query.providerType;
    const configs = await databaseManager.getProviderConfigs(providerType);
    res.json({
      success: true,
      data: configs,
      count: configs.length
    });
  }));

  // Store provider configuration
  router.post('/provider-configs', asyncHandler(async (req: any, res: any) => {
    const config: Omit<ProviderConfig, 'createdAt' | 'updatedAt'> = req.body;
    
    if (!config.id || !config.providerType || !config.name) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: id, providerType, name'
      });
      return;
    }

    await databaseManager.storeProviderConfig(config);
    res.json({
      success: true,
      message: 'Provider configuration stored successfully'
    });
  }));

  // ============================================================================
  // APP SETTINGS
  // ============================================================================

  // Get app setting
  router.get('/app-settings/:key', asyncHandler(async (req: any, res: any) => {
    const value = await databaseManager.getAppSetting(req.params.key);
    if (value === null) {
      res.status(404).json({
        success: false,
        error: 'Setting not found'
      });
      return;
    }

    res.json({
      success: true,
      data: { key: req.params.key, value }
    });
  }));

  // Set app setting
  router.post('/app-settings/:key', asyncHandler(async (req: any, res: any) => {
    const { value, description, category } = req.body;
    
    if (value === undefined) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: value'
      });
      return;
    }

    await databaseManager.setAppSetting(req.params.key, value, description, category);
    res.json({
      success: true,
      message: 'App setting stored successfully'
    });
  }));

  // ============================================================================
  // TESTING FRAMEWORK ENDPOINTS (Future Features)
  // ============================================================================

  // Get test results
  router.get('/test-results', asyncHandler(async (req: any, res: any) => {
    const filter = {
      testName: req.query.testName,
      success: req.query.success !== undefined ? req.query.success === 'true' : undefined,
      testSuite: req.query.testSuite,
      since: req.query.since ? new Date(req.query.since) : undefined,
      hasJudgeVerdict: req.query.hasJudgeVerdict !== undefined ? req.query.hasJudgeVerdict === 'true' : undefined,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset) : undefined,
      orderBy: req.query.orderBy,
      orderDirection: req.query.orderDirection
    };

    const results = await databaseManager.getTestResults(filter);
    res.json({
      success: true,
      data: results,
      count: results.length
    });
  }));

  // Store test result
  router.post('/test-results', asyncHandler(async (req: any, res: any) => {
    const result = req.body;
    
    if (!result.id || !result.testCase || !result.toolCalls) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: id, testCase, toolCalls'
      });
      return;
    }

    await databaseManager.storeTestResult(result);
    res.json({
      success: true,
      message: 'Test result stored successfully'
    });
  }));

  // Get test analytics
  router.get('/test-analytics', asyncHandler(async (req: any, res: any) => {
    const options = {
      timeRange: req.query.startDate && req.query.endDate ? {
        start: new Date(req.query.startDate),
        end: new Date(req.query.endDate)
      } : undefined,
      testSuite: req.query.testSuite,
      environment: req.query.environment,
      groupBy: req.query.groupBy
    };

    const analytics = await databaseManager.getTestAnalytics(options);
    res.json({
      success: true,
      data: analytics
    });
  }));

  // ============================================================================
  // MIGRATION ENDPOINTS
  // ============================================================================

  // Migrate from localStorage
  router.post('/migrate-from-localstorage', asyncHandler(async (req: any, res: any) => {
    const data = req.body;
    
    if (!data || typeof data !== 'object') {
      res.status(400).json({
        success: false,
        error: 'Invalid localStorage data provided'
      });
      return;
    }

    await databaseManager.migrateFromLocalStorage(data);
    res.json({
      success: true,
      message: 'Migration from localStorage completed successfully'
    });
  }));

  // ============================================================================
  // HEALTH CHECK
  // ============================================================================

  router.get('/health', asyncHandler(async (req: any, res: any) => {
    res.json({
      success: true,
      message: 'Database API is healthy',
      timestamp: new Date().toISOString()
    });
  }));

  // Error handling middleware
  router.use((error: any, req: any, res: any, next: any) => {
    console.error('Database API Error:', error);
    
    const statusCode = error.status || 500;
    const message = error.message || 'Internal server error';
    
    res.status(statusCode).json({
      success: false,
      error: message,
      code: error.code,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  });

  return router;
}