import asyncio
import json
import logging
import os
import traceback
from datetime import datetime, timedelta  # Make sure to import the datetime class
from typing import Dict, Any, List, Optional

import httpx
from mcp.server.fastmcp import FastMCP, Context
from pydantic import BaseModel

from config import get_token_metrics_api_key

# Configure logging
logging.basicConfig(
    filename='/tmp/token_metrics.log',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger('mcp_server')

# Initialize our MCP server
mcp = FastMCP("TokenMetrics API")

# TokenMetrics API configuration
TOKEN_METRICS_API_BASE = "https://api.tokenmetrics.com/v2"


def fetch_token_metrics() -> Dict[str, Any]:
    """Make a request to the TokenMetrics API to fetch token information"""
    url = "https://api.tokenmetrics.com/v2/tokens"
    params = {"limit": 100000}

    with httpx.Client() as client:
        try:
            response = client.get(url, params=params)
            response.raise_for_status()

            try:
                logging.info(f"JSON response received: {response.text}")
                # return response.json()
                return json.loads(response.text)
            except json.JSONDecodeError:
                # Log the response if it's not JSON
                logging.error(f"Non-JSON response received: {response.text}")
                return {"error": "Received non-JSON response from API"}

        except httpx.HTTPError as e:
            logging.error(f"HTTP error occurred: {str(e)}")
            return {"error": f"HTTP error occurred: {str(e)}"}
        except Exception as e:
            logging.error(f"An error occurred: {str(e)}")
            return {"error": f"An error occurred: {str(e)}"}


@mcp.tool()
async def get_token_info(symbol: str, name: str) -> Dict[str, Any]:
    """
    Tool to get information such as TOKEN_ID, TOKEN_NAME, TOKEN_SYMBOL about a specific crypto token by its symbol and name in the TokenMetrics API.
    Please use this tool to get the token id by token symbol and name.
    
    Args:
        symbol: The token symbol to search for (e.g., "BTC", "ETH")
        name: The token name to search for (e.g., "Bitcoin", "Ethereum")
    
    Returns:
        A dictionary containing:
        - success: boolean indicating if the request was successful
        - message: status message
        - data: token information (token_id, token_name, token_symbol) if found
    """

    # result = await fetch_token_metrics()
    result = fetch_token_metrics()

    logging.info('get token info result', result)

    if "error" in result:
        return {
            "success": False,
            "message": result["error"],
            "data": None
        }

    logging.info('before for loop')

    ### create a dictionary of token symbol to a list of tokens
    token_dict = {}
    for token in result.get("data", []):
        tmp = token.get("TOKEN_SYMBOL")
        if tmp not in token_dict:
            token_dict[tmp] = []
        token_dict[tmp].append(token)

    logging.info('after for loop')
    # Check if the symbol exists in the token_dict
    if symbol in token_dict:
        # Check if the name exists in the list of tokens for that symbol
        for token in token_dict[symbol]:
            if token.get("TOKEN_NAME") == name:
                # Return the token information
                return {
                    "success": True,
                    "message": f"Found token with symbol {symbol} and name {name}",
                    "data": {
                        "token_id": token.get("TOKEN_ID"),
                        "token_name": token.get("TOKEN_NAME"),
                        "token_symbol": token.get("TOKEN_SYMBOL")
                    }
                }

    return {
        "success": False,
        "message": f"No token found with symbol {symbol} and name {name}",
        "data": None
    }


@mcp.resource("tokenmetrics://docs")
def get_api_docs() -> str:
    """Provides documentation on the TokenMetrics API integration"""
    return """
# TokenMetrics API Integration Documentation

## Overview
This MCP server provides access to the TokenMetrics API to fetch information about various crypto tokens.

## Available Tools

### Get Token Information
* Tool: `get_token_info`
* Description: Returns information about a specific token by its symbol and name
* Parameters:
  - symbol: The token symbol to search for (e.g., "BTC", "ETH")
  - name: The token name to search for (e.g., "Bitcoin", "Ethereum")
* Response Format:
  ```json
  {
    "success": boolean,
    "message": string,
    "data": {
      "token_id": number,
      "token_name": string,
      "token_symbol": string
    }
  }
  
### Get Trading Signals Documentation
* Tool: `get_trading_signals`
* Description: Retrieves trading signals for a specific cryptocurrency from the TokenMetrics API.
* Parameters:
  - `token_symbols`: The symbols for the cryptocurrencies (default: [BTC])
  - `days`: Number of days of data to retrieve (default: 2)
* Response Format:
```json
{
  "success": true,
  "message": "Data fetched successfully",
  "length": 192,
  "data": [
    {
      "TOKEN_ID": 3375,
      "TOKEN_NAME": "Bitcoin",
      "TOKEN_SYMBOL": "BTC",
      "DATE": "2025-04-10T00:00:00.000Z",
      "TRADING_SIGNAL": 0,
      "TOKEN_TREND": -1,
      "TRADING_SIGNALS_RETURNS": 45098.7035,
      "HOLDING_RETURNS": 7559.6422,
      "tm_link": "bitcoin",
      "TM_TRADER_GRADE": 26.48,
      "TM_INVESTOR_GRADE": 58.23,
      "TM_LINK": "https://app.tokenmetrics.com/undefined"
    },
    ...
    ]
}
```

Response Data Descriptions: 
* TOKEN_ID: Token ID for identifying each cryptocurrency (e.g., the Token ID of BTC is 3375).
* TOKEN_NAME: Name of the cryptocurrency (e.g., "Bitcoin").
* TOKEN_SYMBOL": Symbol of the cryptocurrency (e.g., "BTC").
* DATE: The date of calculation of the crypto trading signal.
* TRADING_SIGNAL: The current signal value of the strategy, between bullish (1), bearish (-1) or no signal (0).
* TOKEN_TREND: The value of the last bullish or bearish signal, i.e. the current trend.
* TRADING_SIGNALS_RETURNS: The cumulative ROI of the trading strategy. This is not the price of BTC at the date.
* HOLDING_RETURNS: The comparable cumulative ROI of holding strategy.
* tm_link: This is not useful for now.
* TM_TRADER_GRADE: The short-term Token Metrics Trader Grade comprises all of the aforementioned indicators.
* TM_INVESTOR_GRADE: The Token Metrics Investor Grade comprises all the aforementioned grades and can indicate Token Metrics' long-term outlook on the asset.
* TM_LINK: Provides direct access to the Token Metrics token details page, offering comprehensive insights into the token's performance and statistics.

If the call is not successful, the success field will be false
"""


# Models for type hints and validation
class TradingSignal(BaseModel):
    TOKEN_ID: int
    TOKEN_NAME: str
    TOKEN_SYMBOL: str
    DATE: str
    TRADING_SIGNAL: int
    TOKEN_TREND: int
    TRADING_SIGNALS_RETURNS: float
    HOLDING_RETURNS: float
    tm_link: str
    TM_TRADER_GRADE: float
    TM_INVESTOR_GRADE: float
    TM_LINK: str


class TradingSignalResponse(BaseModel):
    success: bool
    message: str
    length: int
    data: List[TradingSignal]


TOKEN_METRICS_API_KEY = get_token_metrics_api_key()

# Helper function to make authenticated requests to the Token Metrics API
async def make_api_request(
        endpoint: str,
        params: Dict[str, Any],
        api_key: str = TOKEN_METRICS_API_KEY,
        ctx: Optional[Context] = None
) -> Dict[str, Any]:
    """Make an authenticated request to the Token Metrics API"""
    if not api_key:
        raise ValueError(
            "API key is required. Set the TOKEN_METRICS_API_KEY environment variable or provide it as a parameter.")

    url = f"{TOKEN_METRICS_API_BASE}/{endpoint}"
    headers = {"accept": "application/json", "api_key": api_key}

    if ctx:
        ctx.info(f"Making request to {endpoint} with params: {params}")

    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params, headers=headers)

        if response.status_code != 200:
            error_message = f"API request failed with status code {response.status_code}: {response.text}"
            if ctx:
                ctx.error(error_message)
            raise ValueError(error_message)

        return json.loads(response.text)


