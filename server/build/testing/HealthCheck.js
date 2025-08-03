export class HealthCheck {
    mcpProxyService;
    database;
    logger;
    constructor(mcpProxyService, database, logger) {
        this.mcpProxyService = mcpProxyService;
        this.database = database;
        this.logger = logger;
    }
    getStatus() {
        return {
            testing: true,
            status: "healthy",
            version: process.env.npm_package_version || "0.3.5",
            timestamp: new Date().toISOString(),
        };
    }
    getDetailedStatus() {
        return {
            testing: true,
            server: {
                status: "running",
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: process.env.npm_package_version || "0.3.5",
            },
            connections: {
                active: this.mcpProxyService.getActiveConnections().length,
                list: this.mcpProxyService.getActiveConnections(),
            },
            database: {
                connected: this.isDatabaseConnected(),
                status: this.isDatabaseConnected() ? "connected" : "disconnected",
            },
            timestamp: new Date().toISOString(),
        };
    }
    isDatabaseConnected() {
        // Simple check - in a real implementation you might want to ping the database
        return this.database !== null && this.database !== undefined;
    }
}
