# TrendSnipper - Autonomous Twitter Micro-Trends Detection Agent

TrendSnipper is a fully autonomous AI agent that automatically detects emerging micro-trends on Twitter before they go viral. Developed for the Subnet 59 Agent Arena Hackathon, this agent functions as both a Model Context Protocol (MCP) server and client, enriching trends with relevant context from multiple sources.

## 🎯 Key Features

- **Emerging Trend Detection**: Identifies rapidly growing terms, hashtags, and topics before they become mainstream
- **Complete Autonomy**: Operates without human supervision and adapts to changing conditions
- **AI Fallback Mechanisms**: Generates synthetic trends when data is insufficient
- **Automated Publishing**: Shares micro-trend insights directly on Twitter
- **Dynamic Scheduling**: Adjusts analysis frequency based on trend activity
- **Dual MCP Functionality**:
  - **Server Mode**: Exposes trend data and tools to other MCP clients
  - **Client Mode**: Consumes tools and resources from external MCP servers for enhanced analysis
- **Trend Growth Analysis**: Analyzes growth patterns of emerging trends
- **Masa Protocol Integration**: Connects to scraping endpoints for complementary data

## 🤖 Agent Autonomy

TrendSnipper is designed to be completely self-sufficient and resilient to challenges:

- **Self-discovery**: Dynamically finds new hashtags and accounts without human intervention
- **AI Trend Generation**: Produces synthetic trends when traditional sources are insufficient
- **Dynamic Adjustment**: Modifies its behavior based on obtained results
- **Multiple Fallback Strategies**: Uses several approaches to maintain operation even without data
- **Emergency Discovery**: Automatically triggers discovery cycles if sources diminish
- **Proactive Monitoring**: Monitors its own state and takes corrective measures when needed

## 🚀 User Value Proposition

- **For Content Creators**: Identify emerging topics to create relevant content ahead of competition
- **For Marketers**: Gain valuable insights to optimize campaigns in real-time
- **For Trend Analysts**: Access objective data on the evolution of online conversations
- **For Businesses**: Track emerging discussions in your industry
- **For Researchers**: Observe social trends with continuously updated data

## 🧠 How the Agent Works

1. **Data Collection**: The agent collects tweets from configured or self-discovered hashtags and influential accounts
2. **Trend Analysis**: An algorithm identifies terms with significantly increasing frequency
3. **Contextual Enrichment**: Internal and external MCP services add context to detected trends
4. **Insight Publication**: Discovered micro-trends are automatically published on Twitter
5. **Autonomous Adaptation**: The agent dynamically adjusts its parameters based on results

## 💻 Technical Architecture

- **TwitterClient**: Interface with Twitter API via agent-twitter-client with cookie persistence
- **TrendDetector**: Module for tweet analysis and micro-trend detection with AI-powered fallback
- **MCP Server**: Model Context Protocol server for trend enrichment
- **MCP Client**: Connects to external MCP servers for additional context and capabilities
- **Autonomous Manager**: Manages the agent's self-sufficient operation and adaptive scheduling
- **Masa Protocol Client**: Additional data source for resilient operation

## 📋 Prerequisites

- Node.js v16+
- Twitter account with authentication
- Twitter API keys (optional but recommended)
- OpenAI API key (recommended for enhanced autonomy)

## ⚙️ Installation and Setup

1. Clone this repository:
```bash
git clone https://github.com/Naesmal/trendsnipper.git
cd trendsnipper
```

2. Install dependencies:
```bash
npm install
```

3. Copy the example environment file and configure it:
```bash
cp .env.example .env
# Edit the .env file with your information
```

4. Start the agent:
```bash
npm start
```

## 🔧 Configuration

The agent's behavior can be customized by modifying the `src/config.js` file or through environment variables:

- **Sources**: Initial hashtags and accounts to monitor (will be autonomously expanded)
- **Analysis**: Parameters for trend detection
- **Autonomy**: Controls for self-discovery and adaptive behavior
- **Scheduling**: Dynamic analysis frequency
- **MCP Server**: MCP server configuration
- **MCP Client**: External MCP servers to connect to
- **Fallback Mode**: Controls for synthetic trend generation

## 🔌 MCP (Model Context Protocol) Integration

### MCP Server Features

TrendSnipper exposes the following functionalities through its MCP server:

#### MCP Tools

- **enrich_trend**: Enriches a trend with Twitter context
- **global_trends**: Retrieves official Twitter global trends
- **analyze_trend_growth**: Analyzes the growth pattern of a trend over time
- **publish_tweet**: Allows publishing custom tweets

#### MCP Resources

- **trends://latest**: Access to the latest detected micro-trends
- **trends://history/{date}**: Access to historical trend data

#### MCP Prompts

- **analyze-trend**: Prompt for in-depth trend analysis

### MCP Client Features

TrendSnipper can connect to and utilize these external MCP servers:

- **Weather servers**: For correlating weather with trend patterns
- **News servers**: For finding relevant news about emerging trends
- **Search servers**: For broader context about trends
- **Any custom MCP server**: Extensible architecture for adding new capabilities

## 📈 Advanced Autonomous Features

- **Synthetic Trend Generation**: Creates AI-powered predictions when real data is unavailable
- **Adaptive Scheduling**: Increases checks during high activity, decreases during low activity
- **Self-healing**: Repairs its monitoring capabilities when sources diminish
- **Multi-source Fallback**: Uses Twitter API, global trends, and Masa Protocol as layered data sources
- **Continuous Learning**: Improves topic selection based on previous trend detection success

## 📝 MCP Client Usage

Adding external MCP servers is straightforward:

1. Configure in `config.js`:
```javascript
mcp: {
  client: {
    externalServers: [
      {
        id: "weather",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-weather"]
      }
    ]
  }
}
```

2. Or use the programmatic API:
```javascript
import mcpManager from './utils/mcp-manager.js';

await mcpManager.addServer({
  id: "brave-search",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-brave-search"]
});
```

## 🤝 Subnet 59 Compatibility

TrendSnipper has been specifically designed for the Subnet 59 Agent Arena:

- **Non-Conversational Agent**: Focused on utility actions rather than conversation
- **Full Autonomy**: Operates independently without need for human guidance
- **MCP Integration**: Leverages the Model Context Protocol for contextual enrichment, both as a server and client
- **Real Value for Users**: Detection of weak signals and sharing of valuable insights

## 📜 License

MIT

## 🙏 Acknowledgements

- Model Context Protocol for the contextual extension architecture
- Subnet 59 Agent Arena Hackathon for the inspiration