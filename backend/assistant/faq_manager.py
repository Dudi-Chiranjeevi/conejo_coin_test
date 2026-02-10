"""
FAQ Manager for the AI Assistant
Handles FAQ storage, retrieval, and embedding operations
"""
import os
from functools import lru_cache
from django.db import transaction
from pgvector.django import CosineDistance
from openai import OpenAI
from dotenv import load_dotenv

from .models import FAQSQLCache
from .embeddings import embed

# Similarity threshold for considering a match in the vector database
CACHE_HIT_DISTANCE = 0.15

load_dotenv()

@lru_cache(maxsize=1)
def _get_openai() -> OpenAI:
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise RuntimeError("OPENAI_API_KEY is not set. Ensure .env is loaded before calling SQL generation.")
    return OpenAI(api_key=key)

@transaction.atomic
def get_faq_sql(question: str, category: str = "", force_refresh: bool = False) -> str:
    """
    Get SQL for a question from the FAQ cache or generate it using OpenAI
    
    Args:
        question: The natural language question
        category: Optional category for the FAQ
        
    Returns:
        SQL query string
    """
    # Generate embedding for the question
    q_emb = embed(question)
    
    nearest = None
    if not force_refresh:
        # Search for similar questions in the database
        nearest = (
            FAQSQLCache.objects
            .annotate(dist=CosineDistance("embedding", q_emb))
            .order_by("dist")
            .values("id", "question", "sql", "dist")
            .first()
        )
        
        # If we found a close match, return the cached SQL
        if nearest and nearest["dist"] is not None and float(nearest["dist"]) <= CACHE_HIT_DISTANCE:
            print(f"✅ Using cached SQL from database for: {question}")
            return nearest["sql"]
    else:
        print(f"🔁 force_refresh requested; bypassing FAQ cache for: {question}")
    
    # Otherwise, generate SQL using OpenAI
    print(f"⚠️ Fallback to OpenAI for SQL generation: {question}")
    from .sql_gen import get_sql_query
    
    # Generate SQL using the existing function
    sql = get_sql_query(question, category)
    
    # Cache the result
    FAQSQLCache.objects.update_or_create(
        question=question.strip(),
        defaults={"sql": sql, "embedding": q_emb, "category": (category or "").strip().lower()},
    )
    
    return sql

def add_faq(question: str, sql: str, category: str = "") -> None:
    """
    Add a FAQ to the database with its SQL and embedding
    
    Args:
        question: The natural language question
        sql: The SQL query that answers the question
        category: Optional category for the FAQ
    """
    q_emb = embed(question)
    
    FAQSQLCache.objects.update_or_create(
        question=question.strip(),
        defaults={"sql": sql, "embedding": q_emb, "category": (category or "").strip().lower()},
    )

def get_all_faqs(category: str = None):
    """
    Get all FAQs, optionally filtered by category
    
    Args:
        category: Optional category to filter by
        
    Returns:
        QuerySet of FAQSQLCache objects
    """
    if category:
        return FAQSQLCache.objects.filter(category=category.lower())
    return FAQSQLCache.objects.all()

def delete_faq(faq_id: int) -> bool:
    """
    Delete a FAQ by ID
    
    Args:
        faq_id: The ID of the FAQ to delete
        
    Returns:
        True if deleted, False if not found
    """
    try:
        faq = FAQSQLCache.objects.get(id=faq_id)
        faq.delete()
        return True
    except FAQSQLCache.DoesNotExist:
        return False
