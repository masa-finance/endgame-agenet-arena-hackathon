// AutonomyService.js - Gestion de l'autonomie du système
import config from '../config/config.js';
import logger from '../utils/logger.js';
import topicManager from '../utils/topic-manager.js';

class AutonomyService {
  constructor(trendSnipper) {
    this.trendSnipper = trendSnipper;
  }

  // Vérifier et maintenir l'autonomie de l'agent
  async checkAutonomyStatus() {
    try {
      logger.info('Running autonomy status check...');
      
      const hashtags = topicManager.getHashtags();
      const accounts = topicManager.getAccounts();
      
      // Vérifier si nous avons suffisamment de sources
      const hasSufficientSources = 
        hashtags.length >= 5 && 
        accounts.length >= 3;
      
      if (!hasSufficientSources) {
        logger.warn(`Insufficient sources detected: ${hashtags.length} hashtags, ${accounts.length} accounts`);
        logger.info('Triggering emergency topic discovery to maintain autonomy');
        
        // Forcer une découverte de sujets d'urgence
        await this.trendSnipper.topicDiscoveryService.runEmergencyDiscovery();
      }
      
      // Vérifier les statistiques des cycles et adapter la planification si nécessaire
      if (this.trendSnipper.cycleStats.cycleTweetCounts.length >= 3) {
        this.trendSnipper.schedulerService.adjustSchedulingBasedOnActivity();
      }
      
      logger.info('Autonomy check completed');
    } catch (error) {
      logger.error(`Error during autonomy check: ${error.message}`);
    }
  }
}

export default AutonomyService;