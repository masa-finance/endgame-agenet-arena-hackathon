// TrendDetectionService.js - Service de détection des tendances
import config from '../config/config.js';
import logger from '../utils/logger.js';
import twitterClient from '../twitter-client/index.js';
import trendDetector from '../trend-detection/index.js';
import topicManager from '../utils/topic-manager.js';
import mcpServer from '../mcp/server.js';
import mcpClient from '../mcp/client.js';

class TrendDetectionService {
  constructor(trendSnipper) {
    this.trendSnipper = trendSnipper;
  }

  // Exécuter un cycle complet de détection de tendances
  async runTrendDetectionCycle() {
    try {
      const cycleStartTime = new Date();
      logger.info('Starting trend detection cycle');
      
      // 1. Obtenir les hashtags et comptes actuels à surveiller du gestionnaire de sujets
      const hashtagsToMonitor = topicManager.getHashtags();
      const accountsToMonitor = topicManager.getAccounts();
      
      logger.info(`Monitoring ${hashtagsToMonitor.length} hashtags and ${accountsToMonitor.length} accounts`);
      
      // 2. Collecter les tweets à partir des hashtags
      logger.info('Collecting tweets from hashtags...');
      let hashtagTweets = [];
      
      if (hashtagsToMonitor.length > 0) {
        const hashtagPromises = hashtagsToMonitor.map(hashtag => 
          twitterClient.scraper.searchTweets(hashtag, config.sources.maxTweetsPerSource)
        );
        const hashtagTweetsArrays = await Promise.all(hashtagPromises);
        hashtagTweets = hashtagTweetsArrays.flat();
        logger.info(`Collected ${hashtagTweets.length} tweets from hashtags`);
      } else {
        logger.warn('No hashtags configured for monitoring');
      }
      
      // 3. Collecter les tweets à partir des comptes
      logger.info('Collecting tweets from accounts...');
      let accountTweets = [];
      
      if (accountsToMonitor.length > 0) {
        const accountPromises = accountsToMonitor.map(account => 
          twitterClient.scraper.getTweets(account, config.sources.maxTweetsPerSource)
        );
        const accountTweetsArrays = await Promise.all(accountPromises);
        accountTweets = accountTweetsArrays.flat();
        logger.info(`Collected ${accountTweets.length} tweets from accounts`);
      } else {
        logger.warn('No accounts configured for monitoring');
      }
      
      // 4. Fusionner et dédupliquer les tweets (basé sur l'ID)
      const tweetMap = new Map();
      [...hashtagTweets, ...accountTweets].forEach(tweet => {
        if (tweet.id) {
          tweetMap.set(tweet.id, tweet);
        }
      });
      
      let allTweets = Array.from(tweetMap.values());
      logger.info(`Total of ${allTweets.length} unique tweets collected`);
      
      // Mettre à jour les statistiques de cycle
      this.trendSnipper.cycleStats.totalTweets += allTweets.length;
      this.trendSnipper.cycleStats.cycleTweetCounts.push(allTweets.length);
      if (this.trendSnipper.cycleStats.cycleTweetCounts.length > 10) {
        this.trendSnipper.cycleStats.cycleTweetCounts.shift(); // Garder seulement les 10 derniers
      }
      this.trendSnipper.cycleStats.averageTweetsPerCycle = 
        this.trendSnipper.cycleStats.cycleTweetCounts.reduce((sum, count) => sum + count, 0) / 
        this.trendSnipper.cycleStats.cycleTweetCounts.length;
      
      // 5. Si aucun tweet n'a été collecté, utiliser des stratégies de secours
      if (allTweets.length === 0) {
        logger.warn('No tweets collected, using fallback strategies');
        this.trendSnipper.fallbackAttempts++;
        
        allTweets = await this.handleNoTweetsScenario();
        
        // Si toutes les stratégies échouent
        if (allTweets.length === 0) {
          this.handleFailedCycle();
          return;
        }
      } else {
        // Réinitialiser le compteur de tentatives de secours si nous avons des tweets
        this.trendSnipper.fallbackAttempts = 0;
      }
      
      // 6. Analyser les tendances
      logger.info('Analyzing trends...');
      const emergingTrends = await trendDetector.analyzeTweets(allTweets);
      
      // 7. Mettre à jour le serveur MCP avec les tendances détectées
      mcpServer.updateTrends(emergingTrends);
      
      // 8. Gérer les tendances détectées
      await this.handleDetectedTrends(emergingTrends);
      
      // Calculer la durée du cycle
      const cycleDuration = new Date() - cycleStartTime;
      logger.info(`Trend detection cycle completed in ${cycleDuration/1000} seconds`);
      
      // Mettre à jour le timestamp du dernier cycle
      this.trendSnipper.cycleStats.lastCycleTime = new Date();
      
      // Ajuster dynamiquement la planification pour le prochain cycle
      this.trendSnipper.schedulerService.adjustSchedulingBasedOnActivity();
      
      // Mettre à jour et afficher le prochain temps de post
      this.trendSnipper.schedulerService.updateNextPostTime();
    } catch (error) {
      logger.error(`Error during trend detection cycle: ${error.message}`);
      this.trendSnipper.cycleStats.failedCycles++;
      
      // Ajuster la planification même en cas d'erreur
      this.trendSnipper.schedulerService.adjustSchedulingBasedOnActivity();
      
      // Mettre à jour et afficher le prochain temps de post même en cas d'erreur
      this.trendSnipper.schedulerService.updateNextPostTime();
    }
  }

