"""
Price estimator module using an expert numismatist prompt.
Builds a fixed prompt from structured inputs and returns a concise,
non-binding pricing estimate based on historical patterns.
"""
from __future__ import annotations

import os
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

PROMPT_TEMPLATE = (
    "You are an expert numismatist. I have a certified coin with the following information:\n"
    "Certification Service: NGC\n"
    "Certification Number: [INSERT NUMBER]\n"
    "Description: [INSERT DESCRIPTION]\n"
    "Grade: [INSERT GRADE]\n"
    "Holder Condition: The NGC holder is in excellent condition with no cracks, chips, haze, or label damage.\n"
    "I need an estimated selling price based on historical data (searched from marketplaces like Heritage Auctions, eBay sold listings, Stack's Bowers, GreatCollections, Catawiki, PCGS CoinFacts, Coin World). Be truthful: If no recent sales (last 12–24 months) or limited data exist for this exact coin/grade, state this clearly upfront. Do not fabricate sales records. Base estimates on verified historical patterns only, noting LLM predictions are not real-time and cannot scrape live data. Use the actual date range of data found (e.g., \"Mar 2015–Jul 2023\").\n"
    "Return the following:\n"
    "A brief summary of comparable historical sale prices (e.g., [actual found range like \"Jan 2018–Dec 2024\"]: $X–$Y; note any gaps, like no data in last 12–24 months).\n"
    "A recommended selling price range if I were to sell it myself (e.g., based on [actual found range] historical average: $X–$Y), with clear disclaimers if data is sparse.\n"
    "A concise explanation of how you arrived at this recommendation, including:\n"
    "Market trends (e.g., from data-found range)\n"
    "Collector demand\n"
    "Influence of holder condition\n"
    "Comparable coins in same grade/series (or note if none found)\n"
    "Truthful disclosure: \"No sales found in last 12–24 months [or specify]; this is an AI estimate from historical patterns in [actual range], not live market data—verify manually on listed sites.\"\n"
    "Keep the response concise, practical for online/in-person selling, and flagged as non-binding advice."
)


def _get_openai() -> OpenAI:
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Ensure .env is loaded before calling price estimation."
        )
    return OpenAI(api_key=key)


def build_prompt(cert_number: str, description: str, grade: str) -> str:
    """Embed user-provided fields into the fixed expert numismatist template."""
    prompt = PROMPT_TEMPLATE
    prompt = prompt.replace("[INSERT NUMBER]", cert_number.strip())
    prompt = prompt.replace("[INSERT DESCRIPTION]", description.strip())
    prompt = prompt.replace("[INSERT GRADE]", grade.strip())
    return prompt


def get_price_estimate(
    cert_number: str,
    description: str,
    grade: str,
    history: Optional[List[Dict[str, Any]]] = None,
    temperature: float = 0.1,
    timeout: int = 20,
) -> str:
    """
    Call the model with the built prompt and return a concise, non-binding estimate text.

    history: optional chat history if you want to preserve context across turns.
    Returns: response text (string)
    """
    client = _get_openai()
    sys = (
        "You are an expert numismatist. Provide non-binding estimates based on historical data; "
        "be truthful about data limitations and time ranges."
    )
    prompt = build_prompt(cert_number, description, grade)

    messages: List[Dict[str, str]] = [{"role": "system", "content": sys}]
    if history:
        # expect history as [{role: "user"|"assistant", content: str}, ...]
        messages.extend(history)
    messages.append({"role": "user", "content": prompt})

    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        temperature=temperature,
        timeout=timeout,
    )
    return resp.choices[0].message.content or ""
