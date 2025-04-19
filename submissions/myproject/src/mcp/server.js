import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import express from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import config from '../config.js';
import logger from '../utils/logger.js';
import { registerTools } from './tools.js';

class MCPTrendServer {
  constructor() {
    this.server = new McpServer({
      name: config.mcp.server.name,
      version: config.mcp.server.version
    });
    
    this.app = express();
    this.port = config.mcp.transport.port;
    this.transport = null;
    this.currentTrends = [];
  }

  // Initialize and start the MCP server
  async initialize() {
    // Register MCP tools from the dedicated module
    registerTools(this.server);
    
    this.registerResources();
    this.setupExpressRoutes();
    
    await this.startServer();
    logger.info(`MCP server started on port ${this.port}`);
  }

  // Update current trends
  updateTrends(trends) {
    this.currentTrends = trends;
    logger.info(`Trends updated in MCP server: ${trends.length} trends`);
  }

  // Register MCP resources
  registerResources() {
    // Resource for detected trends
    this.server.resource(
      "trends",
      "trends://latest",
      async (uri) => {
        try {
          if (this.currentTrends.length === 0) {
            return {
              contents: [{
                uri: uri.href,
                text: "No trends currently detected."
              }]
            };
          }
          
          // Format trends as JSON
          const trendsJson = JSON.stringify(this.currentTrends, null, 2);
          
          return {
            contents: [{
              uri: uri.href,
              text: trendsJson
            }]
          };
        } catch (error) {
          logger.error(`Error accessing trends resource: ${error.message}`);
          throw error;
        }
      }
    );
  }

  // Configure Express routes for SSE transport
  setupExpressRoutes() {
    this.app.get('/sse', (req, res) => {
      this.transport = new SSEServerTransport('/messages', res);
      this.server.connect(this.transport);
    });
    
    this.app.post('/messages', (req, res) => {
      if (this.transport) {
        this.transport.handlePostMessage(req, res);
      } else {
        res.status(400).send('Transport not initialized');
      }
    });
  }

  // Start the Express server
  async startServer() {
    return new Promise((resolve) => {
      this.app.listen(this.port, () => {
        logger.info(`MCP server listening on port ${this.port}`);
        resolve();
      });
    });
  }
}

export default new MCPTrendServer();