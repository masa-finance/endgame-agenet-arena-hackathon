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
      version: config.mcp.server.version,
      capabilities: {
        resources: {},
        tools: {},
        prompts: {}  // Ajout de la capacité de prompts
      }
    });
    
    this.app = express();
    this.port = config.mcp.server.port;
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

    // Resource for historical trends
    this.server.resource(
      "historical-trends",
      "trends://history/{date}",
      async (uri, { date }) => {
        try {
          // Ici, vous pourriez implémenter une logique pour récupérer des tendances historiques
          // Pour cet exemple, nous renvoyons simplement un message
          return {
            contents: [{
              uri: uri.href,
              text: `Historical trends for ${date} are not yet available.`
            }]
          };
        } catch (error) {
          logger.error(`Error accessing historical trends: ${error.message}`);
          throw error;
        }
      }
    );
  }

  // Register MCP prompts (nouvelle fonctionnalité)
  registerPrompts() {
    // Prompt pour l'analyse de tendances
    this.server.prompt(
      "analyze-trend",
      { trend: "string" },
      ({ trend }) => ({
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Analyze this emerging trend: ${trend}. What might be the factors driving its popularity? What broader implications might it have? Who are the key influencers or thought leaders associated with it?`
          }
        }]
      })
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
      this.httpServer = this.app.listen(this.port, () => {
        logger.info(`MCP server listening on port ${this.port}`);
        resolve();
      });
    });
  }

  // Stop the server
  async stop() {
    if (this.httpServer) {
      return new Promise((resolve, reject) => {
        this.httpServer.close((err) => {
          if (err) {
            logger.error(`Error stopping MCP server: ${err.message}`);
            reject(err);
          } else {
            logger.info('MCP server stopped');
            resolve();
          }
        });
      });
    }
  }
}

export default new MCPTrendServer();