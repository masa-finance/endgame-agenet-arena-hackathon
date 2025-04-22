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
      
      logger.info(`Attempting login with username: ${username}`);
      
      // If API keys are provided, use complete authentication (required for certain features)
      if (apiKey && apiSecretKey && accessToken && accessTokenSecret) {
        logger.info('Using full API authentication');
        await this.scraper.login(username, password, email, apiKey, apiSecretKey, accessToken, accessTokenSecret);
      } else {
        // Basic authentication
        logger.info('Using basic authentication');
        await this.scraper.login(username, password, email);
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

  // Version améliorée pour publier un tweet
  async publishTweet(text) {
    // Vérifier l'authentification
    if (!this.isAuthenticated) {
      logger.info('Not authenticated, attempting authentication...');
      const authResult = await this.authenticate();
      if (!authResult) {
        logger.error('Authentication failed, cannot publish tweet');
        return false;
      }
    }
    
    // Vérifier si le texte est valide
    if (!text || typeof text !== 'string' || text.trim() === '') {
      logger.error('Invalid tweet text provided');
      return false;
    }
    
    // Limiter la longueur du tweet si nécessaire (280 caractères max)
    const tweetText = text.length > 280 ? text.substring(0, 277) + '...' : text;
    
    try {
      logger.info(`Attempting to publish tweet: ${tweetText.substring(0, 50)}...`);
      
      // Première tentative avec sendTweet standard
      let result = await this.scraper.sendTweet(tweetText);
      
      // Log du résultat
      if (result) {
        logger.info(`Tweet published successfully using standard method! Result: ${JSON.stringify(result)}`);
        return true;
      }
      
      // Si la première méthode échoue, essayer la méthode V2
      logger.warn('Standard tweet method failed, trying V2 method...');
      result = await this.scraper.sendTweetV2(tweetText);
      
      if (result) {
        logger.info(`Tweet published successfully using V2 method! Result: ${JSON.stringify(result)}`);
        return true;
      }
      
      logger.error('Both tweet methods failed without throwing errors');
      return false;
    } catch (error) {
      logger.error(`Error publishing tweet: ${error.message}`);
      logger.error(`Error stack: ${error.stack}`);
      
      // Tenter de réauthentifier et réessayer en cas d'échec
      try {
        logger.info('Attempting to reauthenticate and retry publishing...');
        await this.forceReauthenticate();
        
        const result = await this.scraper.sendTweet(tweetText);
        if (result) {
          logger.info(`Tweet published successfully after reauthentication! Result: ${JSON.stringify(result)}`);
          return true;
        }
        
        return false;
      } catch (retryError) {
        logger.error(`Retry failed: ${retryError.message}`);
        return false;
      }
    }
  }

  // Publish a tweet containing discovered trends
  async publishTrends(trendReport) {
    return await this.publishTweet(trendReport);
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