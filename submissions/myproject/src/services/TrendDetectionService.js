// TrendDetectionService.js - Enhanced trend detection service
import config from '../config/config.js';
import logger from '../utils/logger.js';
import twitterClient from '../twitter-client/index.js';
import trendDetector from '../trend-detection/index.js';
import topicManager from '../utils/topic-manager.js';
import mcpServer from '../mcp/server.js';
import mcpClient from '../mcp/client.js';
import { SearchMode } from 'agent-twitter-client';

class TrendDetectionService {
  constructor(trendSnipper) {
    this.trendSnipper = trendSnipper;
    
    // Advanced search parameters
    this.searchOptions = {
      maxTweetAge: config.sources.maxTweetAgeInHours || 24, // Default to 24 hours
      resultsPerQuery: config.sources.resultsPerQuery || 30,
      includeReplies: config.sources.includeReplies || false,
      searchMode: SearchMode.Latest, // Always use "Latest" mode for trend detection
      minRetweetsFilter: config.sources.minRetweetsFilter || 5,
      minLikesFilter: config.sources.minLikesFilter || 10
    };
  }

  // Run a complete trend detection cycle
  async runTrendDetectionCycle() {
    try {
      const cycleStartTime = new Date();
      logger.info('Starting trend detection cycle');
      
      // 1. Get current hashtags and accounts to monitor from topic manager
      const hashtagsToMonitor = topicManager.getHashtags();
      const accountsToMonitor = topicManager.getAccounts();
      
      logger.info(`Monitoring ${hashtagsToMonitor.length} hashtags and ${accountsToMonitor.length} accounts`);
      
      // 2. Collect tweets from hashtags with enhanced parameters
      logger.info('Collecting tweets from hashtags...');
      let hashtagTweets = [];
      
      if (hashtagsToMonitor.length > 0) {
        const hashtagPromises = hashtagsToMonitor.map(hashtag => 
          this.searchRecentTweets(hashtag)
        );
        const hashtagTweetsArrays = await Promise.all(hashtagPromises);
        hashtagTweets = hashtagTweetsArrays.flat();
        logger.info(`Collected ${hashtagTweets.length} tweets from hashtags`);
      } else {
        logger.warn('No hashtags configured for monitoring');
      }
      
      // 3. Collect tweets from accounts
      logger.info('Collecting tweets from accounts...');
      let accountTweets = [];
      
      if (accountsToMonitor.length > 0) {
        const accountPromises = accountsToMonitor.map(account => 
          this.getRecentAccountTweets(account)
        );
        const accountTweetsArrays = await Promise.all(accountPromises);
        accountTweets = accountTweetsArrays.flat();
        logger.info(`Collected ${accountTweets.length} tweets from accounts`);
      } else {
        logger.warn('No accounts configured for monitoring');
      }
      
      // 4. Merge and deduplicate tweets (based on ID)
      const tweetMap = new Map();
      [...hashtagTweets, ...accountTweets].forEach(tweet => {
        if (tweet && tweet.id) {
          tweetMap.set(tweet.id, tweet);
        }
      });
      
      let allTweets = Array.from(tweetMap.values());
      logger.info(`Total of ${allTweets.length} unique tweets collected`);
      
      // Update cycle statistics
      this.trendSnipper.cycleStats.totalTweets += allTweets.length;
      this.trendSnipper.cycleStats.cycleTweetCounts.push(allTweets.length);
      if (this.trendSnipper.cycleStats.cycleTweetCounts.length > 10) {
        this.trendSnipper.cycleStats.cycleTweetCounts.shift(); // Keep only the last 10
      }
      
      // Calculate average tweets per cycle
      if (this.trendSnipper.cycleStats.cycleTweetCounts.length > 0) {
        this.trendSnipper.cycleStats.averageTweetsPerCycle = 
          this.trendSnipper.cycleStats.cycleTweetCounts.reduce((sum, count) => sum + count, 0) / 
          this.trendSnipper.cycleStats.cycleTweetCounts.length;
      }
      
      // 5. If no tweets were collected, use fallback strategies
      if (allTweets.length === 0) {
        logger.warn('No tweets collected, using fallback strategies');
        this.trendSnipper.fallbackAttempts++;
        
        allTweets = await this.handleNoTweetsScenario();
        
        // If all strategies fail
        if (allTweets.length === 0) {
          this.handleFailedCycle();
          return;
        }
      } else {
        // Reset fallback attempts counter if we have tweets
        this.trendSnipper.fallbackAttempts = 0;
      }
      
      // 6. Filter tweets by recency before passing to the detector
      const recentTweets = this.filterTweetsByRecency(allTweets);
      logger.info(`${recentTweets.length} recent tweets remaining after filtering ${allTweets.length} total tweets`);
      
      // 7. Analyze trends
      logger.info('Analyzing trends...');
      const emergingTrends = await trendDetector.analyzeTweets(recentTweets);
      
      // 8. Update MCP server with detected trends
      if (mcpServer && typeof mcpServer.updateTrends === 'function') {
        mcpServer.updateTrends(emergingTrends);
      }
      
      // 9. Handle detected trends
      await this.handleDetectedTrends(emergingTrends);
      
      // Calculate cycle duration
      const cycleDuration = new Date() - cycleStartTime;
      logger.info(`Trend detection cycle completed in ${cycleDuration/1000} seconds`);
      
      // Update last cycle timestamp
      this.trendSnipper.cycleStats.lastCycleTime = new Date();
      
      // Dynamically adjust scheduling for the next cycle
      if (this.trendSnipper.schedulerService && 
          typeof this.trendSnipper.schedulerService.adjustSchedulingBasedOnActivity === 'function') {
        this.trendSnipper.schedulerService.adjustSchedulingBasedOnActivity();
      }
      
      // Update and display the next post time
      if (this.trendSnipper.schedulerService && 
          typeof this.trendSnipper.schedulerService.updateNextPostTime === 'function') {
        this.trendSnipper.schedulerService.updateNextPostTime();
      }
    } catch (error) {
      logger.error(`Error during trend detection cycle: ${error.message}`);
      this.trendSnipper.cycleStats.failedCycles++;
      
      // Adjust scheduling even on error
      if (this.trendSnipper.schedulerService && 
          typeof this.trendSnipper.schedulerService.adjustSchedulingBasedOnActivity === 'function') {
        this.trendSnipper.schedulerService.adjustSchedulingBasedOnActivity();
      }
      
      // Update and display the next post time even on error
      if (this.trendSnipper.schedulerService && 
          typeof this.trendSnipper.schedulerService.updateNextPostTime === 'function') {
        this.trendSnipper.schedulerService.updateNextPostTime();
      }
    }
  }

