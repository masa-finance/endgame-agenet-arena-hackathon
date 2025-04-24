import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


def load_config(config_name: str, default_value: str = None):
    """
    Load configuration from environment variables or use default value.
    """
    value = os.environ.get(config_name)
    if value is None:
        return default_value
    return value


def get_masa_api_key():
    """
    Get the MASA API key from environment variables.
    """
    return load_config('MASA_API_KEY')


def get_token_metrics_api_key():
    """
    Get the Token Metrics API key from environment variables.
    """
    return load_config('TOKEN_METRICS_API_KEY')


def get_binance_us_api_key():
    """
    Get the Binance US API key from environment variables.
    """
    return load_config('BINANCE_US_API_KEY')


def get_binance_us_secret():
    """
    Get the Binance US secret from environment variables.
    """
    return load_config('BINANCE_US_SECRET')


if __name__ == "__main__":
    # Example usage
    print(load_config('MASA_API_KEY'))
