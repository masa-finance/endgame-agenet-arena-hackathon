import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import logger from './logger.js';
import mcpClient from './mcp/mcp-client.js';
import config from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to configuration file
const CONFIG_PATH = path.join(__dirname, '..', '..', '.env');

/**
 * Utility for managing MCP servers
 */
class McpManager {
  constructor() {}

  /**
   * List all configured MCP servers
   * @returns {Array} - List of configured MCP servers
   */
  listConfiguredServers() {
    return config.mcp.client.externalServers || [];
  }

  /**
   * List all currently connected MCP servers
   * @returns {Array} - List of connected MCP servers
   */
  listConnectedServers() {
    return Array.from(mcpClient.connectedServers.keys());
  }

  /**
   * Add a new MCP server to the configuration
   * @param {Object} serverConfig - Server configuration
   * @returns {boolean} - Success of operation
   */
  async addServer(serverConfig) {
    try {
      const { id, command, args } = serverConfig;
      
      if (!id || !command || !args) {
        logger.error('Invalid MCP server configuration');
        return false;
      }
      
      // Check if server already exists
      const existingServer = config.mcp.client.externalServers.find(s => s.id === id);
      if (existingServer) {
        logger.warn(`MCP server ${id} already exists in configuration`);
        return false;
      }
      
      // Add server to configuration
      config.mcp.client.externalServers.push(serverConfig);
      
      // Save configuration (optional)
      // this.saveConfiguration();
      
      // Attempt to connect to the new server
      const connected = await mcpClient.connectToServer(id, command, args);
      
      return connected;
    } catch (error) {
      logger.error(`Error adding MCP server: ${error.message}`);
      return false;
    }
  }

  /**
   * Remove an MCP server from the configuration
   * @param {string} serverId - ID of server to remove
   * @returns {boolean} - Success of operation
   */
  async removeServer(serverId) {
    try {
      // Check if server exists
      const serverIndex = config.mcp.client.externalServers.findIndex(s => s.id === serverId);
      if (serverIndex === -1) {
        logger.warn(`MCP server ${serverId} does not exist in configuration`);
        return false;
      }
      
      // Disconnect server if connected
      if (mcpClient.connectedServers.has(serverId)) {
        await mcpClient.disconnectServer(serverId);
      }
      
      // Remove server from configuration
      config.mcp.client.externalServers.splice(serverIndex, 1);
      
      // Save configuration (optional)
      // this.saveConfiguration();
      
      return true;
    } catch (error) {
      logger.error(`Error removing MCP server: ${error.message}`);
      return false;
    }
  }

  /**
   * Connect to all configured MCP servers
   * @returns {Object} - Connection results (successes/failures)
   */
  async connectAllServers() {
    const results = {
      success: [],
      failed: []
    };
    
    for (const server of config.mcp.client.externalServers) {
      const { id, command, args } = server;
      const connected = await mcpClient.connectToServer(id, command, args);
      
      if (connected) {
        results.success.push(id);
      } else {
        results.failed.push(id);
      }
    }
    
    return results;
  }

  /**
   * Check connection status of an MCP server
   * @param {string} serverId - Server ID
   * @returns {boolean} - Connection status
   */
  isServerConnected(serverId) {
    return mcpClient.connectedServers.has(serverId);
  }

  /**
   * Get list of available tools for an MCP server
   * @param {string} serverId - Server ID
   * @returns {Array} - List of tools
   */
  getServerTools(serverId) {
    const server = mcpClient.connectedServers.get(serverId);
    if (!server) {
      logger.warn(`MCP server ${serverId} is not connected`);
      return [];
    }
    
    return server.tools || [];
  }
}

// Export singleton instance
const mcpManager = new McpManager();
export default mcpManager;