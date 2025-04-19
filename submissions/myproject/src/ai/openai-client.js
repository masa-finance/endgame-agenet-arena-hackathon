import OpenAI from 'openai';
import config from '../config.js';
import logger from '../utils/logger.js';

class OpenAIClient {
  constructor() {
    this.client = null;
    this.isInitialized = false;
    this.lastSyntheticGeneration = null;
  }

  // Initialiser le client OpenAI avec la clé API
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

  // S'assurer que le client est initialisé avant d'effectuer des appels API
  ensureInitialized() {
    if (!this.isInitialized) {
      const initialized = this.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize OpenAI client');
      }
    }
  }

  // Analyser les tweets pour identifier les tendances émergentes en utilisant l'IA
  async analyzeTrends(tweets, existingTerms = []) {
    this.ensureInitialized();
    
    try {
      if (!tweets || tweets.length === 0) {
        logger.warn('No tweets provided for trend analysis');
        return [];
      }
      
      // Préparer les données de tweets pour l'analyse
      const tweetTexts = tweets.map(tweet => tweet.full_text || tweet.text || '').filter(text => text.length > 0);
      
      if (tweetTexts.length === 0) {
        logger.warn('No valid tweet texts to analyze');
        return [];
      }
      
      logger.info(`Analyzing ${tweetTexts.length} tweets with OpenAI`);
      
      // Créer un échantillon de tweets s'il y en a trop
      const sampleSize = Math.min(tweetTexts.length, config.openai.maxSampleSize || 100);
      const sampleTweets = tweetTexts.sort(() => 0.5 - Math.random()).slice(0, sampleSize);
      
      // Préparer les informations sur les termes existants
      const existingTermsInfo = existingTerms.length > 0 
        ? `Previously identified trends: ${existingTerms.join(', ')}.` 
        : '';
      
      // Créer le prompt pour la détection de tendances
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
      
      // Préparer le texte du tweet pour le prompt
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

  // Générer des tendances synthétiques quand aucune donnée Twitter n'est disponible
  async generateSyntheticTrends() {
    this.ensureInitialized();
    
    try {
      logger.info('Generating synthetic trends with OpenAI');
      
      // Limiter la fréquence de génération à une fois par heure
      const now = new Date();
      if (this.lastSyntheticGeneration) {
        const timeSinceLastGeneration = now - this.lastSyntheticGeneration;
        const oneHourInMs = 60 * 60 * 1000;
        
        if (timeSinceLastGeneration < oneHourInMs) {
          logger.info(`Synthetic trend generation requested too soon (${Math.round(timeSinceLastGeneration/60000)} minutes since last generation)`);
          // En mode autonome, on génère quand même mais avec un avertissement
          if (!config.openai.fallbackMode) {
            return [];
          }
        }
      }
      
      const systemPrompt = `You are an expert trend analyst who can predict emerging social media trends.
      Without access to real-time Twitter data, predict what topics, hashtags, and conversations might be trending right now.
      
      For each trend you predict:
      1. Provide a term (preferably in hashtag format if appropriate)
      2. Categorize it (technology, politics, entertainment, etc.)
      3. Estimate a confidence score (0-100) for how likely this is a real trend
      4. Provide a brief context explaining why this might be trending
      5. Estimate a sentiment (positive, negative, neutral)
      
      Base your predictions on:
      - Current events and seasonal topics
      - Ongoing technology developments
      - Cultural moments and regular patterns
      - Recurring discussions in different domains`;
      
      const response = await this.client.chat.completions.create({
        model: config.openai.model || "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Predict 5-8 likely social media trends that might be emerging right now. Provide response as a JSON object with an array of trends.` }
        ],
        response_format: { type: "json_object" }
      });
      
      const result = JSON.parse(response.choices[0].message.content);
      this.lastSyntheticGeneration = now;
      
      logger.info(`Generated ${result.trends?.length || 0} synthetic trends with OpenAI`);
      return result.trends || [];
    } catch (error) {
      logger.error(`Error generating synthetic trends: ${error.message}`);
      return [];
    }
  }

  // Générer des sujets d'urgence quand nécessaire pour l'autonomie
  async generateEmergencyTopics() {
    this.ensureInitialized();
    
    try {
      logger.info('Generating emergency topics for autonomy maintenance');
      
      const systemPrompt = `You are an expert in social media trends and topic discovery.
      Generate a list of diverse, relevant hashtags that would be valuable to monitor for trending content.
      
      For each hashtag:
      1. Ensure it's something actively discussed on social media
      2. Provide the category (technology, politics, entertainment, etc.)
      3. Format properly with the # symbol
      
      Include a mix of:
      - Popular evergreen topics
      - Current affairs and timely topics
      - Industry-specific discussions
      - Cultural phenomena`;
      
      const response = await this.client.chat.completions.create({
        model: config.openai.model || "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate 10 diverse, high-value hashtags to monitor on Twitter/X. Return as JSON with 'term' and 'category' fields.` }
        ],
        response_format: { type: "json_object" }
      });
      
      const result = JSON.parse(response.choices[0].message.content);
      logger.info(`Generated ${result.hashtags?.length || 0} emergency hashtags with OpenAI`);
      
      return result.hashtags || [];
    } catch (error) {
      logger.error(`Error generating emergency topics: ${error.message}`);
      return [];
    }
  }

  // Générer des comptes d'urgence à suivre pour maintenir l'autonomie
  async generateEmergencyAccounts() {
    this.ensureInitialized();
    
    try {
      logger.info('Generating emergency accounts to follow');
      
      const systemPrompt = `You are an expert in social media influence and analytics.
      Generate a list of influential Twitter/X accounts that are valuable sources of trending content.
      
      For each account:
      1. Provide the username (without @ symbol)
      2. Specify the category/domain they represent
      3. Include accounts that are active and have substantial following
      
      Include a mix of:
      - Tech influencers and innovators
      - News outlets and journalists
      - Industry leaders
      - Cultural commentators
      - Domain experts`;
      
      const response = await this.client.chat.completions.create({
        model: config.openai.model || "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate 8 influential Twitter/X accounts to follow for trend detection. Return as JSON with 'username' and 'category' fields.` }
        ],
        response_format: { type: "json_object" }
      });
      
      const result = JSON.parse(response.choices[0].message.content);
      logger.info(`Generated ${result.accounts?.length || 0} emergency accounts with OpenAI`);
      
      return result.accounts || [];
    } catch (error) {
      logger.error(`Error generating emergency accounts: ${error.message}`);
      return [];
    }
  }

  // Suggérer de nouveaux sujets ou hashtags à surveiller en fonction des tendances actuelles
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

  // Suggérer des comptes influents à suivre en fonction des sujets
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

  // Générer un rapport de tendance amélioré pour publication
  async generateEnhancedTrendReport(trends) {
    this.ensureInitialized();
    
    try {
      if (!trends || trends.length === 0) {
        return 'No micro-trends detected today. Stay tuned for future insights!';
      }
      
      logger.info('Generating enhanced trend report with OpenAI');
      
      const trendsData = JSON.stringify(trends);
      const reportType = trends.some(t => t.isSynthetic) ? 'AI-Predicted' : 'Detected';
      
      const response = await this.client.chat.completions.create({
        model: config.openai.model || "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: `You are an expert trend analyst creating engaging social media content. Create a concise, engaging trend report suitable for Twitter/X. The report should be informative, engaging, and fit within Twitter's character limit.` 
          },
          { 
            role: "user", 
            content: `Create an engaging trend report based on these ${reportType.toLowerCase()} trends: ${trendsData}
            
            Requirements:
            - Start with an attention-grabbing headline
            - Highlight top 3-5 trends with appropriate emojis
            - Keep the overall length under 280 characters
            - Include the signature "Analyzed by #TrendSnipper 🎯"
            - Add relevant hashtags like #AI #TrendSpotting
            - If any trends are synthetic/AI-predicted, make that clear`
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
        const reportTitle = trends.some(t => t.isSynthetic) 
          ? '🔮 AI-Predicted Micro-Trends 🔮\n\n' 
          : '📊 Detected Micro-Trends 📈\n\n';
          
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