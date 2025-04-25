from typing import Dict, List, Any
import httpx
from mcp.server.fastmcp import FastMCP, Context
import asyncio


# TokenMetrics API configuration
TOKEN_METRICS_API_BASE = "https://api.tokenmetrics.com/v2"

async def fetch_token_metrics() -> Dict[str, Any]:
    """Make a request to the TokenMetrics API to fetch token information"""
    url = f"{TOKEN_METRICS_API_BASE}/tokens"
    params = {"limit": 1000}
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            return {"error": f"HTTP error occurred: {str(e)}"}
        except Exception as e:
            return {"error": f"An error occurred: {str(e)}"}
        
if __name__ == "__main__":
    result = asyncio.run(fetch_token_metrics())
    print(result)