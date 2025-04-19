import { removeStopwords } from 'stopword';
import config from './config.js';
import logger from './utils/logger.js';
import openaiClient from './ai/openai-client.js';

export default class TrendDetector {
  constructor() {
    this.previousTermFrequency = new Map();
    this.currentTermFrequency = new Map();
    this.emergingTrends = [];
    this.trendHistory = [];
    
    // Terms to exclude from analysis
    this.excludedTerms = new Set([
      ...config.analysis.excludedTerms,
      // Add other words to exclude if needed
    ]);
  }

  // Analyze tweets to detect emerging trends
  // tweets - List of tweets to analyze
  async analyzeTweets(tweets) {
    if (!tweets || tweets.length === 0) {
      logger.warn('No tweets to analyze');
      return [];
    }
    
    logger.info(`Analyzing ${tweets.length} tweets`);
    
    if (config.openai && config.openai.useForTrendDetection) {
      // Use AI-powered trend detection
      return await this.analyzeWithAI(tweets);
    } else {
      // Use traditional frequency-based detection
      return await this.analyzeWithFrequency(tweets);
    }
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
      
      // Simple tokenization (split by spaces, remove special characters)
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
  
  // AI-powered trend analysis
  async analyzeWithAI(tweets) {
    // Still maintain the frequency map for historical comparison
    this.previousTermFrequency = new Map(this.currentTermFrequency);
    this.currentTermFrequency.clear();
    
    // First do a basic frequency analysis to keep the maps updated
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
      // Prepare existing terms to provide context to the AI
      const existingTerms = this.trendHistory.length > 0 
        ? this.trendHistory[this.trendHistory.length - 1].map(trend => trend.term)
        : [];
      
      // Use OpenAI to analyze the tweets and detect trends
      const aiTrends = await openaiClient.analyzeTrends(tweets, existingTerms);
      
      if (!aiTrends || aiTrends.length === 0) {
        logger.info('No trends detected by AI, falling back to frequency analysis');
        return this.identifyEmergingTrends();
      }
      
      // Transform AI output to our expected trend format
      this.emergingTrends = aiTrends.map(aiTrend => {
        // Get frequency if available, or use a default value
        const currentCount = this.currentTermFrequency.get(aiTrend.term) || aiTrend.occurrences || 1;
        const previousCount = this.previousTermFrequency.get(aiTrend.term) || 0;
        
        // Calculate growth rate or use AI-provided value
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
          context: aiTrend.context || null
        };
      });
      
      // Sort by growth rate or confidence (from highest to lowest)
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
    
    // For each term in the current frequency
    for (const [term, currentCount] of this.currentTermFrequency.entries()) {
      // Ignore terms that don't appear often enough
      if (currentCount < config.analysis.minOccurrences) continue;
      
      const previousCount = this.previousTermFrequency.get(term) || 0;
      
      // Calculate growth (in %) if the term already existed
      let growthRate = 0;
      if (previousCount > 0) {
        growthRate = ((currentCount - previousCount) / previousCount) * 100;
      } else {
        // For new terms, consider as significant growth
        growthRate = 100;
      }
      
      // Consider as emerging trend if growth exceeds configured threshold
      if (growthRate >= config.analysis.growthThreshold) {
        this.emergingTrends.push({
          term,
          count: currentCount,
          growthRate,
          isNew: previousCount === 0
        });
      }
    }
    
    // Sort by growth rate (from highest to lowest)
    this.emergingTrends.sort((a, b) => b.growthRate - a.growthRate);
    
    // Update trend history
    this.updateTrendHistory();
    
    logger.info(`${this.emergingTrends.length} emerging trends identified`);
    return this.emergingTrends;
  }
  
  // Generates a text report of emerging trends for publication
  generateTrendReport() {
    if (config.reporting.enhancedReports && config.openai.apiKey) {
      return this.generateEnhancedReport();
    } else {
      return this.generateBasicReport();
    }
  }
  
  // Generate enhanced trend report using OpenAI
  async generateEnhancedReport() {
    try {
      if (this.emergingTrends.length === 0) {
        return 'No micro-trends detected today. Stay tuned for future insights!';
      }
      
      const report = await openaiClient.generateEnhancedTrendReport(this.emergingTrends);
      return report;
    } catch (error) {
      logger.error(`Error generating enhanced report: ${error.message}`);
      return this.generateBasicReport();
    }
  }
  
  // Generate basic trend report without AI assistance
  generateBasicReport() {
    if (this.emergingTrends.length === 0) {
      return 'No micro-trends detected today. Stay tuned for future insights!';
    }
    
    // Limit the number of trends to display
    const maxTrends = config.reporting.maxTrendsInReport || 5;
    const topTrends = this.emergingTrends.slice(0, maxTrends);
    
    let report = '📊 Detected Micro-Trends 📈\n\n';
    
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
    report += '\nAnalyzed by #TrendSniper 🎯 #AI #TrendSpotting';
    
    return report;
  }
}