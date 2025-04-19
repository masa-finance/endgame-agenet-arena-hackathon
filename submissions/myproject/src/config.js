import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: join(__dirname, '..', '.env') });

// Determine if we're in production mode
const isProduction = process.env.NODE_ENV === 'production';

// Function to dynamically generate initial hashtags based on active categories
function generateInitialHashtags() {
  const categories = [
    { name: 'Technology', hashtags: ['#AI', '#MachineLearning', '#Web3', '#Blockchain'] },
    { name: 'Business', hashtags: ['#Startup', '#Entrepreneurship', '#Innovation', '#Finance'] },
    { name: 'Politics', hashtags: ['#Politics', '#Policy', '#Governance', '#Democracy'] },
    { name: 'Entertainment', hashtags: ['#Movies', '#Music', '#Gaming', '#Streaming'] },
    { name: 'Sports', hashtags: ['#Olympics', '#Football', '#Basketball', '#Tennis'] },
    { name: 'Health', hashtags: ['#Health', '#Wellness', '#MentalHealth', '#Healthcare'] }
  ];
  
  let initialHashtags = [];
  
  // Always include technology as a base category
  initialHashtags = [...initialHashtags, ...categories[0].hashtags];
  
  // Add hashtags from active categories based on .env configuration
  if (process.env.MONITOR_BUSINESS === 'true') {
    initialHashtags = [...initialHashtags, ...categories[1].hashtags.slice(0, 2)];
  }
  
  if (process.env.MONITOR_POLITICS === 'true') {
    initialHashtags = [...initialHashtags, ...categories[2].hashtags.slice(0, 2)];
  }
  
  if (process.env.MONITOR_ENTERTAINMENT === 'true') {
    initialHashtags = [...initialHashtags, ...categories[3].hashtags.slice(0, 2)];
  }
  
  if (process.env.MONITOR_SPORTS === 'true') {
    initialHashtags = [...initialHashtags, ...categories[4].hashtags.slice(0, 2)];
  }
  
  if (process.env.MONITOR_HEALTH === 'true') {
    initialHashtags = [...initialHashtags, ...categories[5].hashtags.slice(0, 2)];
  }
  
  // Limit to a maximum of 10 starting hashtags to avoid API limits
  return initialHashtags.slice(0, 10);
}

