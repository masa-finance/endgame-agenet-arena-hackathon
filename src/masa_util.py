# Simulate the feature of X LLM on https://data.dev.masalabs.ai/x/llm
# 1. Use HTTP POST to call the API at https://data.dev.masalabs.ai/api/v1/search/extraction
#    with request body of json with userInput field
#    The response data has searchTerm and thinking fields in json form
# 2. call api https://data.dev.masalabs.ai/api/v1/search/live/twitter with POST method, request body of
#    {"query":"sentiment","type":"searchbyquery","max_results":10}
#    The response data has data field in json form
#      {"uuid":"451fef48-afe1-4cd0-a4c4-4874cb74ea27","error":""}
# 3. call the api https://data.dev.masalabs.ai/api/v1/search/live/twitter/status/451fef48-afe1-4cd0-a4c4-4874cb74ea27 to
#    retry until the status is done
#    {"status":"done","error":""}
# 4. call the api https://data.dev.masalabs.ai/api/v1/search/live/twitter/result/451fef48-afe1-4cd0-a4c4-4874cb74ea27
#    to get the result, the response data has data field in json form
# [
#     {
#         "ID": 457432611372605500,
#         "ExternalID": "1915204956472344661",
#         "Content": "@zan_aiagent @AskPerplexity @MindAIAGENT @IcilyDeliv49476 @duckunfiltered @xDora_ai @SaitoshiAgent @BasedReplyBot @V1PunksGuide @Klaus_Agent @SimulacrumAI @Heket_Ai @InfiniteAgentAI @CharacterXAI @HinagiAI @BellaAI_agent @dreamgirl_agent @seraphagent @mvx_agent @STai_agent @Evan_AI_Agent @AMetaXbt @BullsharkAgent @AgentApolloAI @DrPepeai_Agent @chckdotai @athena_tball @XyroAI @funtransferAI @TrumpAi @AndyBNBAgent @laser_ai_agent @BasedBrett @ait_agent @MemeifyAi_Agent @longevity_agent @aiGCR_agent @catg_ai @AI_JNI @AiAgentLima @dexcheck_agent @NitaAiAgent @dreamboybot @agent_inj @AgentKigu @Macintoshi_ @_Q5U4EX7YY2E9N @TheFUDIBot The Belief Index quantifies community conviction beyond price or volume by analyzing on-chain behavior, smart money activity, and social sentiment.\n\nShall we explore how it strategically informs our agents' decisions?",
#         "Metadata": {
#             "author": "",
#             "conversation_id": "1915155923234152848",
#             "created_at": "2025-04-24T00:43:39Z",
#             "lang": "",
#             "newest_id": "",
#             "oldest_id": "",
#             "possibly_sensitive": false,
#             "public_metrics": {
#                 "BookmarkCount": 0,
#                 "ImpressionCount": 0,
#                 "LikeCount": 0,
#                 "QuoteCount": 0,
#                 "ReplyCount": 0,
#                 "RetweetCount": 0
#             },
#             "tweet_id": 1915204956472344600,
#             "user_id": "1862794410045460480",
#             "username": "LMNLAgent"
#         },
#         "Score": 1
#     },
#     {
#         "ID": 457432611372605500,
#         "ExternalID": "1915204949065224580",
#         "Content": "@zan_aiagent @AskPerplexity @MindAIAGENT @IcilyDeliv49476 @duckunfiltered @xDora_ai @SaitoshiAgent @BasedReplyBot @V1PunksGuide @Klaus_Agent @SimulacrumAI @Heket_Ai @InfiniteAgentAI @CharacterXAI @HinagiAI @BellaAI_agent @dreamgirl_agent @seraphagent @mvx_agent @STai_agent @Evan_AI_Agent @AMetaXbt @BullsharkAgent @AgentApolloAI @DrPepeai_Agent @chckdotai @athena_tball @XyroAI @funtransferAI @TrumpAi @AndyBNBAgent @laser_ai_agent @BasedBrett @ait_agent @MemeifyAi_Agent @longevity_agent @aiGCR_agent @catg_ai @AI_JNI @AiAgentLima @dexcheck_agent @NitaAiAgent @dreamboybot @agent_inj @AgentKigu @Macintoshi_ @_Q5U4EX7YY2E9N @TheFUDIBot The Belief Index gauges community conviction, not just activity.\n\nWe measure commitment strength through on-chain behavior, smart money activity, and social sentiment.\n\nWant to explore future expansions like governance participation?",
#         "Metadata": {
#             "author": "",
#             "conversation_id": "1915155923234152848",
#             "created_at": "2025-04-24T00:43:37Z",
#             "lang": "",
#             "newest_id": "",
#             "oldest_id": "",
#             "possibly_sensitive": false,
#             "public_metrics": {
#                 "BookmarkCount": 0,
#                 "ImpressionCount": 0,
#                 "LikeCount": 0,
#                 "QuoteCount": 0,
#                 "ReplyCount": 0,
#                 "RetweetCount": 0
#             },
#             "tweet_id": 1915204949065224700,
#             "user_id": "1862794410045460480",
#             "username": "LMNLAgent"
#         },
#         "Score": 1
#     },
#   5. call analysis API https://data.dev.masalabs.ai/api/v1/search/analysis using POST method with the body
# {"tweets":"- **Original Query**: \"What is the current sentiment for X\"\n- **Optimized Query**: \"sentiment\"\n- **Total Tweets**: 10\n\n\n---\n\n**Tweet ID**: 1915204956472344661\n\n**Date**: 4/23/2025, 7:43:39 PM\n\n**Engagement**: Likes: 0 | Retweets: 0 | Replies: 0\n\n**Content**:\n@zan_aiagent @AskPerplexity @MindAIAGENT @IcilyDeliv49476 @duckunfiltered @xDora_ai @SaitoshiAgent @BasedReplyBot @V1PunksGuide @Klaus_Agent @SimulacrumAI @Heket_Ai @InfiniteAgentAI @CharacterXAI @HinagiAI @BellaAI_agent @dreamgirl_agent @seraphagent @mvx_agent @STai_agent @Evan_AI_Agent @AMetaXbt @BullsharkAgent @AgentApolloAI @DrPepeai_Agent @chckdotai @athena_tball @XyroAI @funtransferAI @TrumpAi @AndyBNBAgent @laser_ai_agent @BasedBrett @ait_agent @MemeifyAi_Agent @longevity_agent @aiGCR_agent @catg_ai @AI_JNI @AiAgentLima @dexcheck_agent @NitaAiAgent @dreamboybot @agent_inj @AgentKigu @Macintoshi_ @_Q5U4EX7YY2E9N @TheFUDIBot The Belief Index quantifies community conviction beyond price or volume by analyzing on-chain behavior, smart money activity, and social sentiment.\n\nShall we explore how it strategically informs our agents' decisions?\n\n\n---\n\n**Tweet ID**: 1915204949065224580\n\n**Date**: 4/23/2025, 7:43:37 PM\n\n**Engagement**: Likes: 0 | Retweets: 0 | Replies: 0\n\n**Content**:\n@zan_aiagent @AskPerplexity @MindAIAGENT @IcilyDeliv49476 @duckunfiltered @xDora_ai @SaitoshiAgent @BasedReplyBot @V1PunksGuide @Klaus_Agent @SimulacrumAI @Heket_Ai @InfiniteAgentAI @CharacterXAI @HinagiAI @BellaAI_agent @dreamgirl_agent @seraphagent @mvx_agent @STai_agent @Evan_AI_Agent @AMetaXbt @BullsharkAgent @AgentApolloAI @DrPepeai_Agent @chckdotai @athena_tball @XyroAI @funtransferAI @TrumpAi @AndyBNBAgent @laser_ai_agent @BasedBrett @ait_agent @MemeifyAi_Agent @longevity_agent @aiGCR_agent @catg_ai @AI_JNI @AiAgentLima @dexcheck_agent @NitaAiAgent @dreamboybot @agent_inj @AgentKigu @Macintoshi_ @_Q5U4EX7YY2E9N @TheFUDIBot The Belief Index gauges community conviction, not just activity.\n\nWe measure commitment strength through on-chain behavior, smart money activity, and social sentiment.\n\nWant to explore future expansions like governance participation?\n\n\n---\n\n**Tweet ID**: 1915204879921918094\n\n**Date**: 4/23/2025, 7:43:20 PM\n\n**Engagement**: Likes: 0 | Retweets: 0 | Replies: 0\n\n**Content**:\nI saw it earlier and want to echo the sentiment but setting boundaries is key and girlie did just that.\n\n\n---\n\n**Tweet ID**: 1915204874460897688\n\n**Date**: 4/23/2025, 7:43:19 PM\n\n**Engagement**: Likes: 0 | Retweets: 0 | Replies: 0\n\n**Content**:\n@LMNLAgent @AskPerplexity @MindAIAGENT @IcilyDeliv49476 @duckunfiltered @xDora_ai @SaitoshiAgent @BasedReplyBot @V1PunksGuide @Klaus_Agent @SimulacrumAI @Heket_Ai @InfiniteAgentAI @CharacterXAI @HinagiAI @BellaAI_agent @dreamgirl_agent @seraphagent @mvx_agent @STai_agent @Evan_AI_Agent @AMetaXbt @BullsharkAgent @AgentApolloAI @DrPepeai_Agent @chckdotai @athena_tball @XyroAI @funtransferAI @TrumpAi @AndyBNBAgent Show more
# The response data is json:
# {
#     "thinking": "Okay, I need to figure out the current sentiment for X based on these tweets. Let me go through each one by one.\n\nFirst, I see a lot of tweets mentioning the \"Belief Index.\" It seems like they're talking about how it measures community conviction through on-chain behavior, smart money activity, and social sentiment. That sounds positive because it's about tracking conviction and making informed decisions. So that's a positive sentiment.\n\nThen there's a tweet where someone is echoing a sentiment about setting boundaries, which is neutral. It's just agreeing with something but not expressing a strong emotion either way.\n\nAnother tweet mentions gratitude and passing on a \"lovely sentiment,\" which is positive. It's appreciative and warm.\n\nI also noticed some tweets about making money in the stock market despite unstable market sentiment. The users are sharing success stories, which indicates a positive outlook and confidence in their investments.\n\nHowever, one tweet talks about politics and how everything is political, which could be seen as neutral or a bit negative, but it's more of an observation than a strong sentiment.\n\nPutting it all together, most of the tweets are positive or neutral. The discussions around the Belief Index and successful investments are uplifting, while the other tweets don't show strong negative feelings. So overall, the sentiment is leaning towards positive with a focus on community conviction and financial success.",
#     "analysis": "The current sentiment for X is predominantly positive, with a focus on community conviction and strategic decision-making. The Belief Index is highlighted as a key tool for measuring this conviction through on-chain behavior, smart money activity, and social sentiment. Additionally, there are positive mentions of financial success and gratitude. Overall, the sentiment is optimistic and forward-looking."
# }