  // Enhanced method to search for recent tweets with advanced parameters
  async searchRecentTweets(searchTerm) {
    try {
      logger.info(`Searching for recent tweets with term: ${searchTerm}`);
      
      // Build advanced search query with time filters
      const advancedQuery = this.buildAdvancedSearchQuery(searchTerm);
      
      // Use SearchMode.Latest to get the most recent tweets
      const tweets = await twitterClient.scraper.searchTweets(
        advancedQuery,
        this.searchOptions.resultsPerQuery,
        SearchMode.Latest
      );
      
      if (!tweets || !Array.isArray(tweets) || tweets.length === 0) {
        logger.warn(`No tweets found for search term: ${searchTerm}`);
        return [];
      }
      
      logger.info(`Found ${tweets.length} tweets for search term: ${searchTerm}`);
      
      // Filter tweets by engagement directly without using .filter
      const filteredTweets = this.filterTweetsByEngagement(tweets);
      
      logger.info(`After filtering, kept ${filteredTweets.length} quality tweets for: ${searchTerm}`);
      return filteredTweets;
    } catch (error) {
      logger.error(`Error searching recent tweets for '${searchTerm}': ${error.message}`);
      return [];
    }
  }
  
  // Enhanced method to get recent tweets from specific accounts
  async getRecentAccountTweets(accountName) {
    try {
      logger.info(`Getting recent tweets from account: ${accountName}`);
      
      // Use scraper to get tweets with possible replies based on configuration
      let tweets = [];
      
      if (this.searchOptions.includeReplies) {
        // Get tweets including replies
        tweets = await twitterClient.scraper.getTweetsAndReplies(
          accountName,
          this.searchOptions.resultsPerQuery
        );
      } else {
        // Get only main tweets (no replies)
        tweets = await twitterClient.scraper.getTweets(
          accountName,
          this.searchOptions.resultsPerQuery
        );
      }
      
      if (!tweets || !Array.isArray(tweets) || tweets.length === 0) {
        logger.warn(`No tweets found for account: ${accountName}`);
        return [];
      }
      
      logger.info(`Found ${tweets.length} tweets from account: ${accountName}`);
      
      // Filter tweets by recency manually
      const recentTweets = this.filterTweetsByRecency(tweets);
      
      logger.info(`After filtering for recency, kept ${recentTweets.length} tweets from: ${accountName}`);
      return recentTweets;
    } catch (error) {
      logger.error(`Error getting recent tweets from ${accountName}: ${error.message}`);
      return [];
    }
  }
  