  // Gérer le cas où aucun tweet n'est collecté
  async handleNoTweetsScenario() {
    // Stratégie 1: Collecter des tweets à partir des tendances globales
    logger.info('Attempting to collect tweets from global trends...');
    const globalTrends = await twitterClient.getGlobalTrends();
    
    if (globalTrends && globalTrends.length > 0) {
      logger.info(`Found ${globalTrends.length} global trends, collecting tweets from them`);
      const trendTweets = await this.collectTweetsFromTrends(globalTrends);
      
      if (trendTweets.length > 0) {
        logger.info(`Successfully collected ${trendTweets.length} tweets from global trends`);
        return trendTweets;
      }
    }
    
    // Stratégie 2: Déclencher proactivement la découverte de nouveaux sujets/comptes
    logger.info('Proactively triggering topic discovery cycle');
    setTimeout(() => this.trendSnipper.topicDiscoveryService.runTopicDiscoveryCycle(), 1000);
    
    // Stratégie 3: Si toujours aucun tweet, générer des tendances synthétiques avec l'IA
    if (config.analysis.autonomousFallback.generateSyntheticTrends) {
      logger.info('No tweets available, generating synthetic trends');
      const syntheticTrends = await trendDetector.generateSyntheticTrends();
      
      if (syntheticTrends && syntheticTrends.length > 0) {
        logger.info(`Generated ${syntheticTrends.length} synthetic trends`);
        mcpServer.updateTrends(syntheticTrends);
        
        const trendReport = await trendDetector.generateTrendReport(syntheticTrends);
        
        if (config.reporting.autonomousPublishing.enabled) {
          await twitterClient.publishTrends(trendReport);
          this.trendSnipper.cycleStats.publishedTrends++;
        }
        
        // Mettre à jour les statistiques
        this.trendSnipper.cycleStats.successfulCycles++;
        this.trendSnipper.cycleStats.totalTrendsFound += syntheticTrends.length;
        this.trendSnipper.cycleStats.lastCycleTime = new Date();
        
        // Ajuster dynamiquement la planification pour le prochain cycle
        this.trendSnipper.schedulerService.adjustSchedulingBasedOnActivity();
        
        // Mettre à jour et afficher le prochain temps de post
        this.trendSnipper.schedulerService.updateNextPostTime();
        
        logger.info('Fallback trend detection cycle completed with synthetic trends');
      }
    }
    
    return [];
  }

  // Gérer un cycle échoué
  handleFailedCycle() {
    this.trendSnipper.cycleStats.failedCycles++;
    this.trendSnipper.cycleStats.lastCycleTime = new Date();
    logger.warn('All fallback strategies failed, ending detection cycle');
    
    // Ajuster dynamiquement la planification
    this.trendSnipper.schedulerService.adjustSchedulingBasedOnActivity();
    
    // Mettre à jour et afficher le prochain temps de post
    this.trendSnipper.schedulerService.updateNextPostTime();
  }

