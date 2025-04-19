import { z } from 'zod';
import logger from '../utils/logger.js';
import twitterClient from '../twitter-client/client.js';

// Register MCP tools with the server
// server - MCP server instance
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
  
  // Tool to analyze a trend's growth pattern
  server.tool(
    "analyze_trend_growth",
    {
      term: z.string().describe("The trend term to analyze"),
      days: z.number().optional().describe("Number of days to analyze (default: 7)")
    },
    async ({ term, days = 7 }) => {
      try {
        logger.info(`Analyzing growth pattern for trend: ${term} over ${days} days`);
        
        // In a real implementation, you would retrieve historical data
        // For this example, we generate synthetic data
        const growthData = generateSyntheticGrowthData(term, days);
        
        let analysisReport = `📊 Growth Analysis for "${term}" over ${days} days:\n\n`;
        
        // Add key metrics
        const totalMentions = growthData.reduce((sum, day) => sum + day.count, 0);
        const averageMentions = totalMentions / days;
        const growthRate = ((growthData[days-1].count - growthData[0].count) / growthData[0].count) * 100;
        
        analysisReport += `🔹 Total mentions: ${totalMentions}\n`;
        analysisReport += `🔹 Average daily mentions: ${averageMentions.toFixed(1)}\n`;
        analysisReport += `🔹 Overall growth rate: ${growthRate.toFixed(1)}%\n`;
        
        // Determine trend status
        if (growthRate > 50) {
          analysisReport += `🔹 Status: 🚀 Rapidly Growing\n`;
        } else if (growthRate > 10) {
          analysisReport += `🔹 Status: 📈 Growing Steadily\n`;
        } else if (growthRate > -10) {
          analysisReport += `🔹 Status: ↔️ Stable\n`;
        } else {
          analysisReport += `🔹 Status: 📉 Declining\n`;
        }
        
        // Add daily data
        analysisReport += "\nDaily Trend Data:\n";
        growthData.forEach(day => {
          analysisReport += `- ${day.date}: ${day.count} mentions\n`;
        });
        
        return {
          content: [{ type: "text", text: analysisReport }]
        };
      } catch (error) {
        logger.error(`Error analyzing trend growth: ${error.message}`);
        return {
          content: [{ 
            type: "text", 
            text: `Error analyzing trend growth: ${error.message}` 
          }],
          isError: true
        };
      }
    }
  );
  
  // Tool to publish a custom tweet
  server.tool(
    "publish_tweet",
    {
      content: z.string().max(280).describe("Tweet content (max 280 characters)")
    },
    async ({ content }) => {
      try {
        logger.info(`Publishing custom tweet: ${content}`);
        
        // Verify authentication
        if (!twitterClient.isAuthenticated) {
          await twitterClient.authenticate();
        }
        
        // Publish the tweet
        const result = await twitterClient.scraper.sendTweet(content);
        
        if (result && result.id) {
          return {
            content: [{ 
              type: "text", 
              text: `Tweet published successfully! Tweet ID: ${result.id}` 
            }]
          };
        } else {
          return {
            content: [{ 
              type: "text", 
              text: "Tweet was processed but no confirmation was received." 
            }]
          };
        }
      } catch (error) {
        logger.error(`Error publishing tweet: ${error.message}`);
        return {
          content: [{ 
            type: "text", 
            text: `Error publishing tweet: ${error.message}` 
          }],
          isError: true
        };
      }
    }
  );
  
  // Helper function to generate synthetic growth data
  function generateSyntheticGrowthData(term, days) {
    const growthData = [];
    const now = new Date();
    let baseCount = Math.floor(Math.random() * 50) + 10; // Initial value between 10 and 60
    
    // Determine growth pattern (rising, falling, stable, etc.)
    const growthPattern = Math.random();
    let growthFactor;
    
    if (growthPattern < 0.6) {
      // Rising trend (60% of cases)
      growthFactor = Math.random() * 0.3 + 1.1; // Between 1.1 and 1.4 per day
    } else if (growthPattern < 0.8) {
      // Stable trend (20% of cases)
      growthFactor = Math.random() * 0.2 + 0.9; // Between 0.9 and 1.1 per day
    } else {
      // Falling trend (20% of cases)
      growthFactor = Math.random() * 0.2 + 0.7; // Between 0.7 and 0.9 per day
    }
    
    // Generate data for each day
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Add some daily variation
      const dailyVariation = Math.random() * 0.4 - 0.2; // Between -0.2 and +0.2
      const adjustedGrowthFactor = growthFactor + dailyVariation;
      
      // Calculate count for this day
      if (i < days - 1) {
        baseCount = Math.floor(baseCount * adjustedGrowthFactor);
      }
      
      // Ensure count doesn't become negative
      const count = Math.max(1, baseCount);
      
      growthData.push({
        date: date.toISOString().split('T')[0], // Format YYYY-MM-DD
        count
      });
    }
    
    return growthData;
  }
}