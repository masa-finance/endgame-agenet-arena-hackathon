import config from './config.js';
import logger from './utils/logger.js';
import scheduler from './utils/scheduler.js';
import twitterClient from './twitter-client.js';
import trendDetector from './trend-detector.js';
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
      
      // 1. Collect tweets
      logger.info('Collecting tweets...');
      const hashtagTweets = await twitterClient.collectTweetsFromHashtags();
      const accountTweets = await twitterClient.collectTweetsFromAccounts();
      
      // Merge and deduplicate tweets (based on ID)
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
      
      // 2. Analyze trends
      logger.info('Analyzing trends...');
      const emergingTrends = await trendDetector.analyzeTweets(allTweets);
      
      // 3. Update MCP server with detected trends
      mcpServer.updateTrends(emergingTrends);
      
      // 4. Generate and publish a trend report
      if (emergingTrends.length > 0) {
        logger.info('Generating trend report...');
        const trendReport = trendDetector.generateTrendReport();
        
        logger.info('Publishing trends on Twitter...');
        await twitterClient.publishTrends(trendReport);
        
        // 5. Optionnel: Utiliser les serveurs MCP externes pour enrichir l'analyse
        await this.enrichTrendsWithExternalMcp(emergingTrends);
      } else {
        logger.info('No emerging trends detected in this cycle');
      }
      
      logger.info('Trend detection cycle completed successfully');
    } catch (error) {
      logger.error(`Error during trend detection cycle: ${error.message}`);
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