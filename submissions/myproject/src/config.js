import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
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
  sources: {
    // Hashtags to monitor
    hashtags: ['#AI', '#MachineLearning', '#Web3', '#Blockchain', '#NFT', '#Crypto'],
    // Influential accounts to follow (usernames)
    accounts: ['elonmusk', 'naval', 'vitalikbuterin', 'balajis', 'punk6529'],
    // Maximum number of tweets to collect per cycle
    maxTweetsPerSource: 100
  },
  analysis: {
    // Minimum occurrences to consider a term as a trend
    minOccurrences: 3,
    // Growth threshold to consider a trend as emerging (%)
    growthThreshold: 50,
    // Words to exclude from analysis (stopwords will also be included)
    excludedTerms: ['RT', 'http', 'https', 'amp', 't.co']
  },
  scheduler: {
    // Cron format for scheduling executions (here: every 4 hours)
    cronSchedule: '0 */4 * * *'
  },
  mcp: {
    // MCP server configuration
    server: {
      name: 'TrendSnipperMCP',
      version: '1.0.0'
    },
    transport: {
      port: parseInt(process.env.MCP_PORT || '3000')
    }
  }
};