// TrendSnipper.js - Classe principale du système
import config from './config/config.js';
import logger from './utils/logger.js';
import twitterClient from './twitter-client/index.js';
import openaiClient from './ai/openai-client.js';
import topicManager from './utils/topic-manager.js';
import mcpServer from './mcp/server.js';
import mcpClient from './mcp/client.js';

// Services
import SchedulerService from './services/SchedulerService.js';
import TrendDetectionService from './services/TrendDetectionService.js';
import TopicDiscoveryService from './services/TopicDiscoveryService.js';
import AutonomyService from './services/AutonomyService.js';

class TrendSnipper {
  constructor() {
    // État global
    this.isRunning = false;
    this.currentSchedule = config.scheduler.cronSchedule;
    this.activityLevel = 'medium'; // 'low', 'medium', 'high'
    this.fallbackAttempts = 0;
    this.autonomousMode = config.sources.autonomy.enabled;
    this.autoStart = config.agent.autoStart;
    
    // Statistiques
    this.cycleStats = {
      totalTweets: 0,
      successfulCycles: 0,
      failedCycles: 0,
      publishedTrends: 0,
      lastCycleTime: null,
      totalTrendsFound: 0,
      averageTweetsPerCycle: 0,
      cycleTweetCounts: [], // historique pour calcul de moyenne
      nextPostTime: null
    };
    
    // Initialisation des services
    this.schedulerService = new SchedulerService(this);
    this.trendDetectionService = new TrendDetectionService(this);
    this.topicDiscoveryService = new TopicDiscoveryService(this);
    this.autonomyService = new AutonomyService(this);
  }

  // Initialise et démarre l'agent
  async start() {
    try {
      logger.info(`Starting TrendSnipper in ${this.autoStart ? 'auto-start' : 'manual'} mode...`);
      
      // Initialiser le client OpenAI si configuré
      if (config.openai && config.openai.apiKey) {
        const openaiInitialized = openaiClient.initialize();
        if (!openaiInitialized) {
          logger.warn('OpenAI client initialization failed, will use traditional trend detection');
        }
      } else {
        logger.info('OpenAI integration not configured, using traditional trend detection');
      }
      
      // Initialiser le gestionnaire de sujets
      await topicManager.initialize();
      
      // Si aucun compte n'est configuré, en générer automatiquement avec OpenAI
      if (topicManager.getAccounts().length === 0 && config.openai.apiKey) {
        logger.info('No accounts configured, generating initial accounts with AI...');
        await this.topicDiscoveryService.generateInitialAccounts();
      }
      
      // Authentification Twitter
      const authenticated = await twitterClient.authenticate();
      if (!authenticated) {
        logger.error('Twitter authentication failed, stopping application');
        process.exit(1);
      }
      
      // Initialisation du serveur et client MCP
      await mcpServer.initialize();
      await this.initializeMcpClient();
      
      // Planification des tâches
      this.scheduleTasks();
      
      this.isRunning = true;
      logger.info(`TrendSnipper started successfully in ${this.autoStart ? 'auto-start' : 'manual'} mode`);
      
      // Configurer l'arrêt gracieux
      this.setupGracefulShutdown();
    } catch (error) {
      logger.error(`Error starting TrendSnipper: ${error.message}`);
      process.exit(1);
    }
  }

  // Planifier les différentes tâches
  scheduleTasks() {
    if (this.autoStart) {
      logger.info('Auto-start enabled, scheduling trend detection');
      
      this.schedulerService.scheduleTask(
        'trend-detection',
        this.currentSchedule,
        this.trendDetectionService.runTrendDetectionCycle.bind(this.trendDetectionService),
        true // Exécution immédiate en plus de la planification
      );
      
      // Calculer et afficher le moment du prochain post
      this.schedulerService.updateNextPostTime();
    } else {
      logger.info('Auto-start disabled, trend detection NOT scheduled automatically');
      logger.info('Use the API to manually trigger trend detection');
    }
    
    // Planifier la découverte de nouveaux sujets si activée
    if (config.sources.discovery.enabled && this.autoStart) {
      this.schedulerService.scheduleTask(
        'topic-discovery',
        config.scheduler.discoveryCronSchedule,
        this.topicDiscoveryService.runTopicDiscoveryCycle.bind(this.topicDiscoveryService),
        this.autonomousMode // Exécution immédiate en mode autonome
      );
    }
    
    // Si nous sommes en mode autonome, vérifier l'état régulièrement
    if (this.autonomousMode && this.autoStart) {
      this.schedulerService.scheduleTask(
        'autonomy-check',
        '0 */2 * * *', // Toutes les 2 heures
        this.autonomyService.checkAutonomyStatus.bind(this.autonomyService),
        false
      );
    }
  }

  // Initialiser le client MCP et se connecter aux serveurs externes
  async initializeMcpClient() {
    try {
      const { externalServers } = config.mcp.client;
      
      if (!externalServers || externalServers.length === 0) {
        logger.info('No external MCP servers configured, skipping client initialization');
        return;
      }
      
      logger.info(`Initializing MCP client with ${externalServers.length} external servers...`);
      
      for (const server of externalServers) {
        const { id, command, args } = server;
        const connected = await mcpClient.connectToServer(id, command, args);
        
        if (connected) {
          logger.info(`Successfully connected to external MCP server: ${id}`);
        } else {
          logger.warn(`Failed to connect to external MCP server: ${id}`);
        }
      }
    } catch (error) {
      logger.error(`Error initializing MCP client: ${error.message}`);
      throw error;
    }
  }

  // Configurer les gestionnaires pour un arrêt gracieux
  setupGracefulShutdown() {
    const shutdown = async () => {
      if (!this.isRunning) return;
      
      logger.info('Stopping TrendSnipper...');
      
      // Arrêter les tâches planifiées
      this.schedulerService.stopAllTasks();
      
      // Fermer les connexions du client MCP
      await mcpClient.closeAll();
      
      this.isRunning = false;
      logger.info('TrendSnipper stopped successfully');
      process.exit(0);
    };
    
    // Capturer les signaux d'arrêt
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('uncaughtException', (error) => {
      logger.error(`Uncaught exception: ${error.message}`);
      shutdown();
    });
  }
}

export default TrendSnipper;