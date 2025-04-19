import fs from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import config from '../config.js';
import logger from './logger.js';
import openaiClient from '../ai/openai-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class TopicManager {
  constructor() {
    this.dynamicTopics = {
      hashtags: [...config.sources.hashtags],
      accounts: [...config.sources.accounts],
      categories: [...config.sources.categories],
      lastUpdated: new Date().toISOString(),
      history: []
    };
    this.dataPath = join(__dirname, '../../data/dynamic-topics.json');
    this.initialized = false;
  }

  // Initialize the topic manager and load stored topics
  async initialize() {
    try {
      await this.ensureDataDirExists();
      await this.loadStoredTopics();
      this.initialized = true;
      logger.info('Topic manager initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Error initializing topic manager: ${error.message}`);
      return false;
    }
  }

  // Ensure the data directory exists
  async ensureDataDirExists() {
    try {
      const dataDir = join(__dirname, '../data');
      try {
        await fs.access(dataDir);
      } catch (e) {
        await fs.mkdir(dataDir, { recursive: true });
        logger.info('Created data directory for topic storage');
      }
    } catch (error) {
      logger.error(`Error ensuring data directory exists: ${error.message}`);
      throw error;
    }
  }

  // Load topics from storage
  async loadStoredTopics() {
    try {
      try {
        await fs.access(this.dataPath);
        const data = await fs.readFile(this.dataPath, 'utf8');
        const storedTopics = JSON.parse(data);
        
        // Merge stored topics with default config
        this.dynamicTopics = {
          hashtags: storedTopics.hashtags || [...config.sources.hashtags],
          accounts: storedTopics.accounts || [...config.sources.accounts],
          categories: storedTopics.categories || [...config.sources.categories],
          lastUpdated: storedTopics.lastUpdated || new Date().toISOString(),
          history: storedTopics.history || []
        };
        
        logger.info(`Loaded ${this.dynamicTopics.hashtags.length} hashtags and ${this.dynamicTopics.accounts.length} accounts from storage`);
      } catch (e) {
        // File doesn't exist or is invalid, use defaults from config
        logger.info('No stored topics found, using default configuration');
        await this.saveTopics();
      }
    } catch (error) {
      logger.error(`Error loading stored topics: ${error.message}`);
      throw error;
    }
  }

  // Save current topics to storage
  async saveTopics() {
    try {
      await fs.writeFile(this.dataPath, JSON.stringify(this.dynamicTopics, null, 2), 'utf8');
      logger.info('Saved dynamic topics to storage');
    } catch (error) {
      logger.error(`Error saving topics: ${error.message}`);
      throw error;
    }
  }

  // Get current hashtags to monitor
  getHashtags() {
    return this.dynamicTopics.hashtags;
  }

  // Get current accounts to monitor
  getAccounts() {
    return this.dynamicTopics.accounts;
  }

  // Get active categories
  getActiveCategories() {
    return this.dynamicTopics.categories.filter(category => category.active);
  }

  // Add a new hashtag to monitor
  async addHashtag(hashtag) {
    if (!hashtag) return false;
    
    // Ensure hashtag format
    const formattedHashtag = hashtag.startsWith('#') ? hashtag : `#${hashtag}`;
    
    // Check if already monitoring
    if (!this.dynamicTopics.hashtags.includes(formattedHashtag)) {
      this.dynamicTopics.hashtags.push(formattedHashtag);
      this.dynamicTopics.lastUpdated = new Date().toISOString();
      await this.saveTopics();
      logger.info(`Added new hashtag to monitor: ${formattedHashtag}`);
      return true;
    }
    
    return false;
  }

  // Add a new account to monitor
  async addAccount(account) {
    if (!account) return false;
    
    // Remove @ if present
    const username = account.startsWith('@') ? account.substring(1) : account;
    
    // Check if already monitoring
    if (!this.dynamicTopics.accounts.includes(username)) {
      this.dynamicTopics.accounts.push(username);
      this.dynamicTopics.lastUpdated = new Date().toISOString();
      await this.saveTopics();
      logger.info(`Added new account to monitor: ${username}`);
      return true;
    }
    
    return false;
  }

  // Set category active status
  async setCategoryStatus(categoryName, active) {
    const categoryIndex = this.dynamicTopics.categories.findIndex(
      cat => cat.name.toLowerCase() === categoryName.toLowerCase()
    );
    
    if (categoryIndex >= 0) {
      this.dynamicTopics.categories[categoryIndex].active = active;
      this.dynamicTopics.lastUpdated = new Date().toISOString();
      await this.saveTopics();
      logger.info(`Set category "${categoryName}" active status to ${active}`);
      return true;
    } else {
      // Add new category if it doesn't exist
      this.dynamicTopics.categories.push({
        name: categoryName,
        active: active
      });
      this.dynamicTopics.lastUpdated = new Date().toISOString();
      await this.saveTopics();
      logger.info(`Added new category "${categoryName}" with active status ${active}`);
      return true;
    }
  }

  // Remove a hashtag
  async removeHashtag(hashtag) {
    const formattedHashtag = hashtag.startsWith('#') ? hashtag : `#${hashtag}`;
    const index = this.dynamicTopics.hashtags.indexOf(formattedHashtag);
    
    if (index >= 0) {
      this.dynamicTopics.hashtags.splice(index, 1);
      this.dynamicTopics.lastUpdated = new Date().toISOString();
      await this.saveTopics();
      logger.info(`Removed hashtag: ${formattedHashtag}`);
      return true;
    }
    
    return false;
  }

  // Remove an account
  async removeAccount(account) {
    const username = account.startsWith('@') ? account.substring(1) : account;
    const index = this.dynamicTopics.accounts.indexOf(username);
    
    if (index >= 0) {
      this.dynamicTopics.accounts.splice(index, 1);
      this.dynamicTopics.lastUpdated = new Date().toISOString();
      await this.saveTopics();
      logger.info(`Removed account: ${username}`);
      return true;
    }
    
    return false;
  }

  // Discovery of new topics based on recent trends
  async discoverNewTopics(recentTrends) {
    if (!config.sources.discovery.enabled) {
      logger.info('Auto-discovery of topics is disabled');
      return false;
    }
    
    try {
      logger.info('Starting discovery of new topics and accounts...');
      
      // Get suggestions for new topics from OpenAI
      const topicSuggestions = await openaiClient.suggestTopicsToMonitor(
        this.dynamicTopics.hashtags, 
        recentTrends
      );
      
      if (topicSuggestions && topicSuggestions.length > 0) {
        // Add a selection of new topics
        const maxNewTopics = config.sources.discovery.maxNewTopicsPerCycle;
        const selectedTopics = topicSuggestions.slice(0, maxNewTopics);
        
        for (const suggestion of selectedTopics) {
          const topic = suggestion.topic;
          const isHashtag = topic.includes('#');
          
          if (isHashtag) {
            await this.addHashtag(topic);
          } else if (suggestion.category) {
            // Set category to active if it matches the suggestion
            const matchingCategory = this.dynamicTopics.categories.find(
              cat => cat.name.toLowerCase() === suggestion.category.toLowerCase()
            );
            
            if (matchingCategory) {
              await this.setCategoryStatus(suggestion.category, true);
            }
            
            // Still add the term as a hashtag for monitoring
            await this.addHashtag(topic);
          }
        }
        
        logger.info(`Added ${selectedTopics.length} new topics to monitor`);
      }
      
      // Get suggestions for new accounts from OpenAI
      const accountSuggestions = await openaiClient.suggestAccountsToFollow(
        this.dynamicTopics.hashtags,
        this.dynamicTopics.accounts
      );
      
      if (accountSuggestions && accountSuggestions.length > 0) {
        // Add a selection of new accounts
        const maxNewAccounts = config.sources.discovery.maxNewAccountsPerCycle;
        const selectedAccounts = accountSuggestions.slice(0, maxNewAccounts);
        
        for (const suggestion of selectedAccounts) {
          await this.addAccount(suggestion.username);
        }
        
        logger.info(`Added ${selectedAccounts.length} new accounts to monitor`);
      }
      
      // Record this discovery cycle in history
      this.recordDiscoveryCycle(topicSuggestions, accountSuggestions);
      
      return true;
    } catch (error) {
      logger.error(`Error during topic discovery: ${error.message}`);
      return false;
    }
  }

  // Record a discovery cycle in history
  recordDiscoveryCycle(topicSuggestions, accountSuggestions) {
    const cycle = {
      date: new Date().toISOString(),
      topicSuggestions: topicSuggestions || [],
      accountSuggestions: accountSuggestions || [],
      topicsAdded: topicSuggestions ? Math.min(topicSuggestions.length, config.sources.discovery.maxNewTopicsPerCycle) : 0,
      accountsAdded: accountSuggestions ? Math.min(accountSuggestions.length, config.sources.discovery.maxNewAccountsPerCycle) : 0
    };
    
    // Keep history size manageable
    this.dynamicTopics.history.push(cycle);
    if (this.dynamicTopics.history.length > 10) {
      this.dynamicTopics.history.shift();
    }
    
    this.saveTopics();
  }

  // Check if topics need to be refreshed
  needsRefresh() {
    if (!this.dynamicTopics.lastUpdated) return true;
    
    const lastUpdate = new Date(this.dynamicTopics.lastUpdated);
    const now = new Date();
    const hoursSinceLastUpdate = (now - lastUpdate) / (1000 * 60 * 60);
    
    return hoursSinceLastUpdate >= config.sources.discovery.refreshInterval;
  }
}

// Export a singleton instance
const topicManager = new TopicManager();
export default topicManager;