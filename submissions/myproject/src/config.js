import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger les variables d'environnement
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
    // Hashtags à surveiller
    hashtags: ['#AI', '#MachineLearning', '#Web3', '#Blockchain', '#NFT', '#Crypto'],
    // Comptes influents à suivre (usernames)
    accounts: ['elonmusk', 'naval', 'vitalikbuterin', 'balajis', 'punk6529'],
    // Nombre maximum de tweets à collecter par cycle
    maxTweetsPerSource: 100
  },
  analysis: {
    // Nombre minimum d'occurrences pour considérer un terme comme tendance
    minOccurrences: 3,
    // Seuil de croissance pour considérer une tendance comme émergente (%)
    growthThreshold: 50,
    // Mots à exclure de l'analyse (stopwords seront aussi inclus)
    excludedTerms: ['RT', 'http', 'https', 'amp', 't.co']
  },
  scheduler: {
    // Format cron pour planifier les exécutions (ici: toutes les 4 heures)
    cronSchedule: '0 */4 * * *'
  },
  mcp: {
    // Configuration du serveur MCP
    server: {
      name: 'TrendSnipperMCP',
      version: '1.0.0'
    },
    transport: {
      port: parseInt(process.env.MCP_PORT || '3000')
    }
  }
};