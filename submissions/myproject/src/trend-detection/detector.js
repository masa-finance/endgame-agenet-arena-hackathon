// trend-detection/detector.js - Enhanced trend detector implementation
import { removeStopwords } from 'stopword';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import openaiClient from '../ai/openai-client.js';
import TrendAnalyzer from './analyzer.js';

class TrendDetector {
  constructor() {
    this.previousTermFrequency = new Map();
    this.currentTermFrequency = new Map();
    this.emergingTrends = [];
    this.trendHistory = [];
    this.analyzer = new TrendAnalyzer();
    
    // Terms to exclude from analysis
    this.excludedTerms = new Set([
      ...config.analysis.excludedTerms,
      // Add other words to exclude if needed
    ]);
    
    // Autonomous analysis states
    this.autonomousModeActive = config.analysis.autonomousFallback.enabled;
    this.lastSyntheticTrendsGeneration = null;
    
    // Recency configuration
    this.maxTweetAgeInHours = config.analysis.maxTweetAgeInHours || 24; // Default to 24h if not configured
  }

  // Analyze tweets to detect emerging trends
  async analyzeTweets(tweets) {
    if (!tweets || tweets.length === 0) {
      logger.warn('No tweets to analyze, considering fallback options');
      
      if (this.autonomousModeActive) {
        return await this.generateSyntheticTrends();
      }
      
      return [];
    }
    
    // ENHANCEMENT: Filter tweets by recency before analysis
    const recentTweets = this.filterRecentTweets(tweets);
    
    if (recentTweets.length === 0) {
      logger.warn('No recent tweets found, falling back to synthetic trends');
      
      if (this.autonomousModeActive) {
        return await this.generateSyntheticTrends();
      }
      
      return [];
    }
    
    logger.info(`Analyzing ${recentTweets.length} recent tweets out of ${tweets.length} total tweets`);
    
    if (config.openai && config.openai.useForTrendDetection) {
      // Use AI-based trend detection
      return await this.analyzeWithAI(recentTweets);
    } else {
      // Use traditional frequency-based detection
      return await this.analyzeWithFrequency(recentTweets);
    }
  }
  
  // ENHANCEMENT: Filter tweets by recency
  filterRecentTweets(tweets) {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - (this.maxTweetAgeInHours * 60 * 60 * 1000));
    
    logger.info(`Filtering tweets with cutoff date: ${cutoffTime.toISOString()}`);
    
