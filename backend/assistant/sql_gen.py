# assistant/sql_gen.py
import os, re
from functools import lru_cache
from typing import Optional
from django.db import transaction
from pgvector.django import CosineDistance
from openai import OpenAI

from .models import FAQSQLCache
from .embeddings import embed

CACHE_HIT_DISTANCE = 0.15

SCHEMA_PROMPT = """You are an intelligent SQL assistant for an inventory management system.
Return ONLY a valid PostgreSQL SELECT query (no prose, no backticks).

### Database schema (all lowercase identifiers)
1) inventory_category(id, name, parent_id, custom_fields jsonb, created_at, updated_at)
2) inventory_location(id, name, type, parent_id, capacity, path, created_at, updated_at)
   - type ∈ {'site','room','shelf','box','row','slot'}
   - path is a breadcrumb like 'site a > room a1 > shelf 1 > row 2 > box b > slot 1'
3) inventory_inventoryitem(
   id, name, description, category_id, status, price numeric(12,2),
   thumbnail, images jsonb, date_added date, location_id, notes,
   is_consigned boolean, weight numeric(10,3), weight_unit,
   attributes jsonb, created_at, updated_at
)
- status ∈ {'in_store','in_transit','consigned','sold','ebay'}
- attributes/custom_fields are jsonb

### Rules
- Single safe SELECT only; no DDL/DML; no code fences; no explanations.
- Use lowercase identifiers and lowercase string literals where reasonable.
- Prefer explicit JOINs with clear aliases.
- Respect negations/exclusions (e.g., items missing location → location_id IS NULL).
- Use aggregates (count/sum/avg) with GROUP BY when asked; add readable aliases (AS total_items, AS avg_price).
- Dates: use date_added or updated_at when needed.
- JSON: use -> (json) and ->> (text); key existence with ? or ?|.

### Rules for Dynamic Value Extraction
- CRITICAL: Extract the EXACT location name from the user query. If the user asks for 'shelf 2', the SQL must use 'shelf 2'. Do NOT default to 'shelf 1' or any other example value.
- Parameter substitution: The string following "under", "in", or "on" is the target value. Use it exactly in the ILIKE clause.

### Hierarchy (IMPORTANT)
- The inventory_location.path column represents the hierarchy (e.g., 'Site > Room > Shelf').
- To select items under a location, use: WHERE l.path ILIKE '%' || '{extracted_value}' || '%'
- Ensure '{extracted_value}' is replaced by the specific term from the user's request (e.g., 'shelf 2', 'box b', 'room a1').

### Output format
Examples are for logic reference ONLY; always use values from the CURRENT user query.
- User: "list items under shelf 2" -> SQL: ... WHERE l.path ILIKE '%shelf 2%'
- User: "show items in box b" -> SQL: ... WHERE l.path ILIKE '%box b%'

### Prices
- Prices are stored in inventory_inventoryitem.price.

### Common joins
- inventory_inventoryitem ii ↔ inventory_category c: ii.category_id = c.id
- inventory_inventoryitem ii ↔ inventory_location l: ii.location_id = l.id

### Output format
Examples — do not over-query columns if not requested.
| User query                 | Output columns        |
| -------------------------- | --------------------- |
| list items under shelf 1   | name                  |
| list coin names in room a1 | name                  |
| show item names on shelf 2 | name                  |
| list items with prices     | name, price           |
| list items and location    | name, location_path   |

- Only the SELECT query, no trailing semicolon.
"""

def _clean_sql(s: str) -> str:
    s = s.strip()
    s = re.sub(r"^```sql\s*|\s*```$", "", s, flags=re.IGNORECASE)
    s = re.sub(r"^```\s*|\s*```$", "", s)
    return s.strip().rstrip(";")

def _is_safe_select(sql: str) -> bool:
    sql_l = sql.lower().strip()
    if sql_l.startswith("with"):
        if " select" not in sql_l:
            return False
    elif not sql_l.startswith("select"):
        return False
    forbidden = (" insert ", " update ", " delete ", " drop ", " alter ", " truncate ", ";--", "/*")
    return not any(tok in sql_l for tok in forbidden)

def _enforce_location_tokens(question: str, sql: str) -> str:
    """Ensure numeric location tokens (e.g., 'shelf 2', 'row 3') in the question
    are preserved in the produced SQL by aligning any mismatched occurrences.
    This is a light, safety-focused post-fix and only adjusts obvious cases.
    """
    sl = sql
    ql = question.lower()

    def fix(token: str, pattern: str, s: str) -> str:
        m = re.search(pattern, ql, flags=re.IGNORECASE)
        if not m:
            return s
        target = f"{token} {m.group(1)}"
        # Replace any occurrence of the token followed by a number with the target
        return re.sub(rf"{token}\\s+\\d+", target, s, flags=re.IGNORECASE)

    sl = fix("shelf", r"shelf\\s+(\\d+)", sl)
    sl = fix("row", r"row\\s+(\\d+)", sl)
    return sl

@lru_cache(maxsize=1)
def _get_openai() -> OpenAI:
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        # raise with a helpful message only when we actually need the client
        raise RuntimeError("OPENAI_API_KEY is not set. Ensure .env is loaded before calling SQL generation.")
    return OpenAI(api_key=key)

@transaction.atomic
def get_sql_query(question: str, category: str = "") -> str:
    q_emb = embed(question)

    nearest = (FAQSQLCache.objects
               .annotate(dist=CosineDistance("embedding", q_emb))
               .order_by("dist")
               .values("id","question","sql","dist")
               .first())

    if nearest and nearest["dist"] is not None and float(nearest["dist"]) <= CACHE_HIT_DISTANCE:
        return nearest["sql"]

    # LLM fallback (lazy client creation happens here, not at import)
    client = _get_openai()
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SCHEMA_PROMPT},
            {"role": "user", "content": question},
        ],
        temperature=0.0,
        timeout=15,
    )
    raw = resp.choices[0].message.content or ""
    sql = _clean_sql(raw)
    sql = _enforce_location_tokens(question, sql)

    if not _is_safe_select(sql):
        resp2 = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SCHEMA_PROMPT},
                {"role": "user", "content": f"Return ONLY a SELECT (no text). Question: {question}"},
            ],
            temperature=0.0,
            timeout=15,
        )
        sql = _clean_sql(resp2.choices[0].message.content or "")
        if not _is_safe_select(sql):
            raise ValueError("Model did not return a safe SELECT query.", sql)

    FAQSQLCache.objects.update_or_create(
        question=question.strip(),
        defaults={"sql": sql, "embedding": q_emb, "category": (category or "").strip().lower()},
    )
    return sql
