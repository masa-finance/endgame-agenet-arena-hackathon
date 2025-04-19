// twitter-client/client.js - Implémentation du client Twitter
import { Scraper, SearchMode } from 'agent-twitter-client';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import CookieManager from './CookieManager.js';

class TwitterClient {
  constructor() {
    this.scraper = new Scraper();
    this.isAuthenticated = false;
    this.cookieManager = new CookieManager();
  }

  // Twitter authentication with cookie support
  async authenticate() {
    try {
      if (this.isAuthenticated) return true;

      // Try to load and use existing cookies first
      const cookies = this.cookieManager.loadCookies();
      
      if (cookies) {
        logger.info('Found saved cookies, attempting to use them...');
        
        try {
          // Format cookies properly for the Twitter client
          const formattedCookies = this.cookieManager.formatCookiesForTwitterClient(cookies);
          
          if (formattedCookies && formattedCookies.length > 0) {
            // Set cookies with error handling
            await this.scraper.setCookies(formattedCookies);
            
            // Verify if cookies are still valid
            this.isAuthenticated = await this.scraper.isLoggedIn();
            
            if (this.isAuthenticated) {
              logger.info('Authentication successful using saved cookies');
              return true;
            } else {
              logger.warn('Saved cookies are invalid or expired, proceeding with login');
            }
          } else {
            logger.warn('Cookies could not be properly formatted, proceeding with login');
          }
        } catch (cookieError) {
          logger.error(`Error setting cookies: ${cookieError.message}`);
          logger.warn('Will proceed with regular authentication');
        }
      }

      // Regular authentication if cookies aren't available or are invalid
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
        
        try {
          // Save cookies for future use
          const newCookies = await this.scraper.getCookies();
          
          if (newCookies) {
            await this.cookieManager.saveCookies(newCookies);
            logger.info('New cookies saved for future sessions');
          } else {
            logger.warn('Could not retrieve cookies after authentication');
          }
          
          return true;
        } catch (cookieError) {
          logger.error(`Error saving cookies: ${cookieError.message}`);
          // Still return true as authentication was successful
          return true;
        }
      } else {
        logger.error('Twitter authentication failed');
        return false;
      }
    } catch (error) {
      logger.error(`Twitter authentication error: ${error.message}`);
      return false;
    }
  }

  // Clear cookies and session data
  async logout() {
    try {
      await this.scraper.logout();
      this.cookieManager.deleteCookies();
      this.isAuthenticated = false;
      logger.info('Successfully logged out and cleared cookies');
      return true;
    } catch (error) {
      logger.error(`Error during logout: ${error.message}`);
      return false;
    }
  }

  // Force a new authentication (ignore cookies)
  async forceReauthenticate() {
    this.isAuthenticated = false;
    await this.scraper.clearCookies();
    this.cookieManager.deleteCookies();
    return await this.authenticate();
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

  // Check if cookies are still valid
  async validateCookies() {
    if (!this.cookieManager.cookiesExist()) {
      return false;
    }
    
    const cookies = this.cookieManager.loadCookies();
    if (!cookies) return false;
    
    try {
      // Format cookies properly for validation
      const formattedCookies = this.cookieManager.formatCookiesForTwitterClient(cookies);
      await this.scraper.setCookies(formattedCookies);
      return await this.scraper.isLoggedIn();
    } catch (error) {
      logger.error(`Error validating cookies: ${error.message}`);
      return false;
    }
  }
}

export default TwitterClient;