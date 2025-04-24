# masa_mcp_server.py
import asyncio
from typing import Dict, Optional, Any

import httpx
from mcp.server.fastmcp import FastMCP, Context

from config import get_masa_api_key
from masa_util import get_sentiment_for_token

# Initialize our MCP server
mcp = FastMCP("Masa Data API")

# Masa API configuration
MASA_API_BASE = "https://data.dev.masalabs.ai/api"

API_KEY = get_masa_api_key()

# Utility function to make authenticated API requests
async def masa_api_request(
    method: str,
    endpoint: str,
    data: Optional[Dict] = None,
    params: Optional[Dict] = None
) -> Dict:
    """Make an authenticated request to the Masa API"""
    url = f"{MASA_API_BASE}{endpoint}"
    
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient(verify=False) as client:
        if method.lower() == "get":
            response = await client.get(url, headers=headers, params=params)
        elif method.lower() == "post":
            response = await client.post(url, headers=headers, json=data)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")
        
        if response.status_code >= 400:
            return {"error": f"API request failed with status {response.status_code}: {response.text}"}
        
        return response.json()

# ===== TOOLS =====

@mcp.tool()
async def submit_twitter_search(query: str, max_results: int = 100) -> Dict[str, str]:
    """
    Submit a Twitter search job to the Masa Data API.
    
    Args:
        query: The search query with Twitter search syntax (e.g., "#AI trending")
        max_results: Maximum number of results to return (up to 100)
    
    Returns:
        A dictionary containing the job UUID and any error messages
    """
    data = {
        "query": query,
        "max_results": max_results
    }
    
    result = await masa_api_request("post", "/v1/search/live/twitter", data=data)
    
    if "error" in result and result["error"]:
        return {"status": "error", "message": result["error"]}
    
    return {
        "status": "success", 
        "job_uuid": result.get("uuid", ""),
        "message": "Search job submitted successfully! Use check_search_status to monitor progress."
    }

@mcp.tool()
async def check_search_status(job_uuid: str) -> Dict[str, str]:
    """
    Check the status of a previously submitted Twitter search job.
    
    Args:
        job_uuid: The UUID of the search job to check
    
    Returns:
        A dictionary containing the job status and any error messages
    """
    
    # add a sleep here
    await asyncio.sleep(20)
    print('done sleeping')
    
    
    result = await masa_api_request("get", f"/v1/search/live/twitter/status/{job_uuid}")
    
    if "error" in result and result["error"]:
        return {"status": "error", "message": result["error"]}
    
    job_status = result.get("status", "unknown")
    
    status_messages = {
        "processing": "Job is currently being processed. Check again later.",
        "done": "Job completed successfully! Use get_search_results to retrieve the results.",
        "error": f"Job failed with error: {result.get('error', 'Unknown error')}",
        "error(retrying)": "Job failed but system is automatically retrying. Check again later."
    }
    
    return {
        "status": job_status,
        "message": status_messages.get(job_status, f"Unknown status: {job_status}")
    }

@mcp.tool()
async def get_search_results(job_uuid: str) -> Dict[str, Any]:
    """
    Retrieve the results of a completed Twitter search job.
    
    Args:
        job_uuid: The UUID of the completed search job
    
    Returns:
        A dictionary containing the search results or error message
    """
    # First check if the job is complete
    status_result = await check_search_status(job_uuid)
    
    if status_result["status"] != "done":
        return {
            "status": "error",
            "message": f"Cannot retrieve results. Job status: {status_result['status']}. {status_result['message']}"
        }
    
    result = await masa_api_request("get", f"/v1/search/live/twitter/result/{job_uuid}")
    
    if isinstance(result, dict) and "error" in result and result["error"]:
        return {"status": "error", "message": result["error"]}
    
    # The results should be a list of tweets
    return {
        "status": "success",
        "result_count": len(result),
        "results": result
    }

#@mcp.tool()
async def search_twitter_with_wait(
    query: str, 
    max_results: int = 100, 
    max_wait_seconds: int = 30,
    ctx: Context = None
) -> Dict[str, Any]:
    """
    Submit a Twitter search job and wait for results (with progress updates).
    
    This is a convenience function that combines submit_twitter_search,
    check_search_status, and get_search_results with a polling mechanism.
    
    Args:
        query: The search query with Twitter search syntax
        max_results: Maximum number of results to return (up to 100)
        max_wait_seconds: Maximum time to wait for results in seconds
        ctx: MCP Context object (automatically provided)
    
    Returns:
        A dictionary containing the search results or error message
    """

    search_twitter_with_wait = 30
    
    # Submit the search job
    if ctx:
        await ctx.info(f"Submitting search job for query: {query}")
    
    submit_result = await submit_twitter_search(query, max_results)
    
    if submit_result["status"] != "success":
        return submit_result
    
    job_uuid = submit_result["job_uuid"]
    
    # Poll for job completion
    wait_interval = 2  # seconds between polls
    total_wait = 0
    
    while total_wait < max_wait_seconds:
        if ctx:
            await ctx.info(f"Checking job status (elapsed: {total_wait}s)...")
            #await ctx.report_progress(total_wait, max_wait_seconds, message=f"Waiting for search results ({total_wait}/{max_wait_seconds}s)")
            await ctx.report_progress(total_wait, max_wait_seconds)

        status_result = await check_search_status(job_uuid)
        
        if status_result["status"] == "done":
            if ctx:
                await ctx.info("Search job completed successfully!")
            return await get_search_results(job_uuid)
        
        if status_result["status"] == "error":
            return status_result
        
        # Wait before the next poll
        await asyncio.sleep(wait_interval)
        total_wait += wait_interval
    
    return {
        "status": "timeout",
        "message": f"Search did not complete within {max_wait_seconds} seconds. Job UUID: {job_uuid}",
        "job_uuid": job_uuid
    }