  // Build advanced search query with time filters
  buildAdvancedSearchQuery(baseQuery) {
    // Start with the base query
    let advancedQuery = baseQuery;
    
    // Add time filter if configured
    if (this.searchOptions.maxTweetAge <= 24) {
      // Twitter advanced search has specific syntax for recency
      advancedQuery += " filter:safe";
    }
    
    // Add minimum engagement filters if configured
    if (this.searchOptions.minRetweetsFilter > 0) {
      advancedQuery += ` min_retweets:${this.searchOptions.minRetweetsFilter}`;
    }
    
    if (this.searchOptions.minLikesFilter > 0) {
      advancedQuery += ` min_faves:${this.searchOptions.minLikesFilter}`;
    }
    
    logger.debug(`Advanced search query created: ${advancedQuery}`);
    return advancedQuery;
  }
  
  // Filter tweets by recency
  filterTweetsByRecency(tweets) {
    if (!tweets || !Array.isArray(tweets) || tweets.length === 0) return [];
    
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - (this.searchOptions.maxTweetAge * 60 * 60 * 1000));
    
    // Use manual loop instead of filter for more reliable behavior
    const recentTweets = [];
    for (let i = 0; i < tweets.length; i++) {
      const tweet = tweets[i];
      if (!tweet) continue;
      
      if (tweet.created_at) {
        const tweetDate = new Date(tweet.created_at);
        if (tweetDate >= cutoffTime) {
          recentTweets.push(tweet);
        }
      } else {
        // If no date, include by default
        recentTweets.push(tweet);
      }
    }
    
