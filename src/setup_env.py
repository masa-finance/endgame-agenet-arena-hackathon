# setup_env.py
import os
import sys
import argparse

def setup_environment():
    parser = argparse.ArgumentParser(description='Setup environment for Masa MCP Server')
    parser.add_argument('--api-key', help='Your Masa API key')
    parser.add_argument('--env-file', help='Path to .env file')
    
    args = parser.parse_args()
    
    if args.env_file:
        try:
            with open(args.env_file, 'r') as f:
                for line in f:
                    if line.strip() and not line.startswith('#'):
                        key, value = line.strip().split('=', 1)
                        os.environ[key] = value
            print(f"Loaded environment from {args.env_file}")
        except Exception as e:
            print(f"Error loading .env file: {e}")
            sys.exit(1)
    
    if args.api_key:
        os.environ['MASA_API_KEY'] = args.api_key
        print("API key set from command line argument")
    
    # Verify API key is set
    if not os.environ.get('MASA_API_KEY'):
        print("WARNING: MASA_API_KEY not set. Please provide it via --api-key or --env-file")
        sys.exit(1)
    
    print("Environment setup complete")

if __name__ == "__main__":
    setup_environment()