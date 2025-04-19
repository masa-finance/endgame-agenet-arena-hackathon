import OpenAI from 'openai';
import config from './config.js';
import logger from './utils/logger.js';

class OpenAIClient {
  constructor() {
    this.client = null;
    this.isInitialized = false;
  }

  // Initialize the OpenAI client with API key
  initialize() {
    try {
      if (!config.openai || !config.openai.apiKey) {
        logger.error('OpenAI API key is missing in configuration');
        return false;
      }

      this.client = new OpenAI({
        apiKey: config.openai.apiKey,
      });
      
      this.isInitialized = true;
      logger.info('OpenAI client initialized successfully');
      return true;
    } catch (error) {
      logger.error(`Error initializing OpenAI client: ${error.message}`);
      return false;
    }
  }

  // Ensure client is initialized before making API calls
  ensureInitialized() {
    if (!this.isInitialized) {
      const initialized = this.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize OpenAI client');
      }
    }
  }

  // Analyze tweets to identify emerging trends using AI
  async analyzeTrends(tweets, existingTerms = []) {
    this.ensureInitialized();
    
    try {
      if (!tweets || tweets.length === 0) {
        logger.warn('No tweets provided for trend analysis');
        return [];
      }
      
      // Prepare tweet data for analysis
      const tweetTexts = tweets.map(tweet => tweet.full_text || tweet.text || '').filter(text => text.length > 0);
      
      if (tweetTexts.length === 0) {
        logger.warn('No valid tweet texts to analyze');
        return [];
      }
      
      logger.info(`Analyzing ${tweetTexts.length} tweets with OpenAI`);
      
      // Create a sample of tweets if there are too many
      const sampleSize = Math.min(tweetTexts.length, config.openai.maxSampleSize || 100);
      const sampleTweets = tweetTexts.sort(() => 0.5 - Math.random()).slice(0, sampleSize);
      
      // Prepare existing terms information
      const existingTermsInfo = existingTerms.length > 0 
        ? `Previously identified trends: ${existingTerms.join(', ')}.` 
        : '';
      
      // Create the prompt for trend detection
      const systemPrompt = `You are an expert trend analyst. Analyze the following tweets and identify emerging trends, topics, or themes. 
      Focus on identifying both explicit hashtags and implicit themes/topics across multiple tweets.
      ${existingTermsInfo}
      
      When identifying trends, consider:
      1. Recurring themes or topics
      2. Emerging conversations or debates
      3. New hashtags or terminology
      4. Current events being discussed
      5. Sentiment shifts around topics
      
      Categorize trends by domain (technology, politics, entertainment, etc.) and provide a confidence score (0-100) for each identified trend.`;
      
      // Prepare tweet text for the prompt
      const tweetContent = sampleTweets.join('\n\n---\n\n');
      
      const response = await this.client.chat.completions.create({
        model: config.openai.model || "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze these ${sampleSize} tweets for trends:\n\n${tweetContent}` }
        ],
        response_format: { type: "json_object" }
      });
      
      const result = JSON.parse(response.choices[0].message.content);
      logger.info(`OpenAI trend analysis completed, identified ${result.trends?.length || 0} trends`);
      
      return result.trends || [];
    } catch (error) {
      logger.error(`Error in OpenAI trend analysis: ${error.message}`);
      return [];
    }
  }

  // Suggest new topics or hashtags to monitor based on current trends
  async suggestTopicsToMonitor(currentTopics = [], recentTrends = []) {
    this.ensureInitialized();
    
    try {
      logger.info('Requesting topic suggestions from OpenAI');
      
      const topicsStr = currentTopics.join(', ');
      const trendsStr = recentTrends.map(t => t.term).join(', ');
      
      const response = await this.client.chat.completions.create({
        model: config.openai.model || "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: `You are an expert in social media trends and topic discovery. Your task is to suggest new hashtags, keywords, and topics to monitor based on current monitoring targets and recent trends.` 
          },
          { 
            role: "user", 
            content: `Currently monitoring topics/hashtags: ${topicsStr || 'None specified'}
            
            Recent trends detected: ${trendsStr || 'None detected'}
            
            Please suggest 5-10 new topics, hashtags, or keywords to monitor that would diversify and enhance trend detection. Include topics from different domains (technology, politics, culture, etc.). Return your suggestions as a JSON array with objects containing 'topic' and 'category' fields.`
          }
        ],
        response_format: { type: "json_object" }
      });
      
      const result = JSON.parse(response.choices[0].message.content);
      logger.info(`Received ${result.suggestions?.length || 0} topic suggestions from OpenAI`);
      
      return result.suggestions || [];
    } catch (error) {
      logger.error(`Error getting topic suggestions from OpenAI: ${error.message}`);
      return [];
    }
  }

  // Suggest influential accounts to follow based on topics
  async suggestAccountsToFollow(topics = [], currentAccounts = []) {
    this.ensureInitialized();
    
    try {
      logger.info('Requesting account suggestions from OpenAI');
      
      const topicsStr = topics.join(', ');
      const accountsStr = currentAccounts.join(', ');
      
      const response = await this.client.chat.completions.create({
        model: config.openai.model || "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: `You are an expert in social media influence and topic discovery. Your task is to suggest influential Twitter/X accounts to monitor based on given topics.` 
          },
          { 
            role: "user", 
            content: `Topics of interest: ${topicsStr || 'General trending topics'}
            
            Currently following accounts: ${accountsStr || 'None specified'}
            
            Please suggest 5-10 influential Twitter/X accounts to monitor that would provide valuable insights on the topics of interest. Include accounts from different domains. Return your suggestions as a JSON array with objects containing 'username', 'category', and 'reason' fields.`
          }
        ],
        response_format: { type: "json_object" }
      });
      
      const result = JSON.parse(response.choices[0].message.content);
      logger.info(`Received ${result.suggestions?.length || 0} account suggestions from OpenAI`);
      
      return result.suggestions || [];
    } catch (error) {
      logger.error(`Error getting account suggestions from OpenAI: ${error.message}`);
      return [];
    }
  }

  // Generate enhanced trend report for publication
  async generateEnhancedTrendReport(trends) {
    this.ensureInitialized();
    
    try {
      if (!trends || trends.length === 0) {
        return 'No micro-trends detected today. Stay tuned for future insights!';
      }
      
      logger.info('Generating enhanced trend report with OpenAI');
      
      const trendsData = JSON.stringify(trends);
      
      const response = await this.client.chat.completions.create({
        model: config.openai.model || "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: `You are an expert trend analyst creating engaging social media content. Create a concise, engaging trend report suitable for Twitter/X. The report should be informative, engaging, and fit within Twitter's character limit.` 
          },
          { 
            role: "user", 
            content: `Create an engaging trend report based on these detected trends: ${trendsData}
            
            Requirements:
            - Start with an attention-grabbing headline
            - Highlight top 3-5 trends with appropriate emojis
            - Keep the overall length under 280 characters
            - Include the signature "Analyzed by #TrendSniper 🎯"
            - Add relevant hashtags like #AI #TrendSpotting`
          }
        ]
      });
      
      const report = response.choices[0].message.content.trim();
      logger.info('Enhanced trend report generated successfully');
      
      return report;
    } catch (error) {
      logger.error(`Error generating enhanced trend report: ${error.message}`);
      
      // Fall back to basic report if AI generation fails
      if (trends && trends.length > 0) {
        let report = '📊 Detected Micro-Trends 📈\n\n';
        
        trends.slice(0, 5).forEach((trend, index) => {
          const emoji = index === 0 ? '🔥' : index === 1 ? '⚡' : '📈';
          const newLabel = trend.isNew ? ' (NEW!)' : '';
          
          report += `${emoji} ${trend.term}${newLabel}\n`;
        });
        
        report += '\nAnalyzed by #TrendSniper 🎯 #AI #TrendSpotting';
        return report;
      }
      
      return 'No micro-trends detected today. Stay tuned for future insights!';
    }
  }
}

// Export a singleton instance
const openaiClient = new OpenAIClient();
export default openaiClient;