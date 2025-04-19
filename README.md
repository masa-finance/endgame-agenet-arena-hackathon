# TrendSnipper - Twitter Micro-Trends Detector

TrendSnipper is a non-conversational AI agent that automatically detects emerging micro-trends on Twitter before they go viral. Developed for the Subnet 59 Agent Arena Hackathon, this agent leverages the Model Context Protocol (MCP) to enrich detected trends with relevant context.

## 🎯 Key Features

- **Emerging Trend Detection**: Identifies rapidly growing terms, hashtags, and topics before they become mainstream
- **Automated Analysis**: Regularly collects and analyzes tweets from configured sources
- **Automatic Publishing**: Shares micro-trend insights directly on Twitter
- **MCP Enrichment**: Adds context to detected trends through the Model Context Protocol

## 🚀 User Value Proposition

- **For Content Creators**: Identify emerging topics to create relevant content ahead of the competition
- **For Marketers**: Gain valuable insights to optimize campaigns in real-time
- **For Trend Analysts**: Access objective data on the evolution of online conversations
- **For Businesses**: Track emerging discussions in your industry

## 🧠 How the Agent Works

1. **Data Collection**: The agent collects tweets from configured hashtags and influential accounts
2. **Trend Analysis**: An algorithm identifies terms with significantly increasing frequency
3. **Contextual Enrichment**: The MCP server adds context to detected trends
4. **Insight Publication**: Discovered micro-trends are automatically published on Twitter

## 💻 Technical Architecture

- **TwitterClient**: Interface with Twitter API via agent-twitter-client
- **TrendDetector**: Module for tweet analysis and micro-trend detection
- **MCP Server**: Model Context Protocol server for trend enrichment
- **Scheduler**: Scheduling of analyses at regular intervals

## 📋 Prerequisites

- Node.js v16+
- Twitter account with authentication
- Twitter API keys (for certain features)

## ⚙️ Installation and Setup

1. Clone this repository:
```bash
git clone https://github.com/Naesmal/endgame-agenet-arena-hackathon.git
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

The agent's behavior can be customized by modifying the `src/config.js` file:

- **Sources**: Hashtags and accounts to monitor
- **Analysis**: Parameters for trend detection
- **Scheduling**: Analysis frequency
- **MCP**: MCP server configuration

## 🔌 MCP (Model Context Protocol) Integration

TrendSnipper exposes the following functionalities through its MCP server:

### MCP Tools

- **enrich_trend**: Enriches a trend with Twitter context
- **global_trends**: Retrieves official Twitter global trends

### MCP Resources

- **tendances://latest**: Access to the latest detected micro-trends

## 🤝 Subnet 59 Compatibility

TrendSnipper has been specifically designed for the Subnet 59 Agent Arena:

- **Non-Conversational Agent**: Focused on utility actions rather than conversation
- **MCP Integration**: Leverages the Model Context Protocol for contextual enrichment
- **Real Value for Users**: Detection of weak signals and sharing of valuable insights

## 📜 License

MIT

## 🙏 Acknowledgements

- Model Context Protocol for the contextual extension architecture
- Subnet 59 Agent Arena Hackathon for the inspiration