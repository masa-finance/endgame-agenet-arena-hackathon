import { Scraper, SearchMode } from 'agent-twitter-client';
import config from './config.js';
import logger from './utils/logger.js';

class TwitterClient {
  constructor() {
    this.scraper = new Scraper();
    this.isAuthenticated = false;
  }

  /**
   * Authentification auprès de Twitter
   */
  async authenticate() {
    try {
      if (this.isAuthenticated) return true;

      const { username, password, email, apiKey, apiSecretKey, accessToken, accessTokenSecret } = config.twitter;
      
      // Si les clés API sont fournies, utiliser l'authentification complète (nécessaire pour certaines fonctionnalités)
      if (apiKey && apiSecretKey && accessToken && accessTokenSecret) {
        await this.scraper.login(username, password, email, apiKey, apiSecretKey, accessToken, accessTokenSecret);
      } else {
        // Authentification de base
        await this.scraper.login(username, password);
      }
      
      this.isAuthenticated = await this.scraper.isLoggedIn();
      
      if (this.isAuthenticated) {
        logger.info('Authentification Twitter réussie');
        return true;
      } else {
        logger.error('Échec de l\'authentification Twitter');
        return false;
      }
    } catch (error) {
      logger.error(`Erreur d'authentification Twitter: ${error.message}`);
      return false;
    }
  }

  /**
   * Collecte des tweets à partir des hashtags configurés
   */
  async collectTweetsFromHashtags() {
    if (!this.isAuthenticated) await this.authenticate();
    
    try {
      const allTweets = [];
      
      for (const hashtag of config.sources.hashtags) {
        logger.info(`Collecte des tweets pour le hashtag: ${hashtag}`);
        const tweets = await this.scraper.searchTweets(hashtag, config.sources.maxTweetsPerSource, SearchMode.Latest);
        if (tweets && tweets.length > 0) {
          allTweets.push(...tweets);
          logger.info(`${tweets.length} tweets collectés pour ${hashtag}`);
        }
      }
      
      return allTweets;
    } catch (error) {
      logger.error(`Erreur lors de la collecte des tweets par hashtag: ${error.message}`);
      return [];
    }
  }

  /**
   * Collecte des tweets à partir des comptes configurés
   */
  async collectTweetsFromAccounts() {
    if (!this.isAuthenticated) await this.authenticate();
    
    try {
      const allTweets = [];
      
      for (const account of config.sources.accounts) {
        logger.info(`Collecte des tweets pour le compte: ${account}`);
        const tweets = await this.scraper.getTweets(account, config.sources.maxTweetsPerSource);
        if (tweets && tweets.length > 0) {
          allTweets.push(...tweets);
          logger.info(`${tweets.length} tweets collectés pour ${account}`);
        }
      }
      
      return allTweets;
    } catch (error) {
      logger.error(`Erreur lors de la collecte des tweets par compte: ${error.message}`);
      return [];
    }
  }

  /**
   * Publie un tweet contenant les tendances découvertes
   */
  async publishTrends(trendReport) {
    if (!this.isAuthenticated) await this.authenticate();
    
    try {
      logger.info('Publication des tendances détectées...');
      const result = await this.scraper.sendTweet(trendReport);
      
      if (result && result.id) {
        logger.info(`Tendances publiées avec succès! ID du tweet: ${result.id}`);
        return true;
      } else {
        logger.warn('Publication des tendances terminée mais sans confirmation');
        return false;
      }
    } catch (error) {
      logger.error(`Erreur lors de la publication des tendances: ${error.message}`);
      return false;
    }
  }

  /**
   * Récupère les tendances mondiales actuelles
   */
  async getGlobalTrends() {
    if (!this.isAuthenticated) await this.authenticate();
    
    try {
      const trends = await this.scraper.getTrends();
      return trends || [];
    } catch (error) {
      logger.error(`Erreur lors de la récupération des tendances globales: ${error.message}`);
      return [];
    }
  }
}

// Exporter une instance singleton
const twitterClient = new TwitterClient();
export default twitterClient;