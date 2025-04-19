import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import logger from '../utils/logger.js';

class McpClient {
  constructor() {
    this.client = new Client({ 
      name: "trend-snipper-client", 
      version: "1.0.0" 
    });
    this.connectedServers = new Map(); // Map des serveurs connectés
  }

  /**
   * Se connecte à un serveur MCP
   * @param {string} serverId - Identifiant unique du serveur
   * @param {string} command - Commande pour lancer le serveur (ex: "python", "node")
   * @param {string[]} args - Arguments de la commande (ex: ["server.py"], ["server.js"])
   * @returns {Promise<boolean>} - Succès de la connexion
   */
  async connectToServer(serverId, command, args) {
    try {
      if (this.connectedServers.has(serverId)) {
        logger.info(`Serveur MCP ${serverId} déjà connecté`);
        return true;
      }

      logger.info(`Connexion au serveur MCP ${serverId}...`);
      
      const transport = new StdioClientTransport({
        command,
        args
      });

      // Attacher les gestionnaires d'événements
      transport.onerror = (error) => {
        logger.error(`Erreur de transport MCP pour ${serverId}: ${error.message}`);
      };
      
      transport.onclose = () => {
        logger.info(`Connexion au serveur MCP ${serverId} fermée`);
        this.connectedServers.delete(serverId);
      };

      // Connexion au serveur
      await this.client.connect(transport);
      
      // Lister les outils disponibles
      const tools = await this.listTools();
      logger.info(`Serveur MCP ${serverId} connecté, ${tools.length} outils disponibles`);
      
      // Enregistrer le serveur
      this.connectedServers.set(serverId, { transport, tools });
      
      return true;
    } catch (error) {
      logger.error(`Erreur lors de la connexion au serveur MCP ${serverId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Déconnecte un serveur MCP spécifique
   * @param {string} serverId - Identifiant du serveur
   * @returns {Promise<boolean>} - Succès de la déconnexion
   */
  async disconnectServer(serverId) {
    try {
      const server = this.connectedServers.get(serverId);
      if (!server) {
        logger.warn(`Serveur MCP ${serverId} non connecté`);
        return false;
      }

      logger.info(`Déconnexion du serveur MCP ${serverId}...`);
      await this.client.close();
      this.connectedServers.delete(serverId);
      return true;
    } catch (error) {
      logger.error(`Erreur lors de la déconnexion du serveur MCP ${serverId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Ferme toutes les connexions MCP
   */
  async closeAll() {
    try {
      const serverIds = [...this.connectedServers.keys()];
      for (const serverId of serverIds) {
        await this.disconnectServer(serverId);
      }
      logger.info('Toutes les connexions MCP fermées');
    } catch (error) {
      logger.error(`Erreur lors de la fermeture des connexions MCP: ${error.message}`);
    }
  }

  /**
   * Liste les outils disponibles sur le serveur MCP connecté
   * @returns {Promise<Array>} - Liste des outils
   */
  async listTools() {
    try {
      const result = await this.client.listTools();
      return result.tools || [];
    } catch (error) {
      logger.error(`Erreur lors de la récupération des outils MCP: ${error.message}`);
      return [];
    }
  }

  /**
   * Appelle un outil sur le serveur MCP
   * @param {string} toolName - Nom de l'outil
   * @param {Object} args - Arguments de l'outil
   * @returns {Promise<Object>} - Résultat de l'appel
   */
  async callTool(toolName, args) {
    try {
      logger.info(`Appel de l'outil MCP ${toolName}...`);
      const result = await this.client.callTool({
        name: toolName,
        arguments: args
      });
      
      return result;
    } catch (error) {
      logger.error(`Erreur lors de l'appel de l'outil MCP ${toolName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Récupère une ressource du serveur MCP
   * @param {string} uri - URI de la ressource
   * @returns {Promise<Object>} - Ressource
   */
  async readResource(uri) {
    try {
      logger.info(`Lecture de la ressource MCP ${uri}...`);
      const result = await this.client.readResource({ uri });
      return result;
    } catch (error) {
      logger.error(`Erreur lors de la lecture de la ressource MCP ${uri}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Liste les ressources disponibles
   * @returns {Promise<Array>} - Liste des ressources
   */
  async listResources() {
    try {
      const result = await this.client.listResources();
      return result.resources || [];
    } catch (error) {
      logger.error(`Erreur lors de la récupération des ressources MCP: ${error.message}`);
      return [];
    }
  }
}

// Exporter une instance singleton
const mcpClient = new McpClient();
export default mcpClient;