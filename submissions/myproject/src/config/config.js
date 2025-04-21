import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: join(__dirname, '../../', '.env') });

// Determine if we're in production mode
const isProduction = process.env.NODE_ENV === 'production';

// Get current date for dynamic configuration
const now = new Date();
const currentMonth = now.getMonth(); // 0-11
const currentYear = now.getFullYear();

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
  
  // Add time-relevant hashtags based on current month
  const seasonalHashtags = [];
  
  // Spring (March-May)
  if (currentMonth >= 2 && currentMonth <= 4) {
    seasonalHashtags.push('#Spring', '#SpringTrends');
  }
  // Summer (June-August) 
  else if (currentMonth >= 5 && currentMonth <= 7) {
    seasonalHashtags.push('#Summer', '#SummerTrends');
  }
  // Fall (September-November)
  else if (currentMonth >= 8 && currentMonth <= 10) {
    seasonalHashtags.push('#Fall', '#AutumnTrends');
  }
  // Winter (December-February)
  else {
    seasonalHashtags.push('#Winter', '#WinterTrends');
  }
  
  // Add current year hashtag
  seasonalHashtags.push(`#Trends${currentYear}`);
  
  // Add some seasonal hashtags to the mix
  initialHashtags = [...initialHashtags, ...seasonalHashtags.slice(0, 2)];
  
  // Limit to a maximum of 10 starting hashtags to avoid API limits
  return initialHashtags.slice(0, 10);
}