    return recentTweets;
  }
  
  // Filter tweets by engagement metrics
  filterTweetsByEngagement(tweets) {
    if (!tweets || !Array.isArray(tweets) || tweets.length === 0) return [];
    
    // Use manual loop instead of filter for more reliable behavior
    const filteredTweets = [];
    for (let i = 0; i < tweets.length; i++) {
      const tweet = tweets[i];
      if (!tweet) continue;
      
      // Filter by minimum retweet count if configured
      if (this.searchOptions.minRetweetsFilter > 0 && 
          tweet.retweet_count < this.searchOptions.minRetweetsFilter) {
        continue;
      }
      
      // Filter by minimum like count if configured
      if (this.searchOptions.minLikesFilter > 0 && 
          tweet.favorite_count < this.searchOptions.minLikesFilter) {
        continue;
      }
      
      filteredTweets.push(tweet);
    }
    
    return filteredTweets;
  }
  
  // Handle the case where no tweets are collected
  async handleNoTweetsScenario() {
    // Strategy 1: Collect tweets from global trends
    logger.info('Attempting to collect tweets from global trends...');
    let globalTrends = [];
    
    try {
      globalTrends = await twitterClient.getGlobalTrends();
    } catch (error) {
      logger.error(`Error getting global trends: ${error.message}`);
    }
    
    if (globalTrends && Array.isArray(globalTrends) && globalTrends.length > 0) {
      logger.info(`Found ${globalTrends.length} global trends, collecting tweets from them`);
      const trendTweets = await this.collectTweetsFromTrends(globalTrends);
      
      if (trendTweets.length > 0) {
        logger.info(`Successfully collected ${trendTweets.length} tweets from global trends`);
        return trendTweets;
      }
    }
    
    // Strategy 2: Proactively trigger discovery of new topics/accounts
    logger.info('Proactively triggering topic discovery cycle');
    if (this.trendSnipper.topicDiscoveryService && 
        typeof this.trendSnipper.topicDiscoveryService.runTopicDiscoveryCycle === 'function') {
      setTimeout(() => this.trendSnipper.topicDiscoveryService.runTopicDiscoveryCycle(), 1000);
    }
    
    // Strategy 3: Use advanced search with broader parameters
    logger.info('Attempting advanced search with broader parameters...');
    const emergencyTweets = await this.performEmergencySearch();
    
    if (emergencyTweets.length > 0) {
      logger.info(`Successfully collected ${emergencyTweets.length} tweets with emergency search`);
      return emergencyTweets;
    }
    
    // Strategy 4: If still no tweets, generate synthetic trends with AI
    if (config.analysis.autonomousFallback && config.analysis.autonomousFallback.generateSyntheticTrends) {
      logger.info('No tweets available, generating synthetic trends');
      const syntheticTrends = await trendDetector.generateSyntheticTrends();
      
      if (syntheticTrends && syntheticTrends.length > 0) {
        logger.info(`Generated ${syntheticTrends.length} synthetic trends`);
        
        if (mcpServer && typeof mcpServer.updateTrends === 'function') {
          mcpServer.updateTrends(syntheticTrends);
        }
        
        const trendReport = await trendDetector.generateTrendReport(syntheticTrends);
        
        if (config.reporting.autonomousPublishing && config.reporting.autonomousPublishing.enabled) {
          await twitterClient.publishTrends(trendReport);
          this.trendSnipper.cycleStats.publishedTrends++;
        }
        
        // Update statistics
        this.trendSnipper.cycleStats.successfulCycles++;
        this.trendSnipper.cycleStats.totalTrendsFound += syntheticTrends.length;
        this.trendSnipper.cycleStats.lastCycleTime = new Date();
        
        // Dynamically adjust scheduling for the next cycle
        if (this.trendSnipper.schedulerService && 
            typeof this.trendSnipper.schedulerService.adjustSchedulingBasedOnActivity === 'function') {
          this.trendSnipper.schedulerService.adjustSchedulingBasedOnActivity();
        }
        
        // Update and display the next post time
        if (this.trendSnipper.schedulerService && 
            typeof this.trendSnipper.schedulerService.updateNextPostTime === 'function') {
          this.trendSnipper.schedulerService.updateNextPostTime();
        }
        
        logger.info('Fallback trend detection cycle completed with synthetic trends');
      }
    }
    
    return [];
  }
  
  // Perform emergency search with broader parameters
  async performEmergencySearch() {
    try {
      // Use broader search terms related to current events
      const emergencySearchTerms = [
        "breaking news",
        "trending",
        "latest",
        "happening now",
        "just announced"
      ];
      
      // Save original search options
      const originalOptions = { ...this.searchOptions };
      
      // Temporarily relax search parameters
      this.searchOptions.minRetweetsFilter = 0;
      this.searchOptions.minLikesFilter = 0;
      this.searchOptions.resultsPerQuery = 50;
      
      let allEmergencyTweets = [];
      
      for (const term of emergencySearchTerms) {
        logger.info(`Performing emergency search for term: ${term}`);
        
        try {
          const tweets = await twitterClient.scraper.searchTweets(
            term,
            this.searchOptions.resultsPerQuery,
            SearchMode.Latest
          );
          
          if (tweets && Array.isArray(tweets) && tweets.length > 0) {
            allEmergencyTweets = allEmergencyTweets.concat(tweets);
            logger.info(`Found ${tweets.length} emergency tweets for term: ${term}`);
          }
        } catch (error) {
          logger.error(`Error in emergency search for term '${term}': ${error.message}`);
        }
      }
      
      // Restore original search options
      this.searchOptions = originalOptions;
      
      // Deduplicate tweets
      const uniqueTweetMap = new Map();
      for (let i = 0; i < allEmergencyTweets.length; i++) {
        const tweet = allEmergencyTweets[i];
        if (tweet && tweet.id) {
          uniqueTweetMap.set(tweet.id, tweet);
        }
      }
      
      const uniqueTweets = Array.from(uniqueTweetMap.values());
      
      logger.info(`Collected ${uniqueTweets.length} unique emergency tweets`);
      return uniqueTweets;
    } catch (error) {
      logger.error(`Error in emergency search: ${error.message}`);
      
      // Restore search options in case of error
      if (originalOptions) {
        this.searchOptions = originalOptions;
      }
      
      return [];
    }
  }
  
  // Collect tweets from trends
  async collectTweetsFromTrends(trends) {
    try {
      const allTrendTweets = [];
      
      // Take the top 5 trends to avoid API limitations
      const trendsToUse = trends.slice(0, 5);
      
      for (const trend of trendsToUse) {
        const query = trend.name || trend.term || trend.query;
        if (!query) continue;
        
        logger.info(`Collecting tweets for trend: ${query}`);
        try {
          const tweets = await twitterClient.scraper.searchTweets(
            query, 
            this.searchOptions.resultsPerQuery,
            SearchMode.Latest
          );
          
          if (tweets && Array.isArray(tweets) && tweets.length > 0) {
            for (let i = 0; i < tweets.length; i++) {
              allTrendTweets.push(tweets[i]);
            }
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
  
  // Handle a failed cycle
  handleFailedCycle() {
    this.trendSnipper.cycleStats.failedCycles++;
    this.trendSnipper.cycleStats.lastCycleTime = new Date();
    logger.warn('All fallback strategies failed, ending detection cycle');
    
    // Dynamically adjust scheduling
    if (this.trendSnipper.schedulerService && 
        typeof this.trendSnipper.schedulerService.adjustSchedulingBasedOnActivity === 'function') {
      this.trendSnipper.schedulerService.adjustSchedulingBasedOnActivity();
    }
    
    // Update and display the next post time
    if (this.trendSnipper.schedulerService && 
        typeof this.trendSnipper.schedulerService.updateNextPostTime === 'function') {
      this.trendSnipper.schedulerService.updateNextPostTime();
    }
  }

  // Handle detected trends
  async handleDetectedTrends(emergingTrends) {
    // Generate and publish a trend report
    if (emergingTrends && Array.isArray(emergingTrends) && emergingTrends.length > 0) {
      this.trendSnipper.cycleStats.totalTrendsFound += emergingTrends.length;
      
      // Filter out trends that are too old
      const filteredTrends = this.filterTrendsByAge(emergingTrends);
      logger.info(`${filteredTrends.length} current trends after age filtering`);
      
      if (filteredTrends.length > 0) {
        logger.info('Generating trend report...');
        const trendReport = await trendDetector.generateTrendReport(filteredTrends);
        
        // Only publish if enough trends were found and publishing is enabled
        if (config.reporting && config.reporting.autonomousPublishing &&
            filteredTrends.length >= config.reporting.autonomousPublishing.minTrendsForPublication && 
            config.reporting.autonomousPublishing.enabled) {
          logger.info('Publishing trends on Twitter...');
          await twitterClient.publishTrends(trendReport);
          this.trendSnipper.cycleStats.publishedTrends++;
        } else {
          logger.info('Skipping trend publication (threshold not met or publishing disabled)');
        }
        
        // Use external MCP servers to enrich the analysis
        await this.enrichTrendsWithExternalMcp(filteredTrends);
        
        // Trigger topic discovery if needed
        if (topicManager.needsRefresh()) {
          logger.info('Topic refresh needed, scheduling discovery cycle');
          if (this.trendSnipper.topicDiscoveryService && 
              typeof this.trendSnipper.topicDiscoveryService.runTopicDiscoveryCycle === 'function') {
            setTimeout(() => this.trendSnipper.topicDiscoveryService.runTopicDiscoveryCycle(filteredTrends), 1000);
          }
        }
        
        this.trendSnipper.cycleStats.successfulCycles++;
      } else {
        logger.info('No current trends after age filtering, skipping publication');
        this.trendSnipper.cycleStats.failedCycles++;
      }
    } else {
      logger.info('No emerging trends detected in this cycle');
      this.trendSnipper.cycleStats.failedCycles++;
    }
  }
  
  // Filter trends by age to ensure only recent ones are published
  filterTrendsByAge(trends) {
    if (!trends || !Array.isArray(trends) || trends.length === 0) return [];
    
    const now = new Date();
    const maxTrendAgeInHours = (config.reporting && config.reporting.maxTrendAgeInHours) || 24;
    const cutoffTime = new Date(now.getTime() - (maxTrendAgeInHours * 60 * 60 * 1000));
    
    // Use manual loop instead of filter for more reliable behavior
    const recentTrends = [];
    for (let i = 0; i < trends.length; i++) {
      const trend = trends[i];
      if (!trend) continue;
      
      // If the trend has no creation timestamp, include it by default
      if (!trend.createdAt) {
        recentTrends.push(trend);
        continue;
      }
      
      const trendDate = new Date(trend.createdAt);
      if (trendDate >= cutoffTime) {
        recentTrends.push(trend);
      }
    }
    
    return recentTrends;
  }

  // Enrich trend analysis with external MCP servers
  async enrichTrendsWithExternalMcp(trends) {
    // Skip this step if no external servers are connected
    if (!mcpClient || !mcpClient.connectedServers || mcpClient.connectedServers.size === 0) return;
    
    logger.info('Enriching trends with external MCP servers...');
    
    try {
      for (let i = 0; i < trends.length; i++) {
        const trend = trends[i];
        const term = trend.term;
        
        // Example of using an external MCP server "brave-search"
        if (mcpClient.connectedServers.has('brave-search')) {
          try {
            const result = await mcpClient.callTool('search', { query: term });
            logger.info(`Enriched trend "${term}" with external search data`);
            
            // Store enriched data in the trend
            trend.externalData = result;
          } catch (toolError) {
            logger.warn(`Failed to enrich trend "${term}" with external data: ${toolError.message}`);
          }
        }
        
        // Use an external MCP server "weather" if available
        if (mcpClient.connectedServers.has('weather')) {
          try {
            const result = await mcpClient.callTool('current', {});
            logger.info(`Added weather context to trend "${term}"`);
            
            // Add weather data to trend context
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