// TopicDiscoveryService.js - Service de découverte de sujets
import config from '../config/config.js';
import logger from '../utils/logger.js';
import twitterClient from '../twitter-client/index.js';
import trendDetector from '../trend-detection/index.js';
import openaiClient from '../ai/openai-client.js';
import topicManager from '../utils/topic-manager.js';

class TopicDiscoveryService {
  constructor(trendSnipper) {
    this.trendSnipper = trendSnipper;
  }

  // Exécuter un cycle de découverte de sujet pour trouver de nouveaux hashtags et comptes
  async runTopicDiscoveryCycle(recentTrends = null) {
    try {
      logger.info('Starting topic discovery cycle');
      
      // Si aucune tendance n'a été fournie, utiliser les dernières tendances
      const trendsToUse = recentTrends || trendDetector.emergingTrends;
      
      if (!trendsToUse || trendsToUse.length === 0) {
        logger.info('No trends available for topic discovery, collecting global trends');
        
        // Essayer d'obtenir des tendances globales si aucune tendance spécifique n'est disponible
        const globalTrends = await twitterClient.getGlobalTrends();
        
        if (globalTrends && globalTrends.length > 0) {
          // Formater les tendances globales pour correspondre à notre format de tendance
          const formattedGlobalTrends = globalTrends.map(trend => ({
            term: trend.name,
            count: trend.tweet_volume || 0,
            growthRate: 100, // Valeur par défaut
            isNew: true
          }));
          
          await topicManager.discoverNewTopics(formattedGlobalTrends);
        } else {
          logger.warn('No global trends available, using AI for topic discovery');
          
          // Utiliser l'IA pour générer des suggestions de sujets si OpenAI est configuré
          if (config.openai && config.openai.apiKey) {
            const currentTopics = topicManager.getHashtags();
            const aiSuggestions = await openaiClient.suggestTopicsToMonitor(currentTopics, []);
            
            if (aiSuggestions && aiSuggestions.length > 0) {
              logger.info(`Generated ${aiSuggestions.length} topic suggestions with AI`);
              
              // Convertir en format de tendance
              const aiTrends = aiSuggestions.map(suggestion => ({
                term: suggestion.topic,
                count: 10, // Valeur arbitraire
                growthRate: 100,
                isNew: true,
                category: suggestion.category
              }));
              
              await topicManager.discoverNewTopics(aiTrends);
            } else {
              logger.warn('AI failed to generate topic suggestions');
            }
          } else {
            logger.warn('No trends available for topic discovery and AI is not configured, skipping cycle');
          }
        }
      } else {
        // Utiliser les tendances détectées pour la découverte
        await topicManager.discoverNewTopics(trendsToUse);
      }
      
      logger.info('Topic discovery cycle completed');
    } catch (error) {
      logger.error(`Error during topic discovery cycle: ${error.message}`);
    }
  }

  // Générer des comptes initiaux à suivre avec l'IA
  async generateInitialAccounts() {
    try {
      if (!config.openai.apiKey) return;
      
      const initialTopics = topicManager.getHashtags();
      const suggestedAccounts = await openaiClient.suggestAccountsToFollow(initialTopics, []);
      
      if (suggestedAccounts && suggestedAccounts.length > 0) {
        logger.info(`Generated ${suggestedAccounts.length} initial accounts to follow`);
        
        for (const account of suggestedAccounts.slice(0, 5)) {
          await topicManager.addAccount(account.username);
        }
      }
    } catch (error) {
      logger.error(`Error generating initial accounts: ${error.message}`);
    }
  }

  // Découverte d'urgence pour maintenir l'autonomie
  async runEmergencyDiscovery() {
    try {
      logger.info('Starting emergency topic discovery...');
      
      // 1. Essayer d'obtenir des tendances globales
      const globalTrends = await twitterClient.getGlobalTrends();
      
      if (globalTrends && globalTrends.length > 0) {
        logger.info(`Found ${globalTrends.length} global trends for emergency discovery`);
        
        // Formater les tendances globales pour correspondre à notre format de tendance
        const formattedGlobalTrends = globalTrends.map(trend => ({
          term: trend.name,
          count: trend.tweet_volume || 0,
          growthRate: 100,
          isNew: true
        }));
        
        await topicManager.discoverNewTopics(formattedGlobalTrends);
      } else {
        logger.warn('No global trends available, using AI for emergency discovery');
        
        // 2. Utiliser l'IA pour générer des sujets de secours
        if (config.openai.apiKey) {
          const emergencyTopics = await openaiClient.generateEmergencyTopics();
          if (emergencyTopics && emergencyTopics.length > 0) {
            logger.info(`Generated ${emergencyTopics.length} emergency topics with AI`);
            
            for (const topic of emergencyTopics) {
              await topicManager.addHashtag(topic.term);
            }
          }
        }
        
        // 3. Générer des comptes influents à suivre
        if (config.openai.apiKey) {
          const emergencyAccounts = await openaiClient.generateEmergencyAccounts();
          if (emergencyAccounts && emergencyAccounts.length > 0) {
            logger.info(`Generated ${emergencyAccounts.length} emergency accounts to follow with AI`);
            
            for (const account of emergencyAccounts) {
              await topicManager.addAccount(account.username);
            }
          }
        }
      }
      
      // 4. Essayer d'utiliser le protocole Masa en dernier recours
      if (config.masa.enabled && config.masa.useForFallback) {
        try {
          const masaTrends = await this.trendSnipper.masaClient.getTrends();
          if (masaTrends && masaTrends.length > 0) {
            logger.info(`Retrieved ${masaTrends.length} trends from Masa protocol`);
            
            for (const trend of masaTrends.slice(0, 5)) {
              await topicManager.addHashtag(trend.term);
            }
          }
        } catch (masaError) {
          logger.error(`Error using Masa protocol for emergency: ${masaError.message}`);
        }
      }
      
      logger.info('Emergency discovery completed');
    } catch (error) {
      logger.error(`Error during emergency discovery: ${error.message}`);
    }
  }
}

export default TopicDiscoveryService;