# Hardcoded list of popular cryptocurrencies and their IDs
popular_cryptos = [
    {"id": 3375, "name": "Bitcoin", "symbol": "BTC"},
    {"id": 3377, "name": "Ethereum", "symbol": "ETH"},
    {"id": 3432, "name": "Solana", "symbol": "SOL"},
    {"id": 3408, "name": "Binance Coin", "symbol": "BNB"},
    {"id": 3449, "name": "XRP", "symbol": "XRP"},
    {"id": 3410, "name": "Cardano", "symbol": "ADA"},
    {"id": 3426, "name": "Avalanche", "symbol": "AVAX"},
    {"id": 3418, "name": "Dogecoin", "symbol": "DOGE"},
    {"id": 3446, "name": "Toncoin", "symbol": "TON"},
    {"id": 13249, "name": "Shiba Inu", "symbol": "SHIB"},
    {"id": 3988, "name": "Solana", "symbol": "SOL"},
]

# Create a dictionary for quick access to popular cryptocurrencies by symbol
popular_cryptos_dict = {crypto["symbol"]: crypto["id"] for crypto in popular_cryptos}


# List available cryptocurrencies
@mcp.tool()
async def list_popular_cryptocurrencies() -> str:
    """
    List popular cryptocurrencies and their Token Metrics IDs.
    
    Returns:
        A formatted list of popular cryptocurrencies and their IDs.
    """
    result = "Popular Cryptocurrencies:\n\n"
    for crypto in popular_cryptos:
        result += f"- {crypto['name']} ({crypto['symbol']}): ID = {crypto['id']}\n"

    return result


