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
  sources: {
    // Hashtags to monitor
    hashtags: ['#AI', '#MachineLearning', '#Web3', '#Blockchain', '#NFT', '#Crypto'],
    // Influential accounts to follow (usernames)
    accounts: ['elonmusk', 'naval', 'vitalikbuterin', 'balajis', 'punk6529'],
    // Maximum number of tweets to collect per cycle
    maxTweetsPerSource: 100
  },
  analysis: {
    // Minimum number of times a term must appear to be considered a trend
    minOccurrences: 3,
    // Growth percentage threshold to detect an emerging trend
    growthThreshold: 50,
    // Terms to exclude from analysis (stopwords will also be excluded)
    excludedTerms: ['RT', 'http', 'https', 'amp', 't.co']
  },
  scheduler: {
    // Cron expression for periodic execution (every 4 hours)
    cronSchedule: '0 */4 * * *'
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
  }
};
