import { Scraper, SearchMode } from 'agent-twitter-client';
import config from './config.js';
import logger from './utils/logger.js';

class TwitterClient {
  constructor() {
    this.scraper = new Scraper();
    this.isAuthenticated = false;
  }

  // Twitter authentication
  async authenticate() {
    try {
      if (this.isAuthenticated) return true;

      const { username, password, email, apiKey, apiSecretKey, accessToken, accessTokenSecret } = config.twitter;
      
      // If API keys are provided, use complete authentication (required for certain features)
      if (apiKey && apiSecretKey && accessToken && accessTokenSecret) {
        await this.scraper.login(username, password, email, apiKey, apiSecretKey, accessToken, accessTokenSecret);
      } else {
        // Basic authentication
        await this.scraper.login(username, password);
      }
      
      this.isAuthenticated = await this.scraper.isLoggedIn();
      
      if (this.isAuthenticated) {
        logger.info('Twitter authentication successful');
        return true;
      } else {
        logger.error('Twitter authentication failed');
        return false;
      }
    } catch (error) {
      logger.error(`Twitter authentication error: ${error.message}`);
      return false;
    }
  }

  // Collect tweets from configured hashtags
  async collectTweetsFromHashtags() {
    if (!this.isAuthenticated) await this.authenticate();
    
    try {
      const allTweets = [];
      
      for (const hashtag of config.sources.hashtags) {
        logger.info(`Collecting tweets for hashtag: ${hashtag}`);
        const tweets = await this.scraper.searchTweets(hashtag, config.sources.maxTweetsPerSource, SearchMode.Latest);
        if (tweets && tweets.length > 0) {
          allTweets.push(...tweets);
          logger.info(`${tweets.length} tweets collected for ${hashtag}`);
        }
      }
      
      return allTweets;
    } catch (error) {
      logger.error(`Error collecting tweets by hashtag: ${error.message}`);
      return [];
    }
  }

  // Collect tweets from configured accounts
  async collectTweetsFromAccounts() {
    if (!this.isAuthenticated) await this.authenticate();
    
    try {
      const allTweets = [];
      
      for (const account of config.sources.accounts) {
        logger.info(`Collecting tweets for account: ${account}`);
        const tweets = await this.scraper.getTweets(account, config.sources.maxTweetsPerSource);
        if (tweets && tweets.length > 0) {
          allTweets.push(...tweets);
          logger.info(`${tweets.length} tweets collected for ${account}`);
        }
      }
      
      return allTweets;
    } catch (error) {
      logger.error(`Error collecting tweets by account: ${error.message}`);
      return [];
    }
  }

  // Publish a tweet containing discovered trends
  async publishTrends(trendReport) {
    if (!this.isAuthenticated) await this.authenticate();
    
    try {
      logger.info('Publishing detected trends...');
      const result = await this.scraper.sendTweet(trendReport);
      
      if (result && result.id) {
        logger.info(`Trends published successfully! Tweet ID: ${result.id}`);
        return true;
      } else {
        logger.warn('Trend publication completed but without confirmation');
        return false;
      }
    } catch (error) {
      logger.error(`Error publishing trends: ${error.message}`);
      return false;
    }
  }

  // Get current global trends
  async getGlobalTrends() {
    if (!this.isAuthenticated) await this.authenticate();
    
    try {
      const trends = await this.scraper.getTrends();
      return trends || [];
    } catch (error) {
      logger.error(`Error retrieving global trends: ${error.message}`);
      return [];
    }
  }
}

// Export a singleton instance
const twitterClient = new TwitterClient();
export default twitterClient;