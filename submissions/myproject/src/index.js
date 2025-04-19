import config from './config.js';
import logger from './utils/logger.js';
import scheduler from './utils/scheduler.js';
import twitterClient from './twitter-client.js';
import trendDetector from './trend-detector.js';
import mcpServer from './mcp/server.js';

class TrendSnipper {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Initialise et démarre l'agent
   */
  async start() {
    try {
      logger.info('Démarrage de TrendSnipper...');
      
      // Authentification Twitter
      const authenticated = await twitterClient.authenticate();
      if (!authenticated) {
        logger.error('Échec de l\'authentification Twitter, arrêt de l\'application');
        process.exit(1);
      }
      
      // Initialisation du serveur MCP
      await mcpServer.initialize();
      
      // Planification de la détection des tendances
      scheduler.schedule(
        'trend-detection',
        config.scheduler.cronSchedule,
        this.runTrendDetectionCycle.bind(this),
        true // Exécution immédiate en plus de la planification
      );
      
      this.isRunning = true;
      logger.info('TrendSnipper démarré avec succès');
      
      // Gestion de l'arrêt propre
      this.setupGracefulShutdown();
    } catch (error) {
      logger.error(`Erreur lors du démarrage de TrendSnipper: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Exécute un cycle complet de détection des tendances
   */
  async runTrendDetectionCycle() {
    try {
      logger.info('Début du cycle de détection des tendances');
      
      // 1. Collecte des tweets
      logger.info('Collecte des tweets...');
      const hashtagTweets = await twitterClient.collectTweetsFromHashtags();
      const accountTweets = await twitterClient.collectTweetsFromAccounts();
      
      // Fusionner et dédupliquer les tweets (sur la base de l'ID)
      const tweetMap = new Map();
      [...hashtagTweets, ...accountTweets].forEach(tweet => {
        if (tweet.id) {
          tweetMap.set(tweet.id, tweet);
        }
      });
      
      const allTweets = Array.from(tweetMap.values());
      logger.info(`Total de ${allTweets.length} tweets uniques collectés`);
      
      if (allTweets.length === 0) {
        logger.warn('Aucun tweet collecté, annulation du cycle de détection');
        return;
      }
      
      // 2. Analyse des tendances
      logger.info('Analyse des tendances...');
      const emergingTrends = await trendDetector.analyzeTweets(allTweets);
      
      // 3. Mise à jour du serveur MCP avec les tendances détectées
      mcpServer.updateTrends(emergingTrends);
      
      // 4. Générer et publier un rapport de tendances
      if (emergingTrends.length > 0) {
        logger.info('Génération du rapport de tendances...');
        const trendReport = trendDetector.generateTrendReport();
        
        logger.info('Publication des tendances sur Twitter...');
        await twitterClient.publishTrends(trendReport);
      } else {
        logger.info('Aucune tendance émergente détectée dans ce cycle');
      }
      
      logger.info('Cycle de détection des tendances terminé avec succès');
    } catch (error) {
      logger.error(`Erreur lors du cycle de détection des tendances: ${error.message}`);
    }
  }

  /**
   * Configure les gestionnaires pour un arrêt propre
   */
  setupGracefulShutdown() {
    const shutdown = async () => {
      if (!this.isRunning) return;
      
      logger.info('Arrêt de TrendSnipper...');
      
      // Arrêt des tâches planifiées
      scheduler.stopAll();
      
      // Autres nettoyages si nécessaire
      
      this.isRunning = false;
      logger.info('TrendSnipper arrêté avec succès');
      process.exit(0);
    };
    
    // Capture des signaux d'arrêt
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('uncaughtException', (error) => {
      logger.error(`Exception non gérée: ${error.message}`);
      shutdown();
    });
  }
}

// Point d'entrée principal
const app = new TrendSnipper();
app.start().catch((error) => {
  logger.error(`Erreur fatale: ${error.message}`);
  process.exit(1);
});