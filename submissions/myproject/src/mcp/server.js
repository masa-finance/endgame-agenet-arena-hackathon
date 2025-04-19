import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import express from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import config from '../config.js';
import logger from '../utils/logger.js';
import twitterClient from '../twitter-client.js';

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

  /**
   * Initialise et démarre le serveur MCP
   */
  async initialize() {
    this.registerTools();
    this.registerResources();
    this.setupExpressRoutes();
    
    await this.startServer();
    logger.info(`Serveur MCP démarré sur le port ${this.port}`);
  }

  /**
   * Met à jour les tendances actuelles
   */
  updateTrends(trends) {
    this.currentTrends = trends;
    logger.info(`Tendances mises à jour dans le serveur MCP: ${trends.length} tendances`);
  }

  /**
   * Enregistre les outils MCP
   */
  registerTools() {
    // Outil pour enrichir une tendance avec du contexte Twitter
    this.server.tool(
      "enrichir_tendance",
      {
        terme: z.string().describe("Le terme de tendance à enrichir")
      },
      async ({ terme }) => {
        try {
          logger.info(`Enrichissement du contexte pour la tendance: ${terme}`);
          
          // Rechercher des tweets récents sur ce terme
          const tweets = await twitterClient.scraper.searchTweets(terme, 10);
          
          if (!tweets || tweets.length === 0) {
            return {
              content: [{ 
                type: "text", 
                text: `Aucun tweet récent trouvé pour la tendance: ${terme}` 
              }]
            };
          }
          
          // Analyser les tweets pour extraire des informations pertinentes
          const tweetTexts = tweets.map(t => t.full_text || t.text);
          const usernames = [...new Set(tweets.map(t => t.user.screen_name))].slice(0, 5);
          
          // Compter les hashtags associés
          const hashtagCounts = new Map();
          for (const tweet of tweets) {
            const hashtags = tweet.entities?.hashtags || [];
            for (const tag of hashtags) {
              const hashtagText = tag.text || tag;
              if (hashtagText.toLowerCase() !== terme.toLowerCase().replace('#', '')) {
                hashtagCounts.set(
                  hashtagText, 
                  (hashtagCounts.get(hashtagText) || 0) + 1
                );
              }
            }
          }
          
          // Trier et prendre les 5 hashtags les plus fréquents
          const topHashtags = [...hashtagCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([tag]) => `#${tag}`);
          
          // Construire le rapport enrichi
          let contextReport = `📊 Contexte pour la tendance ${terme}:\n\n`;
          contextReport += `🔹 ${tweets.length} tweets récents analysés\n`;
          contextReport += `🔹 Comptes actifs: ${usernames.map(u => '@' + u).join(', ')}\n`;
          
          if (topHashtags.length > 0) {
            contextReport += `🔹 Hashtags associés: ${topHashtags.join(', ')}\n`;
          }
          
          // Inclure quelques extraits de tweets
          contextReport += '\n📱 Extraits de tweets:\n';
          for (let i = 0; i < Math.min(3, tweetTexts.length); i++) {
            const shortText = tweetTexts[i].substring(0, 100) + (tweetTexts[i].length > 100 ? '...' : '');
            contextReport += `- "${shortText}"\n`;
          }
          
          return {
            content: [{ type: "text", text: contextReport }]
          };
        } catch (error) {
          logger.error(`Erreur lors de l'enrichissement de la tendance: ${error.message}`);
          return {
            content: [{ 
              type: "text", 
              text: `Erreur lors de l'enrichissement de la tendance: ${error.message}` 
            }],
            isError: true
          };
        }
      }
    );

    // Outil pour obtenir les tendances Twitter mondiales (officielles)
    this.server.tool(
      "tendances_mondiales",
      {},
      async () => {
        try {
          const globalTrends = await twitterClient.getGlobalTrends();
          
          if (!globalTrends || globalTrends.length === 0) {
            return {
              content: [{ 
                type: "text", 
                text: "Aucune tendance mondiale trouvée actuellement." 
              }]
            };
          }
          
          // Formatter les tendances
          const trendsReport = globalTrends
            .slice(0, 10)
            .map((trend, index) => `${index + 1}. ${trend.name}`)
            .join('\n');
          
          return {
            content: [{ 
              type: "text", 
              text: `📈 Top 10 des tendances mondiales sur Twitter:\n\n${trendsReport}` 
            }]
          };
        } catch (error) {
          logger.error(`Erreur lors de la récupération des tendances mondiales: ${error.message}`);
          return {
            content: [{ 
              type: "text", 
              text: `Erreur lors de la récupération des tendances mondiales: ${error.message}` 
            }],
            isError: true
          };
        }
      }
    );
  }

  /**
   * Enregistre les ressources MCP
   */
  registerResources() {
    // Ressource pour les tendances détectées
    this.server.resource(
      "tendances",
      "tendances://latest",
      async (uri) => {
        try {
          if (this.currentTrends.length === 0) {
            return {
              contents: [{
                uri: uri.href,
                text: "Aucune tendance détectée actuellement."
              }]
            };
          }
          
          // Formater les tendances en JSON
          const trendsJson = JSON.stringify(this.currentTrends, null, 2);
          
          return {
            contents: [{
              uri: uri.href,
              text: trendsJson
            }]
          };
        } catch (error) {
          logger.error(`Erreur lors de l'accès à la ressource tendances: ${error.message}`);
          throw error;
        }
      }
    );
  }

  /**
   * Configure les routes Express pour le transport SSE
   */
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

  /**
   * Démarre le serveur Express
   */
  async startServer() {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        logger.info(`Serveur MCP écoutant sur le port ${this.port}`);
        resolve();
      });
    });
  }
}

export default new MCPTrendServer();