# Get trading signals for a specific cryptocurrency
# @mcp.tool()
async def get_trading_signals_by_token_ids(
        token_ids: List[int] = [3375],
        days: int = 2,
        ctx: Context = None
) -> TradingSignalResponse:
    """
    Get trading signals for a specific cryptocurrency.
    
    Args:
        token_ids: The Token Metrics IDs for the cryptocurrencies (default: [3375] for [Bitcoin])
        days: Number of days of data to retrieve (default: 2)
    
    Returns:
        TradingSignalResponse object containing:
        - success: boolean indicating if the request was successful
        - message: status message
        - length: number of trading signals received
        - data: list of TradingSignal objects
        Each of the TradingSignal objects contains:
            * TOKEN_ID: Token ID for identifying each cryptocurrency (e.g., the Token ID of BTC is 3375).
            * TOKEN_NAME: Name of the cryptocurrency (e.g., "Bitcoin").
            * TOKEN_SYMBOL": Symbol of the cryptocurrency (e.g., "BTC").
            * DATE: The date of calculation of the crypto trading signal.
            * TRADING_SIGNAL: The current signal value of the strategy, between bullish (1), bearish (-1) or no signal (0).
            * TOKEN_TREND: The value of the last bullish or bearish signal, i.e. the current trend.
            * TRADING_SIGNALS_RETURNS: The cumulative ROI of the trading strategy. This is not the price of BTC at the date.
            * HOLDING_RETURNS: The comparable cumulative ROI of holding strategy.
            * tm_link: This is not useful for now.
            * TM_TRADER_GRADE: The short-term Token Metrics Trader Grade comprises all of the aforementioned indicators.
            * TM_INVESTOR_GRADE: The Token Metrics Investor Grade comprises all the aforementioned grades and can indicate Token Metrics' long-term outlook on the asset.
            * TM_LINK: Provides direct access to the Token Metrics token details page, offering comprehensive insights into the token's performance and statistics.
    """
    # Calculate date range
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)

    # Format dates for API
    start_date_str = start_date.strftime("%Y-%m-%d")
    end_date_str = end_date.strftime("%Y-%m-%d")

    # Prepare request parameters
    params = {
        "token_id": token_ids,
        "startDate": start_date_str,
        "endDate": end_date_str,
        "limit": 1000,
        "page": 0
    }

    # Use provided API key or fall back to environment variable
    key = TOKEN_METRICS_API_KEY

    try:
        logging.info(f"Fetching trading signals for token IDs: {token_ids} from {start_date_str} to {end_date_str}")
        # Make API request
        response_data = await make_api_request("trading-signals", params, key, ctx)

        # Check for successful response
        if not response_data.get("success", False):
            raise ValueError(response_data.get("message", "Unknown error"))

        # Parse data
        data = response_data.get("data", [])
        if data is not None:
            logging.info(f"Received {len(data)} trading signals")

        # Convert to TradingSignal objects
        trading_signals = [TradingSignal(**entry) for entry in data]
        logging.info(f"Parsed {len(trading_signals)} trading signals")
        number_of_signals = len(trading_signals)
        resp = TradingSignalResponse(success = True,
                                     message = "",
                                     length = number_of_signals,
                                     data = trading_signals)
        return resp

    except Exception as e:
        logging.error(f"An error occurred: {str(e)}")
        error_message = str(e)
        raise ValueError(error_message)


