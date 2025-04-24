## Model Context Protocol Specification

## Project Overview

Crypto-Whisperer is a Model Context Protocol (MCP) plugin that incorporates several systems including
Masa's Subnet 42 that enables natural language cryptocurrency analytics and trading. The protocol 
establishes a standardized communication framework between Claude Desktop and multiple specialized 
data and trading services. 

The architecture follows a hub-and-spoke model where Claude Desktop acts as the central hub, connecting 
to multiple MCP servers that each provide specific functionality. This design abstracts the complexity of 
integrating multiple APIs and data sources behind a unified natural language interface, enabling non-technical 
users to access sophisticated trading tools and real-time cryptocurrency data.

The protocol is built on three core principles:
1. **Simplification through natural language** - Converting complex technical queries into conversational interactions
2. **Real-time data access** - Leveraging Subnet 42's decentralized data pipelines for up-to-date intelligence
3. **Modular extensibility** - Enabling easy addition of new data sources and services through standardized interfaces

## Core Components

### 1. Claude Desktop Interface
The primary user-facing component that interprets natural language requests, routes them to appropriate MCP servers, and presents responses in an intuitive format.

### 2. MCP Servers
Specialized middleware components that translate natural language requests into API-specific calls:
   - **Masa MCP Server**: Interfaces with Masa Realtime Data API (Subnet 42) to provide sentiment analysis and market trend data.
   - **TokenMetrics MCP Server**: Connects to TokenMetrics API to deliver trading signals and cryptocurrency insights.
   - **BinanceUS MCP Server**: Facilitates trading operations through the BinanceUS exchange API.

### 3. API Integrations
Backend connections to data and service providers:
   - **Masa Realtime Data API**: Provides decentralized, real-time sentiment analysis and market data through Subnet 42 on Bittensor.
   - **TokenMetrics API**: Delivers algorithmic trading signals and cryptocurrency performance metrics.
   - **BinanceUS API**: Executes cryptocurrency trading operations.

## Interfaces

### 1. Natural Language Interface for End User
- **Input**: Conversational queries from users (e.g., "What's the current sentiment around Ethereum?" or "Buy 0.5 BTC")
- **Output**: Formatted responses with relevant data, visualizations, or confirmation of actions
- **Supported Commands**:
  - Sentiment analysis requests
  - Trading signal queries
  - Market trend analysis
  - Trading operations (buy/sell)

### 2. API Integration Interface for MCP Clients
Alternative interface for developers to interact with the MCP servers programmatically. 
Each MCP Server implements a specific adapter for its corresponding API, handling:
- Authentication
- Request formatting
- Response parsing
- Error handling

## Data Flow

- User submits natural language request to Claude Desktop
- Claude parses the intent and choose the appropriate MCP server based on the request type (information or action)
- Claude formats the request into the standardized JSON structure and forwards it to the selected MCP server
- MCP server processes the request, interacts with the relevant API, and returns the response to Claude
- Claude formats the response for user-friendly presentation and displays it to the user
- User can request Claude to use the information collected to perform an analysis or execute a trade

## Context Management System
The Claude Desktop App maintains user session state, trading history, and preferences across interactions to 
provide personalized experiences. The session can be created as an artifact for future reference.

## Integration Guidelines

### 1. Adding New Data Sources

To integrate a new data source with Crypto-Whisperer:

1. Implement a new MCP Server that adheres to the MCP Server Interface specification
2. Develop an API adapter for the new data source
3. Register the new MCP Server with Claude Desktop
4. Define natural language patterns that should route to the new server using prompts (nice to have)
5. Test integration with sample queries

### 2. Security Requirements

All integrations should implement:
- End-to-end encryption for all communications to external services
- API key management with secure storage
- Rate limiting to prevent abuse
- Audit logging for security events

### 3. Performance Guidelines

To ensure optimal performance:
- Responses should be returned within reasonable time limits
- Implement caching for frequently accessed data (nice to have)
- Use connection pooling for API interactions
- Implement retry logic with exponential backoff and limited retries
- Provide status updates for long-running operations (nice to have)

### 4. Testing and Validation

All integrations should include:
- Comprehensive unit tests for MCP Server
- Integration tests with mock API responses
- Performance benchmarks
- Security vulnerability scanning
- Natural language parsing validation

### 5. Documentation Requirements

New integrations must provide:
- API specifications and endpoints
- Authentication requirements
- Sample requests and responses
- Error handling documentation
- Rate limit information