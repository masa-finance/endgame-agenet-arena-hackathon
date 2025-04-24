#!/usr/bin/env python
import streamlit as st
import asyncio
import json
import nest_asyncio
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from contextlib import AsyncExitStack
from langchain_mcp_adapters.tools import load_mcp_tools
from langgraph.prebuilt import create_react_agent
from langchain_google_genai import ChatGoogleGenerativeAI
import plotly.graph_objects as go

# Apply nest_asyncio for async handling in Streamlit
nest_asyncio.apply()

# Server Configuration
SERVER_CONFIG = {
    "command": "python",
    "args": ["mcp_defi_server.py"]
}

async def initialize_agent():
    llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash", temperature=0.2)
    async with AsyncExitStack() as stack:
        read, write = await stack.enter_async_context(
            stdio_client(StdioServerParameters(**SERVER_CONFIG)))
        session = await stack.enter_async_context(ClientSession(read, write))
        await session.initialize()
        tools = await load_mcp_tools(session)
        return create_react_agent(llm, tools)

async def process_query(query: str):
    agent = await initialize_agent()
    response = await agent.ainvoke({"messages": query})
    return next((msg.content for msg in reversed(response["messages"]) 
                if hasattr(msg, "content")), None)

# Streamlit UI
st.set_page_config(page_title="DeFi Portfolio Guardian", layout="wide")
st.title("🛡️ DeFi Portfolio Guardian")

# Async helper function
async def run_async_operations():
    # Portfolio Input
    with st.sidebar:
        st.subheader("Your Portfolio")
        portfolio = {}
        cols = st.columns(2)
        for i in range(5):
            with cols[i%2]:
                token = st.text_input(f"Token {i+1}", key=f"token{i}")
                amount = st.number_input(f"Amount", min_value=0.0, key=f"amt{i}")
                if token and amount > 0:
                    portfolio[token] = {"amount": amount}

    # Main Interface
    tab1, tab2, tab3 = st.tabs(["Analysis", "Optimization", "Opportunities"])

    with tab1:
        if st.button("Analyze Portfolio"):
            with st.spinner("Assessing portfolio risks..."):
                analysis = await process_query(f"ASSESS_PORTFOLIO_RISK {json.dumps(portfolio)}")
                st.session_state.risk = eval(analysis)
                
        if 'risk' in st.session_state:
            st.subheader("Risk Analysis")
            fig = go.Figure(go.Indicator(
                mode="gauge+number",
                value=st.session_state.risk['risk_score'],
                domain={'x': [0, 1], 'y': [0, 1]},
                title={'text': "Portfolio Risk Score"}
            ))
            st.plotly_chart(fig, use_container_width=True)

    with tab2:
        if st.button("Optimize Allocation"):
            with st.spinner("Calculating optimal strategy..."):
                optimization = await process_query(
                    f"OPTIMIZE_PORTFOLIO {json.dumps(portfolio)} conservative"
                )
                st.session_state.optimization = eval(optimization)
        
        if 'optimization' in st.session_state:
            st.subheader("Recommended Adjustments")
            fig = go.Figure(data=[go.Pie(
                labels=list(st.session_state.optimization.keys()),
                values=list(st.session_state.optimization.values())
            )])
            st.plotly_chart(fig, use_container_width=True)

    with tab3:
        if st.button("Find Yield Opportunities"):
            with st.spinner("Scanning liquidity pools..."):
                opportunities = await process_query("FIND_LIQUIDITY_POOLS 0.25")
                st.session_state.pools = eval(opportunities)
        
        if 'pools' in st.session_state:
            st.subheader("Top Yield Opportunities")
            for pool in st.session_state.pools:
                with st.expander(f"{pool['platform']} - {pool['apr']}% APR"):
                    st.write(f"**Assets:** {pool['pair']}")
                    st.write(f"**TVL:** ${pool['tvl']:,}")
                    st.write(f"**Risk Level:** {pool['risk']}/5")

if __name__ == "__main__":
    asyncio.run(run_async_operations())