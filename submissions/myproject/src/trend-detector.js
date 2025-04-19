import { removeStopwords } from 'stopword';
import config from './config.js';
import logger from './utils/logger.js';

class TrendDetector {
  constructor() {
    this.previousTermFrequency = new Map();
    this.currentTermFrequency = new Map();
    this.emergingTrends = [];
    
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
    
    logger.info(`${this.emergingTrends.length} emerging trends identified`);
    return this.emergingTrends;
  }

  // Generates a text report of emerging trends for publication
  generateTrendReport() {
    if (this.emergingTrends.length === 0) {
      return 'No micro-trends detected today. Stay tuned for future insights!';
    }
    
    // Limit the number of trends to display (top 5)
    const topTrends = this.emergingTrends.slice(0, 5);
    
    let report = '📊 Detected Micro-Trends 📈\n\n';
    
    topTrends.forEach((trend, index) => {
      // Add different emoji based on rank
      const emoji = index === 0 ? '🔥' : index === 1 ? '⚡' : '📈';
      const newLabel = trend.isNew ? ' (NEW!)' : '';
      
      report += `${emoji} ${trend.term}${newLabel}\n`;
    });
    
    // Add signature and hashtags
    report += '\nAnalyzed by #TrendSniper 🎯 #AI #TrendSpotting';
    
    return report;
  }
}

export default new TrendDetector();