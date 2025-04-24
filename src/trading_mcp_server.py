from typing import Dict

import ccxt.async_support as ccxt
from mcp.server.fastmcp import FastMCP

from config import get_binance_us_api_key, get_binance_us_secret

# Initialize our MCP server
mcp = FastMCP("CCXT Binance US")

#BINANCE_US_API_KEY = '9RQ253i2rxM3y2QmrGImeCIIt2ZEHqcnmVuThM5JfFuSaYEZRRmkoZPkjDyYOolK'
#BINANCE_US_SECRET = 'dAeJZGD5lAqj2EdReM7UQsJxvutf22FuyyLEoQWRyR8sfc5iKGpgeE65JWrMAPvT'
BINANCE_US_API_KEY = get_binance_us_api_key()
BINANCE_US_SECRET = get_binance_us_secret()

async def check_balance(token_to: str, token_from: str, exchange):
    balance = await exchange.fetch_balance()
    from_bal = balance['total'][token_from]
    to_bal = balance['total'][token_to]
    return f'{token_from} balance is: {from_bal} and {token_to} balance is: {to_bal}'


async def place_order(exchange, symbol, side, amount):
    try:
        # Fetch tick size
        markets = await exchange.load_markets()
        # print(markets)
        market = exchange.markets[symbol]
        tick_size = float(market['precision']['price'])

        # Place order
        order = await exchange.create_market_order(
            symbol=symbol,
            side=side,
            amount=amount,
        )
        print(f"Order placed: {order}")
        return order
    except ccxt.BadRequest as e:
        print(f"BadRequest error: {e}")
        raise
    except Exception as e:
        print(f"Error: {e}")
        raise


async def execute(token_to: str, token_from: str, data):
    exchange = ccxt.binanceus({
        'apiKey': BINANCE_US_API_KEY,
        'secret': BINANCE_US_SECRET,
        'enableRateLimit': False,
    })

    exchange.set_sandbox_mode(True)
    symbol = data["tradingpair"]
    side = 'buy'
    amount = data["amount"]
    print("info", f"Placing order for {amount} of {symbol}")

    try:
        await check_balance(token_to=token_to, token_from=token_from, exchange = exchange)
        order = await place_order(exchange, symbol, side, amount)
        balance = await check_balance(token_to, token_from, exchange)
        return balance
    finally:
        await exchange.close()


# TOOL
@mcp.tool()
async def place_buy_order(token_to: str,
                          token_from: str = 'USDT',
                          amount: float = None,
                          ) -> Dict['str', 'str']:
    """
    Submit a buy order of the trading pair in the binance us simulated network.

    Args:
        token_to: The token to buy (e.g., 'BTC', 'ETH', 'SOL')
        token_from: The token to sell (default is 'USDT')
        amount: The amount to buy (default is None, which will be set based on the token_to)

    Returns:
        A dictionary containing the current balance of both BTC and USDT and any error messages on failure
    """
    tradingpair = f'{token_to}/{token_from}'

    if not amount:
        if 'BTC' in token_to:
            amount = 0.0001
        elif 'SOL' in token_to:
            amount = 0.1
        elif 'ETH' in token_to:
            amount = 0.01
        else:
            amount = 0.01

    if amount > 0.001 and 'BTC' in token_to:
        raise ValueError("Amount must be less than 0.0001")

    data = {
        "tradingpair": tradingpair,
        "amount": amount
    }
    result = await execute(token_to, token_from, data)
    return result


if __name__ == "__main__":
    mcp.run()
    #asyncio.run(place_buy_order('SOL', 'USDT'))