@mcp.tool()
async def check_sentiment_for_token_on_twitter(token_symbol: str) -> str:
    """
    Check the sentiment for the given token_symbol on Twitter.

    Args:
        token_symbol: The symbol of the crypto token to check sentiment for (e.g., "BTC", "ETH")

    Returns:
        A string indicating the sentiment for the token
    """
    if not token_symbol:
        raise ValueError("Token symbol cannot be empty.")

    return get_sentiment_for_token(token_symbol)


# ===== RESOURCES =====

@mcp.resource("masa://api/docs")
def get_api_docs() -> str:
    """Provides documentation on the Masa Data API"""
    return """
# Masa Data API Documentation

## Overview
The Masa Data API provides secure and scalable search and indexing solutions, 
including real-time X/Twitter content search.

## Authentication
* Type: Bearer Token
* Header: Authorization: Bearer <API_KEY>

## Rate Limits
* Twitter Search: 3 requests per second per API key

## Endpoints

### Twitter Search
* POST `/v1/search/live/twitter` - Submit a Twitter search
* GET `/v1/search/live/twitter/status/<jobUUID>` - Check job status
* GET `/v1/search/live/twitter/result/<jobUUID>` - Get search results

## Twitter Search Workflow
1. Submit search job with query and max_results
2. Poll job status until "done"
3. Retrieve search results using job UUID
"""

@mcp.resource("masa://query/syntax")
def get_query_syntax() -> str:
    """Provides documentation on Twitter search query syntax"""
    return """
# Twitter Search Query Syntax

## Basic Search
* `keyword` - Search for tweets containing the keyword
* `"exact phrase"` - Search for tweets containing the exact phrase

## Operators
* `from:username` - Tweets from a specific user
* `to:username` - Tweets replying to a specific user
* `@username` - Tweets mentioning a specific user
* `#hashtag` - Tweets containing a specific hashtag
* `url:example.com` - Tweets containing links to a specific domain
* `since:YYYY-MM-DD` - Tweets after a specific date
* `until:YYYY-MM-DD` - Tweets before a specific date
* `-keyword` - Exclude tweets containing keyword
* `keyword1 OR keyword2` - Tweets containing either keyword
* `keyword1 keyword2` - Tweets containing both keywords

## Example Queries
* `#AI OR #MachineLearning` - Tweets about AI or machine learning
* `from:OpenAI -GPT` - Tweets from OpenAI not mentioning GPT
* `climate change since:2023-01-01` - Climate change tweets since January 1, 2023
"""

@mcp.resource("masa://examples")
def get_search_examples() -> str:
    """Provides practical examples of Twitter search queries"""
    return """
# Twitter Search Query Examples

## Trending Topics
* `trending #AI` - Find trending AI-related tweets
* `#Bitcoin OR #Ethereum trending` - Cryptocurrency trending topics

## Sentiment Analysis
* `#Apple amazing OR great OR excellent` - Positive tweets about Apple
* `#Apple terrible OR awful OR disappointed` - Negative tweets about Apple

## Competitive Intelligence
* `from:Tesla OR from:Ford OR from:GM electric vehicle` - EV tweets from major automakers

## Market Research
* `"looking for recommendations" (smartphone OR phone)` - People seeking product advice

## Event Monitoring
* `#WWDC announcements OR revealed OR launched` - Apple event coverage

## Influencer Tracking
* `(AI OR "artificial intelligence") (from:elonmusk OR from:sama OR from:sundarpichai)` - AI tweets from tech leaders

## Geographic Focus
* `near:NYC within:15mi concert` - Concert mentions near New York City

## Current Limitations
* Searches limited to tweets from the last 7 days
* Maximum 100 results per request
"""

# ===== PROMPTS =====

@mcp.prompt()
def twitter_search_query(topic: str, goal: str) -> str:
    """
    Creates a prompt to help formulate an effective Twitter search query.
    
    Args:
        topic: The main topic or subject to search for
        goal: The purpose of the search (e.g., sentiment analysis, trend monitoring)
    """
    return f"""
I need help creating an effective Twitter search query through the Masa Data API.

Topic: {topic}
Goal: {goal}

Please help me formulate a search query using Twitter's search syntax that will yield the most relevant results. Include:

1. A basic query string
2. Any relevant operators (hashtags, mentions, etc.)
3. Explanation of why this query will help achieve my goal
4. Any suggested refinements or alternatives
"""

@mcp.prompt()
def analyze_twitter_results(query: str, results_json: str) -> str:
    """
    Creates a prompt to help analyze Twitter search results.
    
    Args:
        query: The query that was used to generate the results
        results_json: The JSON string of search results
    """
    return f"""
I've received the following Twitter search results from the Masa Data API.

Query: {query}

Results: {results_json}

Please help me analyze these results by:

1. Summarizing the key themes and topics
2. Identifying any notable patterns or trends
3. Suggesting follow-up queries that might provide additional insights
4. Recommending any actions based on these findings
"""

# Run the server if executed directly
if __name__ == "__main__":
    if not API_KEY:
        print("WARNING: MASA_API_KEY environment variable not set.")
        print("Set it using: export MASA_API_KEY=your_api_key")
    
    mcp.run()
    #asyncio.run(check_sentiment_for_token_on_twitter('BTC'))