// Exported configuration
export default {
  // Agent behavior configuration
  agent: {
    name: 'TrendSnipper',
    version: '2.1.0',
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
    
    // Enhanced parameters for tweet collection
    maxTweetsPerSource: parseInt(process.env.MAX_TWEETS_PER_SOURCE || '30'),
    maxTweetAgeInHours: parseInt(process.env.MAX_TWEET_AGE_HOURS || '24'), // Only consider tweets from the last 24 hours
    resultsPerQuery: parseInt(process.env.RESULTS_PER_QUERY || '30'),
    includeReplies: process.env.INCLUDE_REPLIES === 'true' || false,
    minRetweetsFilter: parseInt(process.env.MIN_RETWEETS_FILTER || '5'), // Minimum retweets for a tweet to be considered
    minLikesFilter: parseInt(process.env.MIN_LIKES_FILTER || '10'),   // Minimum likes for a tweet to be considered
    
    // Agent autonomy configuration
    autonomy: {
      enabled: true,
      maxHashtagsToMonitor: parseInt(process.env.MAX_HASHTAGS || '20'),
      maxAccountsToMonitor: parseInt(process.env.MAX_ACCOUNTS || '15'),
      initialExploration: true, // Start with proactive exploration even with no data
      adaptiveCollection: true, // Adjust strategy based on results
      minimumHashtags: parseInt(process.env.MIN_HASHTAGS || '5'),
      minimumAccounts: parseInt(process.env.MIN_ACCOUNTS || '3'),
      selfRegulation: true,
      emergencyDiscoveryThreshold: 2 // Number of failed cycles before emergency discovery
    },
    
    // Accounts to monitor (will be discovered dynamically)
    accounts: [],
    
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
    growthThreshold: parseInt(process.env.TREND_GROWTH_THRESHOLD || '20'),
    
    // Maximum age of tweets to analyze
    maxTweetAgeInHours: parseInt(process.env.MAX_TWEET_AGE_HOURS || '24'),
    
    // Terms to exclude from analysis (stopwords also excluded)
    excludedTerms: [
      'RT', 'http', 'https', 'amp', 't.co',
      'the', 'and', 'for', 'with', 'this', 'that', 'from', 'have', 'has', 'not',
      'what', 'when', 'where', 'which', 'who', 'whom', 'whose', 'why', 'how',
      'com', 'org', 'net', 'www'
    ],
    
    // Max number of previous trend histories to keep (for comparison)
    trendHistorySize: parseInt(process.env.TREND_HISTORY_SIZE || '10'),
    
    // Enhanced analysis configuration
    enhancedAnalysis: {
      enabled: process.env.ENHANCED_ANALYSIS === 'true' || true,
      sentimentAnalysis: process.env.SENTIMENT_ANALYSIS === 'true' || true,
      categorizeTopics: process.env.CATEGORIZE_TOPICS === 'true' || true
    },
    
    // Autonomous fallback modes in case of failure
    autonomousFallback: {
      enabled: process.env.ENABLE_FALLBACK_MODE === 'true' || true,
      generateSyntheticTrends: process.env.GENERATE_SYNTHETIC_TRENDS === 'true' || true,
      useExternalDataSources: true,
      maxSyntheticTrendsPerDay: parseInt(process.env.MAX_SYNTHETIC_TRENDS_PER_DAY || '10')
    }
  },
  
  reporting: {
    // Enhanced report configuration
    enhancedReports: process.env.ENHANCED_REPORTS === 'true' || true,
    includeCategories: process.env.INCLUDE_CATEGORIES === 'true' || true,
    maxTrendsInReport: parseInt(process.env.MAX_TRENDS_IN_REPORT || '5'),
    maxTrendAgeInHours: parseInt(process.env.MAX_TREND_AGE_HOURS || '24'),
    
    // Autonomous trend publishing
    autonomousPublishing: {
      enabled: process.env.ENABLE_AUTO_PUBLISHING === 'true' || true,
      minTrendsForPublication: parseInt(process.env.MIN_TRENDS_FOR_PUBLICATION || '3'),
      maxPublicationsPerDay: parseInt(process.env.MAX_PUBLICATIONS_PER_DAY || '4'),
    },
    
    // Formatting options
    format: {
      includeTimestamp: process.env.INCLUDE_TIMESTAMP === 'true' || true,
      includeEmojis: process.env.INCLUDE_EMOJIS === 'true' || true,
      hashtagSignature: process.env.HASHTAG_SIGNATURE === 'true' || true
    }
  },
  
  scheduler: {
    // Cron expression for periodic execution (default: every 4 hours)
    cronSchedule: process.env.CRON_SCHEDULE || '0 */4 * * *',
    
    // Cron for discovery of new topics/accounts (default: once per day)
    discoveryCronSchedule: process.env.DISCOVERY_CRON_SCHEDULE || '0 */12 * * *',
    
    // Dynamic scheduler configuration
    dynamic: {
      enabled: process.env.ENABLE_DYNAMIC_SCHEDULING === 'true' || true,
      minInterval: process.env.MIN_SCHEDULE_INTERVAL || '0 */1 * * *', // Minimum every 1 hour
      defaultInterval: process.env.DEFAULT_SCHEDULE_INTERVAL || '0 */2 * * *', // Default every 2 hours
      maxInterval: process.env.MAX_SCHEDULE_INTERVAL || '0 */4 * * *', // Maximum every 4 hours
      adaptBasedOn: 'activity', // 'activity' or 'results'
      
      // Parameters for determining activity level
      activityThresholds: {
        highActivityMinTweets: parseInt(process.env.HIGH_ACTIVITY_TWEETS || '200'),
        lowActivityMaxTweets: parseInt(process.env.LOW_ACTIVITY_TWEETS || '50')
      }
    }
  },
  
  mcp: {
    // MCP server configuration
    server: {
      name: 'TrendSnipperMCP',
      version: '1.0.0',
      port: parseInt(process.env.MCP_PORT || '3000'),
      host: process.env.MCP_SERVER_HOST || 'localhost',
      enabled: process.env.MCP_SERVER_ENABLED === 'true' || true
    },
    
    // MCP client configuration
    client: {
      // External MCP servers to connect
      externalServers: [
        // Example external server:
        {
         id: "brave-search",
         command: "npm",
         args: ["run", "brave-search-mcp"]
        },
        {
         id: "weather",
         command: "npm",
         args: ["run", "weather-mcp"]
        }
      ]
    }
  },
  
  // Masa protocol activation for fallback trends
  masa: {
    enabled: process.env.ENABLE_MASA_PROTOCOL === 'true' || false,
    serverUrl: process.env.MASA_ENDPOINT || 'http://localhost:8080/api/v1/data',
    useForFallback: process.env.MASA_USE_FOR_FALLBACK === 'true' || true,
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/trendsnipper.log',
    console: true,
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '5'),
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    detailedLogging: process.env.ENABLE_DETAILED_LOGGING === 'true' || true,
    logStats: process.env.LOG_STATS === 'true' || true
  }
};