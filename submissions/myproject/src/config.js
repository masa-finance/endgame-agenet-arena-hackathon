import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: join(__dirname, '..', '.env') });

export default {
  twitter: {
    username: process.env.TWITTER_USERNAME,
    password: process.env.TWITTER_PASSWORD,
    email: process.env.TWITTER_EMAIL,
    apiKey: process.env.TWITTER_API_KEY,
    apiSecretKey: process.env.TWITTER_API_SECRET_KEY,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET
  },
  // OpenAI integration configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4o", // Default to GPT-4o
    maxSampleSize: parseInt(process.env.OPENAI_MAX_SAMPLE_SIZE || '100'), // Maximum tweets to send to OpenAI
    useForTrendDetection: process.env.USE_OPENAI_FOR_TRENDS === 'true', // Flag to enable/disable OpenAI trend detection
    useForTopicSuggestions: process.env.USE_OPENAI_FOR_TOPICS === 'true', // Flag to enable/disable topic suggestions
  },
  sources: {
    // Hashtags to monitor (initial set, will be dynamically expanded)
    hashtags: ['#AI', '#MachineLearning', '#Web3', '#Blockchain', '#NFT', '#Crypto'],
    // Categories to monitor dynamically (will be used for topic exploration)
    categories: [
      {name: 'Technology', active: true},
      {name: 'Politics', active: process.env.MONITOR_POLITICS === 'true' || false},
      {name: 'Entertainment', active: process.env.MONITOR_ENTERTAINMENT === 'true' || false},
      {name: 'Sports', active: process.env.MONITOR_SPORTS === 'true' || false},
      {name: 'Business', active: process.env.MONITOR_BUSINESS === 'true' || false},
      {name: 'Health', active: process.env.MONITOR_HEALTH === 'true' || false}
    ],
    // Influential accounts to follow (usernames)
    accounts: ['elonmusk', 'naval', 'vitalikbuterin', 'balajis', 'punk6529'],
    // Maximum number of tweets to collect per source
    maxTweetsPerSource: parseInt(process.env.MAX_TWEETS_PER_SOURCE || '100'),
    // Auto-discovery settings
    discovery: {
      enabled: process.env.AUTO_DISCOVERY === 'true' || false,
      maxNewTopicsPerCycle: parseInt(process.env.MAX_NEW_TOPICS || '3'), 
      maxNewAccountsPerCycle: parseInt(process.env.MAX_NEW_ACCOUNTS || '2'),
      refreshInterval: parseInt(process.env.DISCOVERY_REFRESH_INTERVAL || '24') // Hours
    }
  },
  analysis: {
    // Minimum number of times a term must appear to be considered a trend
    minOccurrences: parseInt(process.env.MIN_TREND_OCCURRENCES || '3'),
    // Growth percentage threshold to detect an emerging trend
    growthThreshold: parseInt(process.env.TREND_GROWTH_THRESHOLD || '50'),
    // Terms to exclude from analysis (stopwords will also be excluded)
    excludedTerms: ['RT', 'http', 'https', 'amp', 't.co'],
    // Maximum stored history of previous trends (for comparison)
    trendHistorySize: parseInt(process.env.TREND_HISTORY_SIZE || '10'),
    // Enhanced analysis settings
    enhancedAnalysis: {
      enabled: process.env.ENHANCED_ANALYSIS === 'true' || false,
      sentimentAnalysis: process.env.SENTIMENT_ANALYSIS === 'true' || false,
      categorizeTopics: process.env.CATEGORIZE_TOPICS === 'true' || false
    }
  },
  scheduler: {
    // Cron expression for periodic execution (default: every 4 hours)
    cronSchedule: process.env.CRON_SCHEDULE || '0 */4 * * *',
    // Cron for discovery of new topics/accounts (default: once daily)
    discoveryCronSchedule: process.env.DISCOVERY_CRON_SCHEDULE || '0 0 * * *'
  },
  mcp: {
    // MCP server configuration
    server: {
      name: 'TrendSnipperMCP',
      version: '1.0.0',
      port: parseInt(process.env.MCP_PORT || '3000')
    },
    // MCP client configuration
    client: {
      // External MCP servers to connect to
      externalServers: [
        // Example external server:
        // {
        //   id: "weather",
        //   command: "npx",
        //   args: ["-y", "@modelcontextprotocol/server-weather"]
        // }
      ]
    }
  },
  reporting: {
    // Enhanced reporting settings
    enhancedReports: process.env.ENHANCED_REPORTS === 'true' || false,
    includeCategories: process.env.INCLUDE_CATEGORIES === 'true' || false,
    maxTrendsInReport: parseInt(process.env.MAX_TRENDS_IN_REPORT || '5')
  }
};