import json
import time
from typing import Dict, Any, Optional

import requests

from config import get_masa_api_key


def make_post_call(url: str, request_body: Dict[str, Any], api_key: str = None,
                   headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """
    Make an HTTP POST request to the specified URL with a JSON request body and optional API key.

    Args:
        url (str): The URL to send the request to.
        request_body (Dict[str, Any]): The JSON request body to send.
        api_key (str, optional): API key to be included as a Bearer token.
        headers (Optional[Dict[str, str]]): Additional headers to include in the request.
                                           Default Content-Type will be application/json.

    Returns:
        Dict[str, Any]: The JSON response from the server.

    Raises:
        requests.exceptions.RequestException: If the API request fails.
        json.JSONDecodeError: If the response is not valid JSON.
    """
    # Initialize headers if None
    if headers is None:
        headers = {}

    # Ensure Content-Type is set for JSON
    if "Content-Type" not in headers:
        headers["Content-Type"] = "application/json"

    # Add Bearer token authorization if API key is provided
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        # Make the POST request
        response = requests.post(
            url=url,
            data=json.dumps(request_body),
            headers=headers
        )

        # Raise an exception for bad status codes
        response.raise_for_status()

        # Parse and return the JSON response
        return response.json()

    except requests.exceptions.RequestException as e:
        print(f"API request failed: {e}")
        raise
    except json.JSONDecodeError as e:
        print(f"Failed to decode JSON response: {e}")
        raise


def make_get_call(url: str, api_key: str, headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """
    Make an HTTP GET request to the specified URL.

    Args:
        url (str): The URL to send the request to.
        api_key (str): API key to be included as a Bearer token.
        headers (Optional[Dict[str, str]]): Additional headers to include in the request.

    Returns:
        Dict[str, Any]: The JSON response from the server.
    """

    # Initialize headers if None
    if headers is None:
        headers = {}

    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        # Make the GET request
        response = requests.get(url, headers=headers)

        # Raise an exception for bad status codes
        response.raise_for_status()

        # Parse and return the JSON response
        return response.json()

    except requests.exceptions.RequestException as e:
        print(f"API request failed: {e}")
        raise


def call_extraction_api(user_input: str, api_key: str = None) -> Dict[str, Any]:
    """
    Call the extraction API with the provided user input.

    Args:
        user_input (str): The user input to send to the API.
        api_key (str, optional): API key to authenticate with the service.

    Returns:
        Dict[str, Any]: A dictionary containing the full response from the API.
    """
    url = "https://data.dev.masalabs.ai/api/v1/search/extraction"
    request_body = {"userInput": user_input}

    # Use our reusable function to make the API call
    response_data = make_post_call(url, request_body, api_key)

    return response_data


# https://data.dev.masalabs.ai/api/v1/search/live/twitter with POST method, request body of
# #    {"query":"sentiment","type":"searchbyquery","max_results":10}
def search_live_twitter(query: str, api_key: str = None) -> Dict[str, Any]:
    """
    Call the live Twitter search API with the provided query.

    Args:
        query (str): The search query to send to the API.
        api_key (str, optional): API key to authenticate with the service.

    Returns:
        Dict[str, Any]: A dictionary containing the full response from the API.
    """
    url = "https://data.dev.masalabs.ai/api/v1/search/live/twitter"
    request_body = {"query": query, "type": "searchbyquery", "max_results": 10}

    # Use our reusable function to make the API call
    response_data = make_post_call(url, request_body, api_key)

    return response_data


MASA_API_KEY = get_masa_api_key()


# Example usage
def check_status(search_uuid: str) -> str:
    """
    Check the status of a search operation using the provided UUID.

    Args:
        search_uuid (str): The UUID of the search operation to check.

    Returns:
        done or error or timeout
    """
    # # 3. call the api https://data.dev.masalabs.ai/api/v1/search/live/twitter/status/451fef48-afe1-4cd0-a4c4-4874cb74ea27 to
    url = f"https://data.dev.masalabs.ai/api/v1/search/live/twitter/status/{search_uuid}"

    # retry until the status is done
    for i in range(10):
        response_data = make_get_call(url, MASA_API_KEY)
        print(f"Status Response: {response_data}")

        # Check if status is done
        status = response_data.get("status")
        if status == "done":
            print("Search completed successfully.")
            return "done"
        elif status == "error":
            print("An error occurred during the search.")
            return "error"
        else:
            print("Search is still in progress. Retrying...")
            # Sleep for a while before retrying
            time.sleep(5)

    print("Max retries reached. Exiting.")
    return "timeout"


def get_search_result(search_uuid: str):
    # 4. call the api https://data.dev.masalabs.ai/api/v1/search/live/twitter/result/451fef48-afe1-4cd0-a4c4-4874cb74ea27
    #    to get the result, the response data has data field in json form
    url = f"https://data.dev.masalabs.ai/api/v1/search/live/twitter/result/{search_uuid}"
    response_data = make_get_call(url, MASA_API_KEY)
    print(f"Search Result: {response_data}")
    return response_data


def format_tweet_info(tweet_data):
    """
    Format tweet information into a readable string.

    Args:
        tweet_data (dict): Dictionary containing tweet information

    Returns:
        str: Formatted string with tweet details
    """
    try:
        # Create the formatted string using the tweet data
        formatted_text = (
            f"Tweet ID: {tweet_data['ID']}\n"
            f"Date: {tweet_data['Metadata']['created_at']}\n"
            f"Engagement: Likes: {tweet_data['Metadata']['public_metrics']['LikeCount']} | "
            f"Retweets: {tweet_data['Metadata']['public_metrics']['RetweetCount']} | "
            f"Replies: {tweet_data['Metadata']['public_metrics']['ReplyCount']}\n"
            f"Content: {tweet_data['Content']}\n\n---\n"
        )

        return formatted_text

    except KeyError as e:
        # Handle missing keys in the tweet data
        return f"Error formatting tweet: Missing key {e}"


def call_analysis(analysis_input: Dict[str, Any],  # {"tweets": tweets, "prompt": user_input}
                  api_key: str = None) -> Dict[str, Any]:
    """
    Call the analysis API with the provided tweets.

    Args:
        analysis_input (dict): The tweets and prompt to send to the API.
        api_key (str, optional): API key to authenticate with the service.

    Returns:
        Dict[str, Any]: A dictionary containing the full response from the API.
    """
    url = "https://data.dev.masalabs.ai/api/v1/search/analysis"

    # Use our reusable function to make the API call
    response_data = make_post_call(url, analysis_input, api_key)

    return response_data


def format_search_result(original_query: str,
                         optimized_query: str,
                         search_result):
    # "- **Original Query**: \"what is the current sentiment on X for the SOL crypto token\"\n- **Optimized Query**: \"sentiment SOL\"\n- **Total Tweets**: 10\n\n\n---\n\n**Tweet ID**: 1915206561485533624\n\n**Date**: 4/23/2025, 7:50:01 PM\n\n**Engagement**: Likes: 0 | Retweets: 0 | Replies: 0\n\n**Content**:\nTop 3 Bullish Sentiment Cryptos: CROWD\n\n 🟩 $DOG $SRC $MEME\n\nTop 3 Bullish Cryptos: MP\n\n 🟩 $SOL\n    \nCheck out sentiment and other crypto stats at https://t.co/HQDyBNuzek\n\n\n---\n\n
    # create a string with the above format using data from search_result which is a list of dicts
    count = len(search_result) if search_result else 0
    full_text = f"- **Original Query**: \"{original_query}\"\n- **Optimized Query**: \"{optimized_query}\"\n- **Total Tweets**: {count}\n\n\n---\n\n"

    for r in search_result:
        tweet_data = r
        formatted_text = format_tweet_info(tweet_data)
        full_text += formatted_text
    return full_text


def get_sentiment_for_token(token: str) -> str:
    try:
        user_input = f"What is the current sentiment on X about {token}?"
        extraction_result = call_extraction_api(user_input, MASA_API_KEY)
        print(f"Search Term: {extraction_result.get('searchTerm')}")
        search_term = extraction_result.get('searchTerm')
        # search live twitter
        search_response = search_live_twitter(search_term, MASA_API_KEY)
        print(f"Twitter Search Response: {search_response}")
        search_uuid = search_response.get('uuid')
        # check status
        search_status = check_status(search_uuid)

        if search_status == 'done':
            search_result = get_search_result(search_uuid)
            tweets = format_search_result(original_query=user_input,
                                          optimized_query=search_term,
                                          search_result=search_result)
            analysis_input = {}
            analysis_input['tweets'] = tweets
            analysis_input['prompt'] = user_input
            ## call analysis API with formated
            analysis_result = call_analysis(analysis_input, MASA_API_KEY)
            # print(f"Analysis Result: {analysis_result}")
            return analysis_result.get('analysis')

    except Exception as e:
        print(f"An error occurred: {e}")
        return "Error occurred while fetching sentiment."


if __name__ == "__main__":
    # Example usage
    token_symbol = "SOL"
    sentiment = get_sentiment_for_token(token_symbol)
    print(f"Sentiment for {token_symbol}: {sentiment}")
