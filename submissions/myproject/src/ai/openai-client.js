import OpenAI from 'openai';
import config from '../config/config.js';
import logger from '../utils/logger.js';

class OpenAIClient {
  constructor() {
    this.client = null;
    this.isInitialized = false;
    this.lastSyntheticGeneration = null;
    this.lastAnalysisDate = null;
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

  // Get current date information in a normalized format
  getCurrentDateContext() {
    const now = new Date();
    
    return {
      iso: now.toISOString(),
      year: now.getFullYear(),
      month: now.getMonth() + 1, // 1-12
      day: now.getDate(),
      dayOfWeek: now.getDay(), // 0-6 (Sunday-Saturday)
      formattedDate: now.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    };
  }

  // Process tweets to extract date information
  extractDateInfoFromTweets(tweets) {
    const tweetDates = tweets
      .filter(tweet => tweet.created_at)
      .map(tweet => new Date(tweet.created_at))
      .filter(date => !isNaN(date.getTime()));
    
    if (tweetDates.length === 0) {
      return null;
    }
    
    // Find the most recent and oldest dates
    const mostRecentDate = new Date(Math.max(...tweetDates.map(date => date.getTime())));
    const oldestDate = new Date(Math.min(...tweetDates.map(date => date.getTime())));
    
    return {
      mostRecent: mostRecentDate.toISOString(),
      oldest: oldestDate.toISOString(),
      count: tweetDates.length,
      averageAge: Math.round((new Date() - mostRecentDate) / (1000 * 60 * 60)), // Average age in hours
    };
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
      
      // Extract date information from tweets
      const dateInfo = this.extractDateInfoFromTweets(tweets);
      const currentDate = this.getCurrentDateContext();
      
      // Create dynamic date context
      let dateContext = '';
      if (dateInfo) {
        // If we have tweet dates, use them for context
        dateContext = `These tweets were collected between ${new Date(dateInfo.oldest).toLocaleDateString()} and ${new Date(dateInfo.mostRecent).toLocaleDateString()}.`;
        
        // Add warning if tweets are potentially outdated
        if (dateInfo.averageAge > 48) {
          dateContext += ` Note: The average tweet age is approximately ${dateInfo.averageAge} hours old. Focus on identifying the most recent trends among these tweets.`;
        }
      } else {
        // Otherwise use current system date
        dateContext = `Using today's date (${currentDate.formattedDate}) as reference.`;
      }
      
      // Prepare information about existing terms
      const existingTermsInfo = existingTerms.length > 0 
        ? `Previously identified trends: ${existingTerms.join(', ')}.` 
        : '';
      
      // Create a more dynamic prompt for trend detection
      const systemPrompt = `You are an expert trend analyst specializing in real-time social media monitoring. 
      Your task is to analyze tweets and identify the most current emerging trends, topics, or themes.
      
      ${dateContext}
      
      Focus on identifying:
      1. Very recent and emerging topics (preferably within the last 24-48 hours)
      2. Current events being actively discussed right now
      3. New hashtags that are gaining traction
      4. Breaking news and ongoing developments
      5. Topics that seem to have appeared very recently
      
      ${existingTermsInfo}
      
      IMPORTANT: Focus exclusively on CURRENT and EMERGING trends. Avoid identifying older trends from weeks or months ago.
      
      For each trend you identify, provide:
      1. The term or hashtag (prefer hashtag format for suitable terms)
      2. The category (technology, politics, entertainment, etc.)
      3. A confidence score (0-100) for how certain you are this is a current trend
      4. A brief context explaining why this is trending now
      5. The sentiment around this trend (positive, negative, neutral)
      
      Before selecting a trend, verify that it appears to be from very recent activity based on the content and context.`;
      
      // Prepare tweet content for the prompt
      const tweetContent = sampleTweets.join('\n\n---\n\n');
      
      const response = await this.client.chat.completions.create({
        model: config.openai.model || "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze these ${sampleSize} tweets for current trends:\n\n${tweetContent}` }
        ],
        response_format: { type: "json_object" }
      });
      
      const result = JSON.parse(response.choices[0].message.content);
      logger.info(`OpenAI trend analysis completed, identified ${result.trends?.length || 0} trends`);
      
      // Add current timestamp to the trends
      const trendsWithTimestamp = (result.trends || []).map(trend => ({
        ...trend,
        analyzedAt: new Date().toISOString()
      }));
      
      // Update last analysis date
      this.lastAnalysisDate = new Date();
      
      return trendsWithTimestamp;
    } catch (error) {
      logger.error(`Error in OpenAI trend analysis: ${error.message}`);
      return [];
    }
  }

  // Generate synthetic trends when no Twitter data is available
  async generateSyntheticTrends() {
    this.ensureInitialized();
    
    try {
      logger.info('Generating synthetic trends with OpenAI');
      
      // Limit generation frequency to once per hour
      const now = new Date();
      if (this.lastSyntheticGeneration) {
        const timeSinceLastGeneration = now - this.lastSyntheticGeneration;
        const oneHourInMs = 60 * 60 * 1000;
        
        if (timeSinceLastGeneration < oneHourInMs) {
          logger.info(`Synthetic trend generation requested too soon (${Math.round(timeSinceLastGeneration/60000)} minutes since last generation)`);
          // In autonomous mode, generate anyway but with a warning
          if (!config.openai.fallbackMode) {
            return [];
          }
        }
      }
      
      // Get current date information dynamically
      const currentDate = this.getCurrentDateContext();
      
      // Create a more time-aware prompt without hardcoded time references
      const systemPrompt = `You are an expert trend forecaster and social media analyst who predicts what topics are trending RIGHT NOW.
      
      Today is ${currentDate.formattedDate}. The exact date and current context matter greatly for your predictions.
      
      Without access to real-time Twitter data, predict what topics, hashtags, and conversations are likely trending AT THIS MOMENT.
      
      For each trend you predict:
      1. Provide a term (preferably in hashtag format if appropriate)
      2. Categorize it (technology, politics, entertainment, etc.)
      3. Estimate a confidence score (0-100) for how likely this is a real trend
      4. Provide a brief context explaining why this might be trending TODAY specifically
      5. Estimate a sentiment (positive, negative, neutral)
      
      Base your predictions on:
      - Current events that would be happening in ${currentDate.month === 4 ? 'April' : new Date().toLocaleDateString('en-US', {month: 'long'})} ${currentDate.year}
      - Latest technology developments that would be relevant in ${currentDate.year}
      - Seasonal topics appropriate for this time of year
      - Current affairs that would make sense right now
      - Potential breaking news topics
      
      CRITICALLY IMPORTANT:
      - Make all trends feel current to TODAY'S date
      - Do NOT include outdated topics from previous years
      - Include trending terms that would make sense in the current technological and social landscape
      - Reference very recent developments that would be occurring now`;
      
      const response = await this.client.chat.completions.create({
        model: config.openai.model || "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Predict 5-8 likely social media trends that are emerging RIGHT NOW. Ensure they feel current and timely to today's date (${currentDate.formattedDate}). Provide response as a JSON object with an array of trends.` }
        ],
        response_format: { type: "json_object" }
      });
      
      const result = JSON.parse(response.choices[0].message.content);
      this.lastSyntheticGeneration = now;
      
      // Add timestamp and synthetic marker
      const trendsWithMetadata = (result.trends || []).map(trend => ({
        ...trend,
        generatedAt: new Date().toISOString(),
        isSynthetic: true
      }));
      
      logger.info(`Generated ${trendsWithMetadata.length} synthetic trends with OpenAI`);
      return trendsWithMetadata;
    } catch (error) {
      logger.error(`Error generating synthetic trends: ${error.message}`);
      return [];
    }
  }

  // Generate emergency topics when needed for autonomy
  async generateEmergencyTopics() {
    this.ensureInitialized();
    
    try {
      logger.info('Generating emergency topics for autonomy maintenance');
      
      const currentDate = this.getCurrentDateContext();
      
      // Create dynamic prompt with current date context
      const systemPrompt = `You are an expert in social media trends and topic discovery for the current time period.
      Generate a list of diverse, relevant hashtags that would be valuable to monitor for trending content RIGHT NOW.
      
      Today's date is ${currentDate.formattedDate}. Your recommendations should be appropriate for the current season, events, and topics that would be discussed today.
      
      For each hashtag:
      1. Ensure it's something actively discussed on social media right now
      2. Provide the category (technology, politics, entertainment, etc.)
      3. Format properly with the # symbol
      
      Include a mix of:
      - Popular evergreen topics
      - Current affairs and timely topics relevant to ${currentDate.month === 4 ? 'April' : new Date().toLocaleDateString('en-US', {month: 'long'})} ${currentDate.year}
      - Industry-specific discussions
      - Cultural phenomena
      - Seasonal topics appropriate for this time of year`;
      
      const response = await this.client.chat.completions.create({
        model: config.openai.model || "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate 10 diverse, high-value hashtags to monitor on Twitter/X that would be relevant right now (${currentDate.formattedDate}). Return as JSON with 'term' and 'category' fields.` }
        ],
        response_format: { type: "json_object" }
      });
      
      const result = JSON.parse(response.choices[0].message.content);
      logger.info(`Generated ${result.hashtags?.length || 0} emergency hashtags with OpenAI`);
      
      // Add timestamp
      const hashtagsWithTimestamp = (result.hashtags || []).map(hashtag => ({
        ...hashtag,
        generatedAt: new Date().toISOString()
      }));
      
      return hashtagsWithTimestamp;
    } catch (error) {
      logger.error(`Error generating emergency topics: ${error.message}`);
      return [];
    }
  }

  // Generate emergency accounts to follow to maintain autonomy
  async generateEmergencyAccounts() {
    this.ensureInitialized();
    
    try {
      logger.info('Generating emergency accounts to follow');
      
      const currentDate = this.getCurrentDateContext();
      
      const systemPrompt = `You are an expert in social media influence and analytics.
      Generate a list of influential Twitter/X accounts that are valuable sources of trending content right now.
      
      Today's date is ${currentDate.formattedDate}. Consider which accounts would be most relevant and active at this time.
      
      For each account:
      1. Provide the username (without @ symbol)
      2. Specify the category/domain they represent
      3. Include accounts that are active and have substantial following
      
      Include a mix of:
      - Tech influencers and innovators relevant in ${currentDate.year}
      - News outlets and journalists covering current events
      - Industry leaders in trending fields
      - Cultural commentators on current topics
      - Domain experts in seasonal or currently relevant areas`;
      
      const response = await this.client.chat.completions.create({
        model: config.openai.model || "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate 8 influential Twitter/X accounts to follow for trend detection that would be relevant today (${currentDate.formattedDate}). Return as JSON with 'username' and 'category' fields.` }
        ],
        response_format: { type: "json_object" }
      });
      
      const result = JSON.parse(response.choices[0].message.content);
      logger.info(`Generated ${result.accounts?.length || 0} emergency accounts with OpenAI`);
      
      // Add timestamp
      const accountsWithTimestamp = (result.accounts || []).map(account => ({
        ...account,
        generatedAt: new Date().toISOString()
      }));
      
      return accountsWithTimestamp;
    } catch (error) {
      logger.error(`Error generating emergency accounts: ${error.message}`);
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
      const currentDate = this.getCurrentDateContext();
      
      const response = await this.client.chat.completions.create({
        model: config.openai.model || "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: `You are an expert in social media trends and topic discovery for the current time period (${currentDate.formattedDate}). Your task is to suggest new hashtags, keywords, and topics to monitor based on current monitoring targets and recent trends.` 
          },
          { 
            role: "user", 
            content: `Currently monitoring topics/hashtags: ${topicsStr || 'None specified'}
            
            Recent trends detected: ${trendsStr || 'None detected'}
            
            Today's date: ${currentDate.formattedDate}
            
            Please suggest 5-10 new topics, hashtags, or keywords to monitor that would diversify and enhance trend detection. Include topics from different domains (technology, politics, culture, etc.) that would be relevant right now. Return your suggestions as a JSON array with objects containing 'topic' and 'category' fields.`
          }
        ],
        response_format: { type: "json_object" }
      });
      
      const result = JSON.parse(response.choices[0].message.content);
      logger.info(`Received ${result.suggestions?.length || 0} topic suggestions from OpenAI`);
      
      // Add timestamp
      const suggestionsWithTimestamp = (result.suggestions || []).map(suggestion => ({
        ...suggestion,
        generatedAt: new Date().toISOString()
      }));
      
      return suggestionsWithTimestamp;
    } catch (error) {
      logger.error(`Error getting topic suggestions from OpenAI: ${error.message}`);
      return [];
    }
  }

  async suggestAccountsToFollow(topics = [], currentAccounts = []) {
    this.ensureInitialized();
    
    try {
      logger.info('Requesting account suggestions from OpenAI');
      
      const topicsStr = Array.isArray(topics) ? topics.join(', ') : '';
      const accountsStr = Array.isArray(currentAccounts) ? currentAccounts.join(', ') : '';
      const currentDate = this.getCurrentDateContext();
      
      const response = await this.client.chat.completions.create({
        model: config.openai.model || "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: `You are an expert in social media influence and topic discovery. Your task is to suggest influential Twitter/X accounts to monitor based on given topics and the current date ${currentDate.formattedDate}.` 
          },
          { 
            role: "user", 
            content: `Topics of interest: ${topicsStr || 'General trending topics'}
            
            Currently following accounts: ${accountsStr || 'None specified'}
            
            Please suggest 5-10 influential Twitter/X accounts to monitor that would provide valuable insights on the topics of interest. Include accounts from different domains.
            
            Return your suggestions as a JSON object with a 'suggestions' array containing objects with 'username', 'category', and 'reason' fields.`
          }
        ],
        response_format: { type: "json_object" }
      });
      
      let result;
      try {
        result = JSON.parse(response.choices[0].message.content);
      } catch (parseError) {
        logger.error(`Error parsing OpenAI response: ${parseError.message}`);
        return [];
      }
      
      // Handle different possible response formats
      let suggestions = [];
      if (result.suggestions && Array.isArray(result.suggestions)) {
        suggestions = result.suggestions;
      } else if (result.accounts && Array.isArray(result.accounts)) {
        suggestions = result.accounts;
      } else if (Array.isArray(result)) {
        suggestions = result;
      }
      
      logger.info(`Received ${suggestions.length} account suggestions from OpenAI`);
      
      // Add timestamp and ensure all objects have required fields
      const suggestionsWithTimestamp = suggestions.map(suggestion => ({
        username: suggestion.username || suggestion.account || suggestion.name || '',
        category: suggestion.category || suggestion.domain || 'General',
        reason: suggestion.reason || suggestion.description || '',
        generatedAt: new Date().toISOString()
      }));
      
      return suggestionsWithTimestamp;
    } catch (error) {
      logger.error(`Error getting account suggestions from OpenAI: ${error.message}`);
      return [];
    }
  }

  // Generate an enhanced trend report for publication
  async generateEnhancedTrendReport(trends) {
    this.ensureInitialized();
    
    try {
      if (!trends || trends.length === 0) {
        return 'No micro-trends detected today. Stay tuned for future insights!';
      }
      
      logger.info('Generating enhanced trend report with OpenAI');
      
      const trendsData = JSON.stringify(trends);
      const reportType = trends.some(t => t.isSynthetic) ? 'AI-Predicted' : 'Detected';
      const currentDate = this.getCurrentDateContext();
      
      // Enrich the prompt with contextual time information
      const response = await this.client.chat.completions.create({
        model: config.openai.model || "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: `You are an expert trend analyst creating engaging social media content. Create a concise, engaging trend report suitable for Twitter/X. The report should be informative, engaging, and fit within Twitter's character limit. Today's date is ${currentDate.formattedDate}.` 
          },
          { 
            role: "user", 
            content: `Create an engaging trend report based on these ${reportType.toLowerCase()} trends: ${trendsData}
            
            Requirements:
            - Start with an attention-grabbing headline that mentions it's for today (${currentDate.formattedDate})
            - Highlight top 3-5 trends with appropriate emojis
            - Keep the overall length under 280 characters
            - Include the signature "Analyzed by #TrendSnipper 🎯"
            - Add relevant hashtags like #AI #TrendSpotting
            - If any trends are synthetic/AI-predicted, make that clear
            - Ensure the content feels current and timely`
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
        const currentDate = this.getCurrentDateContext();
        const reportTitle = trends.some(t => t.isSynthetic) 
          ? `🔮 AI-Predicted Micro-Trends for ${currentDate.formattedDate} 🔮\n\n` 
          : `📊 Today's Micro-Trends (${currentDate.formattedDate}) 📈\n\n`;
          
        let report = reportTitle;
        
        trends.slice(0, 5).forEach((trend, index) => {
          const emoji = index === 0 ? '🔥' : index === 1 ? '⚡' : '📈';
          const newLabel = trend.isNew ? ' (NEW!)' : '';
          
          report += `${emoji} ${trend.term}${newLabel}\n`;
        });
        
        report += '\nAnalyzed by #TrendSnipper 🎯 #AI #TrendSpotting';
        return report;
      }
      
      return 'No micro-trends detected today. Stay tuned for future insights!';
    }
  }
}

// Export a singleton instance
const openaiClient = new OpenAIClient();
export default openaiClient;