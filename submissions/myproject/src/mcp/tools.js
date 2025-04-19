import { z } from 'zod';
import config from '../config.js';
import logger from '../utils/logger.js';
import twitterClient from '../twitter-client.js';

/**
 * Register MCP tools with the server
 * @param {McpServer} server - MCP server instance
 */
export function registerTools(server) {
  // Tool to enrich a trend with Twitter context
  server.tool(
    "enrich_trend",
    {
      term: z.string().describe("The trend term to enrich")
    },
    async ({ term }) => {
      try {
        logger.info(`Enriching context for trend: ${term}`);
        
        // Search for recent tweets about this term
        const tweets = await twitterClient.scraper.searchTweets(term, 10);
        
        if (!tweets || tweets.length === 0) {
          return {
            content: [{ 
              type: "text", 
              text: `No recent tweets found for trend: ${term}` 
            }]
          };
        }
        
        // Analyze tweets to extract relevant information
        const tweetTexts = tweets.map(t => t.full_text || t.text);
        const usernames = [...new Set(tweets.map(t => t.user.screen_name))].slice(0, 5);
        
        // Count associated hashtags
        const hashtagCounts = new Map();
        for (const tweet of tweets) {
          const hashtags = tweet.entities?.hashtags || [];
          for (const tag of hashtags) {
            const hashtagText = tag.text || tag;
            if (hashtagText.toLowerCase() !== term.toLowerCase().replace('#', '')) {
              hashtagCounts.set(
                hashtagText, 
                (hashtagCounts.get(hashtagText) || 0) + 1
              );
            }
          }
        }
        
        // Sort and take top 5 most frequent hashtags
        const topHashtags = [...hashtagCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([tag]) => `#${tag}`);
        
        // Build enriched report
        let contextReport = `📊 Context for trend ${term}:\n\n`;
        contextReport += `🔹 ${tweets.length} recent tweets analyzed\n`;
        contextReport += `🔹 Active accounts: ${usernames.map(u => '@' + u).join(', ')}\n`;
        
        if (topHashtags.length > 0) {
          contextReport += `🔹 Associated hashtags: ${topHashtags.join(', ')}\n`;
        }
        
        // Include some tweet excerpts
        contextReport += '\n📱 Tweet excerpts:\n';
        for (let i = 0; i < Math.min(3, tweetTexts.length); i++) {
          const shortText = tweetTexts[i].substring(0, 100) + (tweetTexts[i].length > 100 ? '...' : '');
          contextReport += `- "${shortText}"\n`;
        }
        
        return {
          content: [{ type: "text", text: contextReport }]
        };
      } catch (error) {
        logger.error(`Error enriching trend: ${error.message}`);
        return {
          content: [{ 
            type: "text", 
            text: `Error enriching trend: ${error.message}` 
          }],
          isError: true
        };
      }
    }
  );

  // Tool to get Twitter global trends
  server.tool(
    "global_trends",
    {},
    async () => {
      try {
        const globalTrends = await twitterClient.getGlobalTrends();
        
        if (!globalTrends || globalTrends.length === 0) {
          return {
            content: [{ 
              type: "text", 
              text: "No global trends currently found." 
            }]
          };
        }
        
        // Format trends
        const trendsReport = globalTrends
          .slice(0, 10)
          .map((trend, index) => `${index + 1}. ${trend.name}`)
          .join('\n');
        
        return {
          content: [{ 
            type: "text", 
            text: `📈 Top 10 global Twitter trends:\n\n${trendsReport}` 
          }]
        };
      } catch (error) {
        logger.error(`Error retrieving global trends: ${error.message}`);
        return {
          content: [{ 
            type: "text", 
            text: `Error retrieving global trends: ${error.message}` 
          }],
          isError: true
        };
      }
    }
  );
}