import sys
sys.stdout.reconfigure(encoding='utf-8')
import asyncio
import aiohttp
from mcp.server.fastmcp import FastMCP
from datetime import datetime
from dotenv import load_dotenv
import os
import json

load_dotenv()
MASA_BASE_URL = "https://data.dev.masalabs.ai"
MASA_API_KEY = os.getenv("MASA_API_KEY")

mcp = FastMCP("DeFiGuardian")

async def masa_api(endpoint: str, payload: dict) -> dict:
    headers = {"Authorization": f"Bearer {MASA_API_KEY}", "Content-Type": "application/json"}
    async with aiohttp.ClientSession() as session:
        async with session.post(f"{MASA_BASE_URL}{endpoint}", json=payload, headers=headers) as resp:
            return await resp.json()

@mcp.tool()
async def get_token_metrics(symbol: str) -> dict:
    """Get real-time price, volume, and social metrics for a token"""
    # Get price data
    price_data = await masa_api("/api/v1/search/live/web/scrape", {
        "url": f"https://api.coingecko.com/api/v3/simple/price?ids={symbol}&vs_currencies=usd",
        "format": "json"
    })
    
    # Get social sentiment
    tweet_job = await masa_api("/api/v1/search/live/twitter", {
        "query": f"#{symbol}",
        "max_results": 50
    })
    tweets = await masa_api(f"/api/v1/search/live/twitter/result/{tweet_job['uuid']}", {})
    
    analysis = await masa_api("/api/v1/search/analysis", {
        "tweets": "\n".join([t["text"] for t in tweets["results"]]),
        "prompt": "Calculate sentiment score between -1 (negative) and 1 (positive)"
    })
    
    return {
        "symbol": symbol,
        "price": price_data.get(symbol, {}).get("usd", 0),
        "sentiment": float(analysis["result"]),
        "volume": price_data.get(symbol, {}).get("usd_24h_vol", 0)
    }

@mcp.tool()
async def find_liquidity_pools(min_apr: float = 0.2) -> list:
    """Discover high-yield liquidity pools across DEXs"""
    dex_pages = [
        "https://defillama.com/yields",
        "https://app.uniswap.org/pools"
    ]
    
    pools = []
    for url in dex_pages:
        data = await masa_api("/api/v1/search/live/web/scrape", {
            "url": url,
            "format": "text"
        })
        # Extract pool data from scraped content
        pools.extend(parse_pools(data["content"]))  # Custom parsing logic
    
    return [p for p in pools if p["apr"] >= min_apr][:10]

@mcp.tool()
async def assess_portfolio_risk(portfolio: dict) -> dict:
    """Analyze portfolio risk using volatility and correlation"""
    symbols = list(portfolio.keys())
    metrics = await asyncio.gather(*[get_token_metrics(s) for s in symbols])
    
    # Simple risk calculation (replace with modern portfolio theory)
    total_value = sum(v["amount"] * m["price"] for v, m in zip(portfolio.values(), metrics))
    risk_score = sum(
        (v["amount"] * m["price"] / total_value) * (1 - m["sentiment"]) 
        for v, m in zip(portfolio.values(), metrics)
    )
    
    return {
        "risk_score": risk_score,
        "diversification": len(symbols),
        "correlation": calculate_correlation([m["price"] for m in metrics])
    }

def calculate_correlation(prices: list) -> float:
    # Simplified correlation calculation
    returns = [(p[i+1] - p[i])/p[i] for i in range(len(p)-1)]
    return sum(abs(r) for r in returns)/len(returns)

if __name__ == "__main__":
    mcp.run()