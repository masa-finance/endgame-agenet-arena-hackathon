import axios from 'axios';
import config from '../config/config.js';
import logger from './logger.js';

class MasaClient {
  constructor() {
    this.baseUrl = config.masa.endpoint || 'http://localhost:8080/api/v1/data';
    this.enabled = config.masa.enabled || false;
    this.lastRequest = null;
    this.requestInterval = 15 * 60 * 1000; // 15 minutes entre les requêtes
  }

  async getTrends(count = 20) {
    if (!this.enabled) {
      logger.info('Masa protocol is disabled, skipping request');
      return [];
    }

    // Éviter trop de requêtes
    const now = new Date();
    if (this.lastRequest && (now - this.lastRequest < this.requestInterval)) {
      logger.info(`Skipping Masa request - last request was ${Math.round((now - this.lastRequest)/1000)} seconds ago`);
      return [];
    }

    try {
      logger.info(`Fetching trends from Masa protocol endpoint: ${this.baseUrl}`);
      
      const response = await axios.post(`${this.baseUrl}/twitter/tweets/recent`, {
        query: "#trending OR #viral min_faves:100 -filter:retweets",
        count: count
      });

      this.lastRequest = now;

      if (!response.data || !Array.isArray(response.data)) {
        logger.warn('Invalid response from Masa protocol');
        return [];
      }

      logger.info(`Retrieved ${response.data.length} tweets from Masa protocol`);

      // Analyser les hashtags pour identifier les tendances
      const hashtagCounts = new Map();
      
      for (const tweet of response.data) {
        const entities = tweet.entities || {};
        const hashtags = entities.hashtags || [];
        
        for (const hashtag of hashtags) {
          const tag = hashtag.text || (typeof hashtag === 'string' ? hashtag : '');
          if (!tag || tag.toLowerCase() === 'trending' || tag.toLowerCase() === 'viral') continue;
          
          hashtagCounts.set(
            tag,
            (hashtagCounts.get(tag) || 0) + 1
          );
        }
      }

      // Convertir en format de tendance, tri par nombre de mentions
      const trends = Array.from(hashtagCounts.entries())
        .filter(([_, count]) => count >= 2) // Au moins 2 mentions
        .map(([tag, count]) => ({
          term: `#${tag}`,
          count: count,
          growthRate: 100, // Valeur par défaut pour les tendances Masa
          isNew: true,
          source: 'masa'
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10); // Limiter aux 10 tendances principales

      logger.info(`Extracted ${trends.length} trends from Masa protocol data`);
      return trends;
    } catch (error) {
      logger.error(`Error fetching data from Masa protocol: ${error.message}`);
      return [];
    }
  }

  async searchTweets(query, count = 20) {
    if (!this.enabled) {
      logger.info('Masa protocol is disabled, skipping request');
      return [];
    }

    try {
      logger.info(`Searching tweets via Masa protocol for: ${query}`);
      
      const response = await axios.post(`${this.baseUrl}/twitter/tweets/recent`, {
        query: query,
        count: count
      });

      if (!response.data || !Array.isArray(response.data)) {
        logger.warn('Invalid response from Masa protocol');
        return [];
      }

      logger.info(`Retrieved ${response.data.length} tweets for query: ${query}`);
      return response.data;
    } catch (error) {
      logger.error(`Error searching tweets via Masa protocol: ${error.message}`);
      return [];
    }
  }

  async getWebContent(url, depth = 1) {
    if (!this.enabled) {
      logger.info('Masa protocol is disabled, skipping request');
      return null;
    }

    try {
      logger.info(`Fetching web content from ${url} via Masa protocol`);
      
      const response = await axios.post(`${this.baseUrl}/web`, {
        url: url,
        depth: depth
      });

      if (!response.data) {
        logger.warn('Invalid response from Masa protocol');
        return null;
      }

      logger.info(`Successfully retrieved web content from ${url}`);
      return response.data;
    } catch (error) {
      logger.error(`Error fetching web content via Masa protocol: ${error.message}`);
      return null;
    }
  }
}

// Export a singleton instance
const masaClient = new MasaClient();
export default masaClient;