    return tweets.filter(tweet => {
      // First try to use the tweet's created_at timestamp
      if (tweet.created_at) {
        const tweetDate = new Date(tweet.created_at);
        const isRecent = tweetDate >= cutoffTime;
        
        // Add debug logging for very old tweets
        if (!isRecent) {
          const hoursSince = Math.round((now - tweetDate) / (1000 * 60 * 60));
          if (hoursSince > 168) { // More than 1 week old
            logger.debug(`Filtered out aged tweet: ${hoursSince} hours old, created: ${tweetDate.toISOString()}`);
          }
        }
        
        return isRecent;
      }
      
      // If no created_at, try to extract date from tweet ID (Twitter IDs contain timestamp information)
      if (tweet.id_str || tweet.id) {
        const idStr = tweet.id_str || tweet.id.toString();
        // Twitter snowflake ID format: first 41 bits after the epoch bits are timestamp
        // This is a simplified estimation
        const tweetTimestamp = parseInt(idStr.slice(0, -15)) + 1288834974657;
        const tweetDate = new Date(tweetTimestamp);
        
        // Validate the date is reasonable (between 2020 and now)
        if (tweetDate >= new Date('2020-01-01') && tweetDate <= now) {
          return tweetDate >= cutoffTime;
        }
      }
      
      // If we can't determine the date, include by default (let the AI filter by content)
      return true;
    });
  }

  // Traditional frequency-based analysis
  async analyzeWithFrequency(tweets) {
    // Save previous frequency
    this.previousTermFrequency = new Map(this.currentTermFrequency);
    this.currentTermFrequency.clear();
    
    // Extract and count terms from all tweets
    for (const tweet of tweets) {
      // Use original tweet text if it's a retweet
      const tweetText = tweet.full_text || tweet.text || '';
      
      // Simple tokenization (space separation, removal of special characters)
      const tokenizedText = tweetText
        .toLowerCase()
        .replace(/[^\w\s#@]/g, '')
        .split(/\s+/);
      
      // Remove stopwords
      const filteredTokens = removeStopwords(tokenizedText);
      
      // Count terms
      for (const token of filteredTokens) {
        // Ignore excluded terms and terms that are too short
        if (this.excludedTerms.has(token) || token.length < 3) continue;
        
        // Count occurrences
        this.currentTermFrequency.set(
          token,
          (this.currentTermFrequency.get(token) || 0) + 1
        );
      }
    }
    
    // Identify emerging trends
    return this.identifyEmergingTrends();
  }
  
  // AI-based trend analysis
  async analyzeWithAI(tweets) {
    // Still maintain the frequency map for historical comparison
    this.previousTermFrequency = new Map(this.currentTermFrequency);
    this.currentTermFrequency.clear();
    
    // First do a basic frequency analysis to keep maps updated
    for (const tweet of tweets) {
      const tweetText = tweet.full_text || tweet.text || '';
      
      const tokenizedText = tweetText
        .toLowerCase()
        .replace(/[^\w\s#@]/g, '')
        .split(/\s+/);
      
      const filteredTokens = removeStopwords(tokenizedText);
      
      for (const token of filteredTokens) {
        if (this.excludedTerms.has(token) || token.length < 3) continue;
        this.currentTermFrequency.set(token, (this.currentTermFrequency.get(token) || 0) + 1);
      }
    }
    
    try {
      // Prepare existing terms to provide context to AI
      const existingTerms = this.trendHistory.length > 0 
        ? this.trendHistory[this.trendHistory.length - 1].map(trend => trend.term)
        : [];
      
      // ENHANCEMENT: Add current date context for the AI
      const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Use OpenAI to analyze tweets and detect trends
      const aiTrends = await openaiClient.analyzeTrends(tweets, existingTerms, currentDate);
      
      if (!aiTrends || aiTrends.length === 0) {
        logger.info('No trends detected by AI, falling back to frequency analysis');
        return this.identifyEmergingTrends();
      }
      
      // Transform AI output into our expected trend format
      this.emergingTrends = aiTrends.map(aiTrend => {
        // Get frequency if available, or use a default value
        const currentCount = this.currentTermFrequency.get(aiTrend.term) || aiTrend.occurrences || 1;
        const previousCount = this.previousTermFrequency.get(aiTrend.term) || 0;
        
        // Calculate growth rate or use the value provided by AI
        let growthRate = aiTrend.confidence || 0;
        if (previousCount > 0 && !aiTrend.confidence) {
          growthRate = ((currentCount - previousCount) / previousCount) * 100;
        }
        
        return {
          term: aiTrend.term,
          count: currentCount,
          growthRate: growthRate,
          isNew: previousCount === 0,
          category: aiTrend.category || null,
          sentiment: aiTrend.sentiment || null,
          context: aiTrend.context || null,
          createdAt: new Date().toISOString() // ENHANCEMENT: Add timestamp to track trend age
        };
      });
      
      // Sort by growth rate or confidence (highest to lowest)
      this.emergingTrends.sort((a, b) => b.growthRate - a.growthRate);
      
      // Save trends for historical reference
      this.updateTrendHistory();
      
      logger.info(`${this.emergingTrends.length} emerging trends identified by AI analysis`);
      return this.emergingTrends;
    } catch (error) {
      logger.error(`Error in AI trend analysis: ${error.message}`);
      logger.info('Falling back to frequency-based trend detection');
      
      // Fallback to traditional method if AI analysis fails
      return this.identifyEmergingTrends();
    }
  }
  
  // Generate synthetic trends when no real data is available
  async generateSyntheticTrends() {
    try {
      logger.info('Generating synthetic trends for autonomous operation');
      
      // Limit generation to once per hour maximum
      const now = new Date();
      if (this.lastSyntheticTrendsGeneration) {
        const timeSinceLastGeneration = now - this.lastSyntheticTrendsGeneration;
        const oneHourInMs = 60 * 60 * 1000;
        
        if (timeSinceLastGeneration < oneHourInMs) {
          logger.info(`Synthetic trends were generated recently (${Math.round(timeSinceLastGeneration/60000)} minutes ago), reusing last trends`);
          return this.emergingTrends;
        }
      }
      
      // ENHANCEMENT: Add current date for context
      const currentDate = new Date();
      
      // If OpenAI is configured, use it to generate synthetic trends
      if (config.openai && config.openai.apiKey) {
        logger.info('Using OpenAI to generate synthetic trends');
        
        // ENHANCEMENT: Pass current date to ensure time-awareness
        const syntheticTrends = await openaiClient.generateSyntheticTrends(currentDate);
        
        if (syntheticTrends && syntheticTrends.length > 0) {
          // Transform to standard trend format
          this.emergingTrends = syntheticTrends.map(trend => ({
            term: trend.term,
            count: trend.count || Math.floor(Math.random() * 100) + 20,
            growthRate: trend.confidence || Math.floor(Math.random() * 50) + 50,
            isNew: true,
            category: trend.category || null,
            sentiment: trend.sentiment || null,
            context: trend.context || null,
            isSynthetic: true, // Mark as synthetic
            createdAt: new Date().toISOString() // Add timestamp
          }));
          
          // Record trend history
          this.updateTrendHistory();
          
          // Update last generation timestamp
          this.lastSyntheticTrendsGeneration = now;
          
          logger.info(`${this.emergingTrends.length} synthetic trends generated successfully`);
          return this.emergingTrends;
        }
      }
      
      // Fallback: Generate simple trends based on common topics
      logger.info('Generating basic synthetic trends as fallback');
      
      // ENHANCEMENT: Time-aware trend topics
      const month = currentDate.getMonth(); // 0-11 where 0 is January
      const day = currentDate.getDate(); // 1-31
      
      // Add seasonal and time-aware topics
      let basicTrendTopics = [
        { term: "#AI", category: "Technology" },
        { term: "#MachineLearning", category: "Technology" },
        { term: "#Blockchain", category: "Technology" },
        { term: "#DigitalTransformation", category: "Business" },
        { term: "#RemoteWork", category: "Work" },
        { term: "#SpaceExploration", category: "Science" },
        { term: "#Cybersecurity", category: "Technology" }
      ];
      
      // Add contextual seasonal topics based on current month
      if (month === 3) { // April
        basicTrendTopics = [...basicTrendTopics,
          { term: "#Spring", category: "Seasons" },
          { term: "#EarthDay", category: "Environment" },
        ];
      } else if (month === 10 || month === 11) { // November-December
        basicTrendTopics = [...basicTrendTopics,
          { term: "#HolidayShopping", category: "Retail" },
          { term: "#WinterPrep", category: "Lifestyle" },
        ];
      } else if (month === 5 || month === 6 || month === 7) { // June-August
        basicTrendTopics = [...basicTrendTopics,
          { term: "#SummerBreak", category: "Lifestyle" },
          { term: "#BeachDay", category: "Travel" },
        ];
      }
      
      // Include the current year in some hashtags
      const currentYear = currentDate.getFullYear();
      basicTrendTopics.push({ term: `#Tech${currentYear}`, category: "Technology" });
      
      // Randomly select 3-5 trends
      const numTrends = Math.floor(Math.random() * 3) + 3; // 3 to 5 trends
      const selectedTrends = [];
      
      while (selectedTrends.length < numTrends && basicTrendTopics.length > 0) {
        const randomIndex = Math.floor(Math.random() * basicTrendTopics.length);
        selectedTrends.push(basicTrendTopics[randomIndex]);
        basicTrendTopics.splice(randomIndex, 1);
      }
      
      // Create trend objects
      this.emergingTrends = selectedTrends.map(topic => ({
        term: topic.term,
        count: Math.floor(Math.random() * 100) + 20, // 20-120 mentions
        growthRate: Math.floor(Math.random() * 50) + 50, // 50-100% growth
        isNew: Math.random() > 0.5, // 50% chance of being new
        category: topic.category,
        sentiment: Math.random() > 0.7 ? "negative" : Math.random() > 0.4 ? "positive" : "neutral",
        isSynthetic: true,
        createdAt: new Date().toISOString() // Add timestamp
      }));
      
      // Record trend history
      this.updateTrendHistory();
      
      // Update last generation timestamp
      this.lastSyntheticTrendsGeneration = now;
      
      logger.info(`${this.emergingTrends.length} basic synthetic trends generated as fallback`);
      return this.emergingTrends;
    } catch (error) {
      logger.error(`Error generating synthetic trends: ${error.message}`);
      return [];
    }
  }
  
  // Update trend history for future reference
  updateTrendHistory() {
    // Add current trends to history
    this.trendHistory.push([...this.emergingTrends]);
    
    // Limit history size based on configuration
    const maxHistorySize = config.analysis.trendHistorySize || 10;
    if (this.trendHistory.length > maxHistorySize) {
      this.trendHistory.shift();
    }
  }

  // Identify emerging trends by comparing current and previous frequencies
  identifyEmergingTrends() {
    this.emergingTrends = [];
    
    // For each term in current frequency
    for (const [term, currentCount] of this.currentTermFrequency.entries()) {
      // Ignore terms that don't appear often enough
      if (currentCount < config.analysis.minOccurrences) continue;
      
      const previousCount = this.previousTermFrequency.get(term) || 0;
      
      // Calculate growth (in %) if term already existed
      let growthRate = 0;
      if (previousCount > 0) {
        growthRate = ((currentCount - previousCount) / previousCount) * 100;
      } else {
        // For new terms, consider it significant growth
        growthRate = 100;
      }
      
      // Consider as emerging trend if growth exceeds configured threshold
      if (growthRate >= config.analysis.growthThreshold) {
        this.emergingTrends.push({
          term,
          count: currentCount,
          growthRate,
          isNew: previousCount === 0,
          createdAt: new Date().toISOString() // Add timestamp
        });
      }
    }
    
    // Sort by growth rate (highest to lowest)
    this.emergingTrends.sort((a, b) => b.growthRate - a.growthRate);
    
    // Update trend history
    this.updateTrendHistory();
    
    logger.info(`${this.emergingTrends.length} emerging trends identified`);
    return this.emergingTrends;
  }
  
  // Generate a textual report of emerging trends for publication
  async generateTrendReport(specificTrends = null) {
    // Use provided trends or detected emerging trends
    const trendsToReport = specificTrends || this.emergingTrends;
    
    // ENHANCEMENT: Add date context for the report
    const currentDate = new Date();
    const dateString = currentDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
    
    if (config.reporting.enhancedReports && config.openai.apiKey) {
      return this.analyzer.generateEnhancedReport(trendsToReport, dateString);
    } else {
      return this.generateBasicReport(trendsToReport, dateString);
    }
  }
  
  // Generate a basic trend report without AI assistance
  generateBasicReport(trends, dateString) {
    if (!trends || trends.length === 0) {
      return `No micro-trends detected today (${dateString}). Stay tuned for future insights!`;
    }
    
    // Limit number of trends to display
    const maxTrends = config.reporting.maxTrendsInReport || 5;
    const topTrends = trends.slice(0, maxTrends);
    
    // Add indicator if synthetic trends are present
    const hasSyntheticTrends = topTrends.some(trend => trend.isSynthetic === true);
    const reportPrefix = hasSyntheticTrends 
      ? `🔮 AI-Predicted Micro-Trends for ${dateString} 🔮\n\n` 
      : `📊 Today's Micro-Trends (${dateString}) 📈\n\n`;
    
    let report = reportPrefix;
    
    topTrends.forEach((trend, index) => {
      // Add different emoji based on rank
      const emoji = index === 0 ? '🔥' : index === 1 ? '⚡' : '📈';
      const newLabel = trend.isNew ? ' (NEW!)' : '';
      
      // Add category if available and configured
      const categoryLabel = trend.category && config.reporting.includeCategories 
        ? ` [${trend.category}]` 
        : '';
      
      report += `${emoji} ${trend.term}${newLabel}${categoryLabel}\n`;
    });
    
    // Add signature and hashtags
    report += '\nAnalyzed by #TrendSnipper 🎯 #AI #TrendSpotting';
    
    return report;
  }
}

export default TrendDetector;