// Exported configuration
export default {
  // Agent behavior configuration
  agent: {
    autoStart: process.env.AUTO_START === 'true' || true, // Démarrer automatiquement par défaut
    showNextPostTime: process.env.SHOW_NEXT_POST_TIME === 'true' || true // Afficher l'heure du prochain post
  },
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
    maxSampleSize: parseInt(process.env.OPENAI_MAX_SAMPLE_SIZE || '100'), // Max tweets sent to OpenAI
    useForTrendDetection: process.env.USE_OPENAI_FOR_TRENDS === 'true', // Enable/disable trend detection
    useForTopicSuggestions: process.env.USE_OPENAI_FOR_TOPICS === 'true', // Enable/disable topic suggestions
    fallbackMode: true, // Always enable fallback mode for full autonomy
  },
  sources: {
    // Hashtags to monitor (initial set, will expand dynamically)
    hashtags: generateInitialHashtags(),
    // Dynamically monitored categories (used for topic exploration)
    categories: [
      {name: 'Technology', active: true},
      {name: 'Politics', active: process.env.MONITOR_POLITICS === 'true' || false},
      {name: 'Entertainment', active: process.env.MONITOR_ENTERTAINMENT === 'true' || false},
      {name: 'Sports', active: process.env.MONITOR_SPORTS === 'true' || false},
      {name: 'Business', active: process.env.MONITOR_BUSINESS === 'true' || false},
      {name: 'Health', active: process.env.MONITOR_HEALTH === 'true' || false}
    ],
    // Agent autonomy configuration
    autonomy: {
      enabled: true,
      maxHashtagsToMonitor: parseInt(process.env.MAX_HASHTAGS || '20'),
      maxAccountsToMonitor: parseInt(process.env.MAX_ACCOUNTS || '15'),
      initialExploration: true, // Start with proactive exploration even with no data
      adaptiveCollection: true, // Adjust strategy based on results
    },
    // Influencer accounts to monitor (will be discovered dynamically)
    accounts: [],
    // Max number of tweets to collect per source
    maxTweetsPerSource: parseInt(process.env.MAX_TWEETS_PER_SOURCE || '100'),
    // Automatic discovery parameters
    discovery: {
      enabled: process.env.AUTO_DISCOVERY !== 'false', // Enabled by default for autonomy
      maxNewTopicsPerCycle: parseInt(process.env.MAX_NEW_TOPICS || '5'), 
      maxNewAccountsPerCycle: parseInt(process.env.MAX_NEW_ACCOUNTS || '3'),
      refreshInterval: parseInt(process.env.DISCOVERY_REFRESH_INTERVAL || '12'), // In hours
      fallbackThreshold: 5, // Minimum sources before triggering emergency discovery
    }
  },
  analysis: {
    // Minimum term occurrences to be considered a trend
    minOccurrences: parseInt(process.env.MIN_TREND_OCCURRENCES || '3'),
    // Growth percentage threshold to detect emerging trends
    growthThreshold: parseInt(process.env.TREND_GROWTH_THRESHOLD || '50'),
    // Terms to exclude from analysis (stopwords also excluded)
    excludedTerms: ['RT', 'http', 'https', 'amp', 't.co'],
    // Max number of previous trend histories to keep (for comparison)
    trendHistorySize: parseInt(process.env.TREND_HISTORY_SIZE || '10'),
    // Enhanced analysis configuration
    enhancedAnalysis: {
      enabled: process.env.ENHANCED_ANALYSIS === 'true' || false,
      sentimentAnalysis: process.env.SENTIMENT_ANALYSIS === 'true' || false,
      categorizeTopics: process.env.CATEGORIZE_TOPICS === 'true' || false
    },
    // Autonomous fallback modes in case of failure
    autonomousFallback: {
      enabled: true,
      generateSyntheticTrends: true,
      useExternalDataSources: true,
    }
  },
  scheduler: {
    // Cron expression for periodic execution (default: every 4 hours)
    cronSchedule: process.env.CRON_SCHEDULE || '0 */4 * * *',
    // Cron for discovery of new topics/accounts (default: once per day)
    discoveryCronSchedule: process.env.DISCOVERY_CRON_SCHEDULE || '0 0 * * *',
    // Dynamic scheduler configuration
    dynamic: {
      enabled: true,
      minInterval: '0 */2 * * *', // Minimum every 2 hours
      maxInterval: '0 */8 * * *', // Maximum every 8 hours
      adaptBasedOn: 'activity', // 'activity' or 'results'
    }
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
      // External MCP servers to connect
      externalServers: [
        // Example external server:
        {
         id: "masa-mcp",
          command: "node",
         args: ["C:/Users/Naesmal/Downloads/Documents/endgame-mcp-hackathon/dist/index.js"]
        }
      ]
    }
  },
  reporting: {
    // Enhanced report configuration
    enhancedReports: process.env.ENHANCED_REPORTS === 'true' || false,
    includeCategories: process.env.INCLUDE_CATEGORIES === 'true' || false,
    maxTrendsInReport: parseInt(process.env.MAX_TRENDS_IN_REPORT || '5'),
    // Autonomous trend publishing
    autonomousPublishing: {
      enabled: true,
      minTrendsForPublication: 3, // Minimum number of trends to publish
      maxPublicationsPerDay: 4,   // Maximum number of publications per day
    }
  },
  // Masa protocol activation for fallback trends
  masa: {
    enabled: process.env.ENABLE_MASA_PROTOCOL === 'true' || false,
    endpoint: process.env.MASA_ENDPOINT || 'http://localhost:8080/api/v1/data',
    useForFallback: true, // Use as fallback data source
  }
};