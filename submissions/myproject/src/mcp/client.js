// mcp/client.js - Client MCP
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import logger from '../utils/logger.js';
import config from '../config/config.js';

class McpClient {
  constructor() {
    this.client = new Client({
      name: "trend-snipper-client",
      version: "1.0.0"
    });
    this.connectedServers = new Map(); // Map of connected servers
  }

  /**
   * Connects to an MCP server
   * @param {string} serverId - Unique identifier of the server
   * @param {string} command - Command to launch the server (e.g., "python", "node")
   * @param {string[]} args - Command arguments (e.g., ["server.py"], ["server.js"])
   * @returns {Promise<boolean>} - Whether the connection was successful
   */
  async connectToServer(serverId, command, args) {
    try {
      if (this.connectedServers.has(serverId)) {
        logger.info(`MCP server ${serverId} already connected`);
        return true;
      }

      logger.info(`Connecting to MCP server ${serverId}...`);

      const transport = new StdioClientTransport({
        command,
        args
      });

      // Attach event handlers
      transport.onerror = (error) => {
        logger.error(`MCP transport error for ${serverId}: ${error.message}`);
      };

      transport.onclose = () => {
        logger.info(`Connection to MCP server ${serverId} closed`);
        this.connectedServers.delete(serverId);
      };

      // Connect to the server
      await this.client.connect(transport);

      // List available tools
      const tools = await this.listTools();
      logger.info(`MCP server ${serverId} connected, ${tools.length} tools available`);

      // Store the server
      this.connectedServers.set(serverId, { transport, tools });

      return true;
    } catch (error) {
      logger.error(`Error connecting to MCP server ${serverId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Disconnects a specific MCP server
   * @param {string} serverId - Server identifier
   * @returns {Promise<boolean>} - Whether the disconnection was successful
   */
  async disconnectServer(serverId) {
    try {
      const server = this.connectedServers.get(serverId);
      if (!server) {
        logger.warn(`MCP server ${serverId} is not connected`);
        return false;
      }

      logger.info(`Disconnecting from MCP server ${serverId}...`);
      await this.client.close();
      this.connectedServers.delete(serverId);
      return true;
    } catch (error) {
      logger.error(`Error disconnecting from MCP server ${serverId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Closes all MCP connections
   */
  async closeAll() {
    try {
      const serverIds = [...this.connectedServers.keys()];
      for (const serverId of serverIds) {
        await this.disconnectServer(serverId);
      }
      logger.info('All MCP connections closed');
    } catch (error) {
      logger.error(`Error closing all MCP connections: ${error.message}`);
    }
  }

  /**
   * Lists available tools on the connected MCP server
   * @returns {Promise<Array>} - List of tools
   */
  async listTools() {
    try {
      const result = await this.client.listTools();
      return result.tools || [];
    } catch (error) {
      logger.error(`Error listing MCP tools: ${error.message}`);
      return [];
    }
  }

  /**
   * Calls a tool on the MCP server
   * @param {string} toolName - Name of the tool
   * @param {Object} args - Tool arguments
   * @returns {Promise<Object>} - Tool execution result
   */
  async callTool(toolName, args) {
    try {
      logger.info(`Calling MCP tool ${toolName}...`);
      const result = await this.client.callTool({
        name: toolName,
        arguments: args
      });

      return result;
    } catch (error) {
      logger.error(`Error calling MCP tool ${toolName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Reads a resource from the MCP server
   * @param {string} uri - URI of the resource
   * @returns {Promise<Object>} - Resource content
   */
  async readResource(uri) {
    try {
      logger.info(`Reading MCP resource ${uri}...`);
      const result = await this.client.readResource({ uri });
      return result;
    } catch (error) {
      logger.error(`Error reading MCP resource ${uri}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Lists available resources
   * @returns {Promise<Array>} - List of resources
   */
  async listResources() {
    try {
      const result = await this.client.listResources();
      return result.resources || [];
    } catch (error) {
      logger.error(`Error listing MCP resources: ${error.message}`);
      return [];
    }
  }
}

// Export a singleton instance
const mcpClient = new McpClient();
export default mcpClient;