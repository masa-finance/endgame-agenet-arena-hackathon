import config from './config.js';
import logger from './utils/logger.js';
import scheduler from './utils/scheduler.js';
import twitterClient from './twitter-client.js';
import trendDetector from './trend-detector.js';
import openaiClient from './ai/openai-client.js';
import topicManager from './utils/topic-manager.js';
import mcpServer from './mcp/server.js';
import mcpClient from './mcp/mcp-client.js';

class TrendSnipper {
  constructor() {
    this.isRunning = false;
  }

  // Initialize and start the agent
  async start() {
    try {
      logger.info('Starting TrendSnipper...');
      
      // Initialize OpenAI client if configured
      if (config.openai && config.openai.apiKey) {
        const openaiInitialized = openaiClient.initialize();
        if (!openaiInitialized) {
          logger.warn('OpenAI client initialization failed, will use traditional trend detection');
        }
      } else {
        logger.info('OpenAI integration not configured, using traditional trend detection');
      }
      
      // Initialize topic manager for dynamic topic discovery
      await topicManager.initialize();
      
      // Twitter authentication
      const authenticated = await twitterClient.authenticate();
      if (!authenticated) {
        logger.error('Twitter authentication failed, stopping application');
        process.exit(1);
      }
      
      // MCP server initialization
      await mcpServer.initialize();
      
      // MCP client initialization and connections to external servers
      await this.initializeMcpClient();
      
      // Schedule trend detection
      scheduler.schedule(
        'trend-detection',
        config.scheduler.cronSchedule,
        this.runTrendDetectionCycle.bind(this),
        true // Immediate execution in addition to scheduling
      );
      
      // Schedule discovery of new topics if enabled
      if (config.sources.discovery.enabled) {
        scheduler.schedule(
          'topic-discovery',
          config.scheduler.discoveryCronSchedule,
          this.runTopicDiscoveryCycle.bind(this),
          false // Don't run immediately, will run on schedule
        );
      }
      
      this.isRunning = true;
      logger.info('TrendSnipper started successfully');
      
      // Setup graceful shutdown handling
      this.setupGracefulShutdown();
    } catch (error) {
      logger.error(`Error starting TrendSnipper: ${error.message}`);
      process.exit(1);
    }
  }

  // Initialize MCP client and connect to external servers
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

  // Execute a complete trend detection cycle
  async runTrendDetectionCycle() {
    try {
      logger.info('Starting trend detection cycle');
      
      // 1. Get current hashtags and accounts to monitor from topic manager
      const hashtagsToMonitor = topicManager.getHashtags();
      const accountsToMonitor = topicManager.getAccounts();
      
      logger.info(`Monitoring ${hashtagsToMonitor.length} hashtags and ${accountsToMonitor.length} accounts`);
      
      // 2. Collect tweets from hashtags
      logger.info('Collecting tweets from hashtags...');
      const hashtagPromises = hashtagsToMonitor.map(hashtag => 
        twitterClient.scraper.searchTweets(hashtag, config.sources.maxTweetsPerSource)
      );
      const hashtagTweetsArrays = await Promise.all(hashtagPromises);
      const hashtagTweets = hashtagTweetsArrays.flat();
      
      // 3. Collect tweets from accounts
      logger.info('Collecting tweets from accounts...');
      const accountPromises = accountsToMonitor.map(account => 
        twitterClient.scraper.getTweets(account, config.sources.maxTweetsPerSource)
      );
      const accountTweetsArrays = await Promise.all(accountPromises);
      const accountTweets = accountTweetsArrays.flat();
      
      // 4. Merge and deduplicate tweets (based on ID)
      const tweetMap = new Map();
      [...hashtagTweets, ...accountTweets].forEach(tweet => {
        if (tweet.id) {
          tweetMap.set(tweet.id, tweet);
        }
      });
      
      const allTweets = Array.from(tweetMap.values());
      logger.info(`Total of ${allTweets.length} unique tweets collected`);
      
      if (allTweets.length === 0) {
        logger.warn('No tweets collected, cancelling detection cycle');
        return;
      }
      
      // 5. Analyze trends
      logger.info('Analyzing trends...');
      const emergingTrends = await trendDetector.analyzeTweets(allTweets);
      
      // 6. Update MCP server with detected trends
      mcpServer.updateTrends(emergingTrends);
      
      // 7. Generate and publish a trend report
      if (emergingTrends.length > 0) {
        logger.info('Generating trend report...');
        const trendReport = await trendDetector.generateTrendReport();
        
        logger.info('Publishing trends on Twitter...');
        await twitterClient.publishTrends(trendReport);
        
        // 8. Optionnel: Utiliser les serveurs MCP externes pour enrichir l'analyse
        await this.enrichTrendsWithExternalMcp(emergingTrends);
        
        // 9. Trigger topic discovery if needed (but don't wait for it)
        if (topicManager.needsRefresh()) {
          logger.info('Topic refresh needed, scheduling discovery cycle');
          setTimeout(() => this.runTopicDiscoveryCycle(emergingTrends), 1000);
        }
      } else {
        logger.info('No emerging trends detected in this cycle');
      }
      
      logger.info('Trend detection cycle completed successfully');
    } catch (error) {
      logger.error(`Error during trend detection cycle: ${error.message}`);
    }
  }