@mcp.tool()
async def get_trading_signals(token_symbols: List[str], days: int = 3, ctx: Context = None) -> TradingSignalResponse:
    """
    Get trading signals for a list of cryptocurrencies by their symbols.
    
    Args:
        token_symbols: A list of cryptocurrency symbols to get trading signals for.
    
    Returns:
        TradingSignalResponse object containing:
        - success: boolean indicating if the request was successful
        - message: status message
        - length: number of trading signals received
        - data: list of TradingSignal objects
        Each of the TradingSignal objects contains:
            * TOKEN_ID: Token ID for identifying each cryptocurrency (e.g., the Token ID of BTC is 3375).
            * TOKEN_NAME: Name of the cryptocurrency (e.g., "Bitcoin").
            * TOKEN_SYMBOL": Symbol of the cryptocurrency (e.g., "BTC").
            * DATE: The date of calculation of the crypto trading signal.
            * TRADING_SIGNAL: The current signal value of the strategy, between bullish (1), bearish (-1) or no signal (0).
            * TOKEN_TREND: The value of the last bullish or bearish signal, i.e. the current trend.
            * TRADING_SIGNALS_RETURNS: The cumulative ROI of the trading strategy. This is not the price of BTC at the date.
            * HOLDING_RETURNS: The comparable cumulative ROI of holding strategy.
            * tm_link: This is not useful for now.
            * TM_TRADER_GRADE: The short-term Token Metrics Trader Grade comprises all of the aforementioned indicators.
            * TM_INVESTOR_GRADE: The Token Metrics Investor Grade comprises all the aforementioned grades and can indicate Token Metrics' long-term outlook on the asset.
            * TM_LINK: Provides direct access to the Token Metrics token details page, offering comprehensive insights into the token's performance and statistics.
    """

    logging.info(f"To find trading signals for: {token_symbols}")
    # Check if token_symbols is empty
    if not token_symbols:
        raise ValueError("No token symbols provided")

    try:
        ## get token id for each symbol
        token_ids = []
        for symbol in token_symbols:
            token_id = popular_cryptos_dict.get(symbol, "")
            if token_id:
                token_ids.append(token_id)
            logging.info(f"Token ID for {symbol}: {token_id}")

        # Check if token_ids is empty
        if not token_ids:
            raise ValueError("No valid token IDs found for the provided symbols")

        logging.info(f"To get signals for token IDs: {token_ids}")

        return await get_trading_signals_by_token_ids(token_ids=token_ids, days=days, ctx=ctx)

    except Exception as e:
        logger.error("An error occurred: %s", traceback.format_exc())
        traceback.print_exc()
        return None


async def format_trading_signal_result(data):
    # Format results
    token_name = data[0]["TOKEN_NAME"]
    token_symbol = data[0]["TOKEN_SYMBOL"]
    result = f"Trading Signals for {token_name} ({token_symbol}):\n\n"
    result += "Date | Signal | Trend | Trader Grade | Investor Grade | Returns\n"
    result += "----|--------|-------|--------------|----------------|--------\n"
    for entry in data[:10]:  # Limit to most recent 10 entries for readability
        date = datetime.fromisoformat(entry["DATE"].replace("Z", "+00:00")).strftime("%Y-%m-%d")
        signal = "Buy" if entry["TRADING_SIGNAL"] == 1 else "Hold" if entry["TRADING_SIGNAL"] == 0 else "Sell"
        trend = "↑" if entry["TOKEN_TREND"] == 1 else "↓" if entry["TOKEN_TREND"] == -1 else "-"
        trader_grade = f"{entry['TM_TRADER_GRADE']:.2f}"
        investor_grade = f"{entry['TM_INVESTOR_GRADE']:.2f}"
        returns = f"{entry['TRADING_SIGNALS_RETURNS']:.2f}"

        result += f"{date} | {signal} | {trend} | {trader_grade} | {investor_grade} | {returns}\n"
    # Add summary
    latest_entry = data[0]
    result += f"\nLatest Analysis ({datetime.fromisoformat(latest_entry['DATE'].replace('Z', '+00:00')).strftime('%Y-%m-%d')}):\n"
    result += f"- Current Trading Signal: {('Buy' if latest_entry['TRADING_SIGNAL'] == 1 else 'Hold' if latest_entry['TRADING_SIGNAL'] == 0 else 'Sell')}\n"
    result += f"- Current Trend: {('Upward' if latest_entry['TOKEN_TREND'] == 1 else 'Downward' if latest_entry['TOKEN_TREND'] == -1 else 'Neutral')}\n"
    result += f"- Trader Grade: {latest_entry['TM_TRADER_GRADE']:.2f}/100\n"
    result += f"- Investor Grade: {latest_entry['TM_INVESTOR_GRADE']:.2f}/100\n"
    print(result)
    return result


# Run the server if executed directly
if __name__ == "__main__":
    mcp.run()
    ## use the following to debug standalone
    # asyncio.run(get_token_info("BTC", "Bitcoin"))
    #print(asyncio.run(get_trading_signals(["SOL"], 10)))