  // Gérer les tendances détectées
  async handleDetectedTrends(emergingTrends) {
    // 8. Générer et publier un rapport de tendance
    if (emergingTrends.length > 0) {
      this.trendSnipper.cycleStats.totalTrendsFound += emergingTrends.length;
      
      logger.info('Generating trend report...');
      const trendReport = await trendDetector.generateTrendReport(emergingTrends);
      
      // Publier uniquement si suffisamment de tendances ont été trouvées et si la publication est activée
      if (emergingTrends.length >= config.reporting.autonomousPublishing.minTrendsForPublication && 
          config.reporting.autonomousPublishing.enabled) {
        logger.info('Publishing trends on Twitter...');
        await twitterClient.publishTrends(trendReport);
        this.trendSnipper.cycleStats.publishedTrends++;
      } else {
        logger.info('Skipping trend publication (threshold not met or publishing disabled)');
      }
      
      // 9. Utiliser les serveurs MCP externes pour enrichir l'analyse
      await this.enrichTrendsWithExternalMcp(emergingTrends);
      
      // 10. Déclencher la découverte de sujets si nécessaire
      if (topicManager.needsRefresh()) {
        logger.info('Topic refresh needed, scheduling discovery cycle');
        setTimeout(() => this.trendSnipper.topicDiscoveryService.runTopicDiscoveryCycle(emergingTrends), 1000);
      }
      
      this.trendSnipper.cycleStats.successfulCycles++;
    } else {
      logger.info('No emerging trends detected in this cycle');
      this.trendSnipper.cycleStats.failedCycles++;
    }
  }

  // Collecter des tweets à partir des tendances
  async collectTweetsFromTrends(trends) {
    try {
      const allTrendTweets = [];
      
      // Prendre les 5 premières tendances pour éviter les limitations d'API
      const trendsToUse = trends.slice(0, 5);
      
      for (const trend of trendsToUse) {
        const query = trend.name || trend.term || trend.query;
        if (!query) continue;
        
        logger.info(`Collecting tweets for trend: ${query}`);
        try {
          const tweets = await twitterClient.scraper.searchTweets(query, config.sources.maxTweetsPerSource);
          if (tweets && tweets.length > 0) {
            allTrendTweets.push(...tweets);
            logger.info(`Collected ${tweets.length} tweets for trend "${query}"`);
          }
        } catch (searchError) {
          logger.error(`Error searching tweets for trend "${query}": ${searchError.message}`);
        }
      }
      
      return allTrendTweets;
    } catch (error) {
      logger.error(`Error collecting tweets from trends: ${error.message}`);
      return [];
    }
  }

  // Enrichir l'analyse des tendances avec des serveurs MCP externes
  async enrichTrendsWithExternalMcp(trends) {
    // Si aucun serveur externe n'est connecté, on ignore cette étape
    if (!mcpClient.connectedServers || mcpClient.connectedServers.size === 0) return;
    
    logger.info('Enriching trends with external MCP servers...');
    
    try {
      for (const trend of trends) {
        const term = trend.term;
        
        // Exemple d'utilisation d'un serveur MCP externe "brave-search"
        if (mcpClient.connectedServers.has('brave-search')) {
          try {
            const result = await mcpClient.callTool('search', { query: term });
            logger.info(`Enriched trend "${term}" with external search data`);
            
            // Stocker les données enrichies dans la tendance
            trend.externalData = result;
          } catch (toolError) {
            logger.warn(`Failed to enrich trend "${term}" with external data: ${toolError.message}`);
          }
        }
        
        // Utilisation d'un serveur MCP externe "weather" si disponible
        if (mcpClient.connectedServers.has('weather')) {
          try {
            const result = await mcpClient.callTool('current', {});
            logger.info(`Added weather context to trend "${term}"`);
            
            // Ajouter des données météo au contexte de la tendance
            trend.weatherContext = result;
          } catch (toolError) {
            logger.warn(`Failed to add weather context: ${toolError.message}`);
          }
        }
      }
    } catch (error) {
      logger.error(`Error enriching trends with external MCP: ${error.message}`);
    }
  }
}

export default TrendDetectionService;