  // Run a topic discovery cycle to find new hashtags and accounts
  async runTopicDiscoveryCycle(recentTrends = null) {
    try {
      logger.info('Starting topic discovery cycle');
      
      // If no trends were provided, use latest trends
      const trendsToUse = recentTrends || trendDetector.emergingTrends;
      
      if (!trendsToUse || trendsToUse.length === 0) {
        logger.info('No trends available for topic discovery, collecting global trends');
        
        // Try to get global trends if no specific trends are available
        const globalTrends = await twitterClient.getGlobalTrends();
        
        if (globalTrends && globalTrends.length > 0) {
          // Format global trends to match our trend format
          const formattedGlobalTrends = globalTrends.map(trend => ({
            term: trend.name,
            count: trend.tweet_volume || 0,
            growthRate: 100, // Default value
            isNew: true
          }));
          
          await topicManager.discoverNewTopics(formattedGlobalTrends);
        } else {
          logger.warn('No trends available for topic discovery, skipping cycle');
        }
      } else {
        // Use detected trends for discovery
        await topicManager.discoverNewTopics(trendsToUse);
      }
      
      logger.info('Topic discovery cycle completed');
    } catch (error) {
      logger.error(`Error during topic discovery cycle: ${error.message}`);
    }
  }

  // Enrich trend analysis with external MCP servers
  async enrichTrendsWithExternalMcp(trends) {
    // Si aucun serveur externe n'est connecté, on ignore cette étape
    if (mcpClient.connectedServers.size === 0) return;
    
    logger.info('Enriching trends with external MCP servers...');
    
    try {
      for (const trend of trends) {
        const term = trend.term;
        
        // Exemple d'utilisation d'un serveur MCP externe "brave-search"
        // Ceci est un exemple - vous devrez l'adapter selon les serveurs MCP auxquels vous vous connectez
        if (mcpClient.connectedServers.has('brave-search')) {
          try {
            const result = await mcpClient.callTool('search', { query: term });
            logger.info(`Enriched trend "${term}" with external search data`);
            
            // Ici, vous pourriez stocker ou traiter les résultats enrichis
            trend.externalData = result;
          } catch (toolError) {
            logger.warn(`Failed to enrich trend "${term}" with external data: ${toolError.message}`);
          }
        }
      }
    } catch (error) {
      logger.error(`Error enriching trends with external MCP: ${error.message}`);
    }
  }

  // Configure handlers for graceful shutdown
  setupGracefulShutdown() {
    const shutdown = async () => {
      if (!this.isRunning) return;
      
      logger.info('Stopping TrendSnipper...');
      
      // Stop scheduled tasks
      scheduler.stopAll();
      
      // Close MCP client connections
      await mcpClient.closeAll();
      
      this.isRunning = false;
      logger.info('TrendSnipper stopped successfully');
      process.exit(0);
    };
    
    // Capture shutdown signals
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('uncaughtException', (error) => {
      logger.error(`Uncaught exception: ${error.message}`);
      shutdown();
    });
  }
}

// Main entry point
const app = new TrendSnipper();
app.start().catch((error) => {
  logger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});