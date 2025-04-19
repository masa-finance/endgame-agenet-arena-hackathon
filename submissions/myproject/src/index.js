import config from './config.js';
import logger from './utils/logger.js';
import scheduler from './utils/scheduler.js';
import twitterClient from './twitter-client.js';
import trendDetector from './trend-detector.js';
import openaiClient from './ai/openai-client.js';
import topicManager from './utils/topic-manager.js';
import mcpServer from './mcp/server.js';
import mcpClient from './mcp/mcp-client.js';
import masaClient from './utils/masa-client.js';
import cronParser from 'cron-parser';

class TrendSnipper {
  constructor() {
    this.isRunning = false;
    this.currentSchedule = config.scheduler.cronSchedule;
    this.activityLevel = 'medium'; // 'low', 'medium', 'high'
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
    this.fallbackAttempts = 0;
    this.autonomousMode = config.sources.autonomy.enabled;
    this.autoStart = config.agent.autoStart;
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
      
      // Initialiser le gestionnaire de sujets pour la découverte dynamique
      await topicManager.initialize();
      
      // Si aucun compte n'est configuré, en générer automatiquement avec OpenAI
      if (topicManager.getAccounts().length === 0 && config.openai.apiKey) {
        logger.info('No accounts configured, generating initial accounts with AI...');
        await this.generateInitialAccounts();
      }
      
      // Authentification Twitter
      const authenticated = await twitterClient.authenticate();
      if (!authenticated) {
        logger.error('Twitter authentication failed, stopping application');
        process.exit(1);
      }
      
      // Initialisation du serveur MCP
      await mcpServer.initialize();
      
      // Initialisation du client MCP et connexions aux serveurs externes
      await this.initializeMcpClient();
      
      // Si l'autoStart est activé, planifier la détection de tendances
      if (this.autoStart) {
        logger.info('Auto-start enabled, scheduling trend detection');
        
        scheduler.schedule(
          'trend-detection',
          this.currentSchedule,
          this.runTrendDetectionCycle.bind(this),
          true // Exécution immédiate en plus de la planification
        );
        
        // Calculer et afficher le moment du prochain post
        this.updateNextPostTime();
      } else {
        logger.info('Auto-start disabled, trend detection NOT scheduled automatically');
        logger.info('Use the API to manually trigger trend detection');
      }
      
      // Planifier la découverte de nouveaux sujets si activée
      if (config.sources.discovery.enabled && this.autoStart) {
        scheduler.schedule(
          'topic-discovery',
          config.scheduler.discoveryCronSchedule,
          this.runTopicDiscoveryCycle.bind(this),
          this.autonomousMode // Exécution immédiate en mode autonome
        );
      }
      
      // Si nous sommes en mode autonome, vérifions l'état des sources régulièrement
      if (this.autonomousMode && this.autoStart) {
        scheduler.schedule(
          'autonomy-check',
          '0 */2 * * *', // Toutes les 2 heures
          this.checkAutonomyStatus.bind(this),
          false
        );
      }
      
      this.isRunning = true;
      logger.info(`TrendSnipper started successfully in ${this.autoStart ? 'auto-start' : 'manual'} mode`);
      
      // Configurer l'arrêt gracieux
      this.setupGracefulShutdown();
    } catch (error) {
      logger.error(`Error starting TrendSnipper: ${error.message}`);
      process.exit(1);
    }
  }

  // Mettre à jour et afficher le prochain temps prévu pour le post
  updateNextPostTime() {
    try {
      if (config.agent.showNextPostTime) {
        const now = new Date();
        const cronExpression = this.currentSchedule;
        // Utilisez cronParser.parseExpression au lieu de parseExpression
        const interval = cronParser.parseExpression(cronExpression);
        const nextTime = interval.next().toDate();
        
        this.cycleStats.nextPostTime = nextTime;
        
        // Formater la date et l'heure
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
        
        const formattedDate = nextTime.toLocaleDateString('fr-FR', dateOptions);
        const formattedTime = nextTime.toLocaleTimeString('fr-FR', timeOptions);
        
        logger.info(`📅 Next post scheduled for: ${formattedDate} at ${formattedTime}`);
      }
    } catch (error) {
      logger.error(`Error calculating next post time: ${error.message}`);
    }
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
        await this.runEmergencyDiscovery();
      }
      
      // Vérifier les statistiques des cycles et adapter la planification si nécessaire
      if (this.cycleStats.cycleTweetCounts.length >= 3) {
        this.adjustSchedulingBasedOnActivity();
      }
      
      logger.info('Autonomy check completed');
    } catch (error) {
      logger.error(`Error during autonomy check: ${error.message}`);
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
          const masaTrends = await masaClient.getTrends();
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
      this.cycleStats.totalTweets += allTweets.length;
      this.cycleStats.cycleTweetCounts.push(allTweets.length);
      if (this.cycleStats.cycleTweetCounts.length > 10) {
        this.cycleStats.cycleTweetCounts.shift(); // Garder seulement les 10 derniers
      }
      this.cycleStats.averageTweetsPerCycle = 
        this.cycleStats.cycleTweetCounts.reduce((sum, count) => sum + count, 0) / 
        this.cycleStats.cycleTweetCounts.length;
      
      // 5. Si aucun tweet n'a été collecté, utiliser des stratégies de secours
      if (allTweets.length === 0) {
        logger.warn('No tweets collected, using fallback strategies');
        this.fallbackAttempts++;
        
        // Stratégie 1: Collecter des tweets à partir des tendances globales
        logger.info('Attempting to collect tweets from global trends...');
        const globalTrends = await twitterClient.getGlobalTrends();
        
        if (globalTrends && globalTrends.length > 0) {
          logger.info(`Found ${globalTrends.length} global trends, collecting tweets from them`);
          const trendTweets = await this.collectTweetsFromTrends(globalTrends);
          
          if (trendTweets.length > 0) {
            allTweets = trendTweets;
            logger.info(`Successfully collected ${trendTweets.length} tweets from global trends`);
          }
        }
        
        // Stratégie 2: Déclencher proactivement la découverte de nouveaux sujets/comptes
        logger.info('Proactively triggering topic discovery cycle');
        setTimeout(() => this.runTopicDiscoveryCycle(), 1000);
        
        // Stratégie 3: Si toujours aucun tweet, générer des tendances synthétiques avec l'IA
        if (allTweets.length === 0 && config.analysis.autonomousFallback.generateSyntheticTrends) {
          logger.info('No tweets available, generating synthetic trends');
          const syntheticTrends = await trendDetector.generateSyntheticTrends();
          
          if (syntheticTrends && syntheticTrends.length > 0) {
            logger.info(`Generated ${syntheticTrends.length} synthetic trends`);
            mcpServer.updateTrends(syntheticTrends);
            
            const trendReport = await trendDetector.generateTrendReport(syntheticTrends);
            
            if (config.reporting.autonomousPublishing.enabled) {
              await twitterClient.publishTrends(trendReport);
              this.cycleStats.publishedTrends++;
            }
            
            // Mettre à jour les statistiques
            this.cycleStats.successfulCycles++;
            this.cycleStats.totalTrendsFound += syntheticTrends.length;
            this.cycleStats.lastCycleTime = new Date();
            
            // Ajuster dynamiquement la planification pour le prochain cycle
            this.adjustSchedulingBasedOnActivity();
            
            // Mettre à jour et afficher le prochain temps de post
            this.updateNextPostTime();
            
            logger.info('Fallback trend detection cycle completed with synthetic trends');
            return;
          }
        }
        
        // Si toutes les stratégies échouent, marquer le cycle comme échoué
        if (allTweets.length === 0) {
          this.cycleStats.failedCycles++;
          this.cycleStats.lastCycleTime = new Date();
          logger.warn('All fallback strategies failed, ending detection cycle');
          
          // Ajuster dynamiquement la planification
          this.adjustSchedulingBasedOnActivity();
          
          // Mettre à jour et afficher le prochain temps de post
          this.updateNextPostTime();
          
          return;
        }
      } else {
        // Réinitialiser le compteur de tentatives de secours si nous avons des tweets
        this.fallbackAttempts = 0;
      }
      
      // 6. Analyser les tendances
      logger.info('Analyzing trends...');
      const emergingTrends = await trendDetector.analyzeTweets(allTweets);
      
      // 7. Mettre à jour le serveur MCP avec les tendances détectées
      mcpServer.updateTrends(emergingTrends);
      
      // 8. Générer et publier un rapport de tendance
      if (emergingTrends.length > 0) {
        this.cycleStats.totalTrendsFound += emergingTrends.length;
        
        logger.info('Generating trend report...');
        const trendReport = await trendDetector.generateTrendReport(emergingTrends);
        
        // Publier uniquement si suffisamment de tendances ont été trouvées et si la publication est activée
        if (emergingTrends.length >= config.reporting.autonomousPublishing.minTrendsForPublication && 
            config.reporting.autonomousPublishing.enabled) {
          logger.info('Publishing trends on Twitter...');
          await twitterClient.publishTrends(trendReport);
          this.cycleStats.publishedTrends++;
        } else {
          logger.info('Skipping trend publication (threshold not met or publishing disabled)');
        }
        
        // 9. Utiliser les serveurs MCP externes pour enrichir l'analyse
        await this.enrichTrendsWithExternalMcp(emergingTrends);
        
        // 10. Déclencher la découverte de sujets si nécessaire
        if (topicManager.needsRefresh()) {
          logger.info('Topic refresh needed, scheduling discovery cycle');
          setTimeout(() => this.runTopicDiscoveryCycle(emergingTrends), 1000);
        }
        
        this.cycleStats.successfulCycles++;
      } else {
        logger.info('No emerging trends detected in this cycle');
        this.cycleStats.failedCycles++;
      }
      
      // Calculer la durée du cycle
      const cycleDuration = new Date() - cycleStartTime;
      logger.info(`Trend detection cycle completed in ${cycleDuration/1000} seconds`);
      
      // Mettre à jour le timestamp du dernier cycle
      this.cycleStats.lastCycleTime = new Date();
      
      // Ajuster dynamiquement la planification pour le prochain cycle
      this.adjustSchedulingBasedOnActivity();
      
      // Mettre à jour et afficher le prochain temps de post
      this.updateNextPostTime();
    } catch (error) {
      logger.error(`Error during trend detection cycle: ${error.message}`);
      this.cycleStats.failedCycles++;
      
      // Ajuster la planification même en cas d'erreur
      this.adjustSchedulingBasedOnActivity();
      
      // Mettre à jour et afficher le prochain temps de post même en cas d'erreur
      this.updateNextPostTime();
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

  // Ajuster dynamiquement la planification en fonction de l'activité
  adjustSchedulingBasedOnActivity() {
    try {
      if (!config.scheduler.dynamic.enabled) return;
      
      logger.info('Evaluating scheduler adjustment based on activity level');
      
      // Déterminer le niveau d'activité actuel
      let newActivityLevel = 'medium';
      
      // Si nous avons assez de données pour évaluer
      if (this.cycleStats.cycleTweetCounts.length >= 3) {
        const avgTweets = this.cycleStats.averageTweetsPerCycle;
        
        if (avgTweets > 300) {
          newActivityLevel = 'high';
        } else if (avgTweets < 50) {
          newActivityLevel = 'low';
        }
        
        // Aussi tenir compte du taux de réussite
        const totalCycles = this.cycleStats.successfulCycles + this.cycleStats.failedCycles;
        if (totalCycles > 0) {
          const successRate = this.cycleStats.successfulCycles / totalCycles;
          
          if (successRate < 0.3) {
            // Si le taux de réussite est bas, considérer comme activité faible
            newActivityLevel = 'low';
          }
        }
      }
      
      // Définir le nouvel horaire en fonction du niveau d'activité
      let newSchedule;
      if (newActivityLevel === 'high') {
        newSchedule = config.scheduler.dynamic.minInterval; // plus fréquent
        logger.info('High activity detected, increasing check frequency');
      } else if (newActivityLevel === 'low') {
        newSchedule = config.scheduler.dynamic.maxInterval; // moins fréquent
        logger.info('Low activity detected, decreasing check frequency');
      } else {
        newSchedule = config.scheduler.cronSchedule; // horaire par défaut
      }
      
      // Mettre à jour la planification si nécessaire
      if (newSchedule !== this.currentSchedule) {
        logger.info(`Adjusting schedule from ${this.currentSchedule} to ${newSchedule}`);
        
        this.currentSchedule = newSchedule;
        scheduler.stop('trend-detection');
        
        if (this.autoStart) {
          scheduler.schedule('trend-detection', newSchedule, this.runTrendDetectionCycle.bind(this), false);
          logger.info(`Task rescheduled with new frequency: ${newSchedule}`);
        } else {
          logger.info(`New schedule saved (${newSchedule}) but task not automatically rescheduled (auto-start disabled)`);
        }
      } else {
        logger.info(`Maintaining current schedule: ${this.currentSchedule}`);
      }
      
      // Mettre à jour le niveau d'activité
      this.activityLevel = newActivityLevel;
    } catch (error) {
      logger.error(`Error adjusting scheduling: ${error.message}`);
    }
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

  // Configurer les gestionnaires pour un arrêt gracieux
  setupGracefulShutdown() {
    const shutdown = async () => {
      if (!this.isRunning) return;
      
      logger.info('Stopping TrendSnipper...');
      
      // Arrêter les tâches planifiées
      scheduler.stopAll();
      
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

const trendSnipper = new TrendSnipper();

console.log('Starting TrendSnipper...');
trendSnipper.start().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});