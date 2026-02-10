"""
Management command to initialize FAQs in the database with comprehensive questions
organized by category and leveraging the JSON structure of the inventory system.
"""
import json
from django.core.management.base import BaseCommand
from assistant.faq_manager import add_faq

# Comprehensive FAQs with their SQL queries organized by category
INITIAL_FAQS = [
    # ===== OVERVIEW CATEGORY =====
    {
        "question": "How many items do we have in inventory?",
        "sql": "SELECT COUNT(*) AS total_items FROM inventory_inventoryitem",
        "category": "overview"
    },
    {
        "question": "What's my total inventory value by category?",
        "sql": "SELECT c.name AS category_name, SUM(ii.price) AS total_value FROM inventory_category c JOIN inventory_inventoryitem ii ON c.id = ii.category_id GROUP BY c.name ORDER BY total_value DESC",
        "category": "overview"
    },
    {
        "question": "What's my inventory growth this month?",
        "sql": "SELECT COUNT(*) AS new_items FROM inventory_inventoryitem WHERE date_added >= date_trunc('month', CURRENT_DATE)",
        "category": "overview"
    },
    {
        "question": "Show me a summary of items by status",
        "sql": "SELECT status, COUNT(*) AS item_count, SUM(price) AS total_value FROM inventory_inventoryitem GROUP BY status ORDER BY item_count DESC",
        "category": "overview"
    },
    {
        "question": "What's the average price of items in my inventory?",
        "sql": "SELECT AVG(price) AS average_price FROM inventory_inventoryitem WHERE price > 0",
        "category": "overview"
    },
    {
        "question": "How many items were added in each month of this year?",
        "sql": "SELECT TO_CHAR(date_added, 'Month') AS month, COUNT(*) AS item_count FROM inventory_inventoryitem WHERE date_added >= date_trunc('year', CURRENT_DATE) GROUP BY TO_CHAR(date_added, 'Month'), date_part('month', date_added) ORDER BY date_part('month', date_added)",
        "category": "overview"
    },
    
    # ===== LOCATION CATEGORY =====
    {
        "question": "Find items with missing location data",
        "sql": "SELECT id, name, price FROM inventory_inventoryitem WHERE location_id IS NULL",
        "category": "location"
    },
    {
        "question": "Which locations have the most valuable items?",
        "sql": "SELECT l.name AS location_name, l.path AS location_path, COUNT(ii.id) AS item_count, SUM(ii.price) AS total_value FROM inventory_location l JOIN inventory_inventoryitem ii ON l.id = ii.location_id GROUP BY l.id, l.name, l.path ORDER BY total_value DESC LIMIT 10",
        "category": "location"
    },
    {
        "question": "How many items are in each location type?",
        "sql": "SELECT l.type AS location_type, COUNT(ii.id) AS item_count FROM inventory_location l JOIN inventory_inventoryitem ii ON l.id = ii.location_id GROUP BY l.type ORDER BY item_count DESC",
        "category": "location"
    },
    {
        "question": "Show me all items in Site A",
        "sql": "SELECT ii.name, ii.price, l.path FROM inventory_inventoryitem ii JOIN inventory_location l ON ii.location_id = l.id WHERE l.path LIKE 'Site A%' OR l.name = 'Site A'",
        "category": "location"
    },
    {
        "question": "Which boxes are nearly full?",
        "sql": "SELECT l.name, l.path, l.capacity, COUNT(ii.id) AS item_count, (COUNT(ii.id)::float / l.capacity) * 100 AS percent_full FROM inventory_location l JOIN inventory_inventoryitem ii ON l.id = ii.location_id WHERE l.type = 'box' AND l.capacity IS NOT NULL GROUP BY l.id, l.name, l.path, l.capacity HAVING (COUNT(ii.id)::float / l.capacity) >= 0.8 ORDER BY percent_full DESC",
        "category": "location"
    },
    {
        "question": "How many platinum coins are in Box 2B?",
        "sql": "SELECT COUNT(*) AS platinum_coin_count FROM inventory_inventoryitem ii JOIN inventory_location l ON ii.location_id = l.id WHERE (ii.attributes->'coin'->>'metal_type' ILIKE '%platinum%' OR ii.name ILIKE '%platinum%') AND (l.path ILIKE '%Box 2B%' OR (l.name = '2B' AND l.type = 'box'))",
        "category": "location"
    },
    
    # ===== PRICING CATEGORY =====
    {
        "question": "What are the top 5 most expensive items?",
        "sql": "SELECT name, price, status FROM inventory_inventoryitem ORDER BY price DESC LIMIT 5",
        "category": "pricing"
    },
    {
        "question": "What's the average price of 1880-S Morgan Dollars?",
        "sql": "SELECT AVG(price) AS average_price FROM inventory_inventoryitem WHERE (attributes->'coin'->>'year' = '1880' AND attributes->'coin'->>'mint_mark' = 'S' AND attributes->'coin'->>'denomination' = 'DOLLAR') OR name ILIKE '%1880-S%Morgan%Dollar%'",
        "category": "pricing"
    },
    {
        "question": "Show me items priced between $1000 and $5000",
        "sql": "SELECT name, price, status FROM inventory_inventoryitem WHERE price BETWEEN 1000 AND 5000 ORDER BY price DESC",
        "category": "pricing"
    },
    {
        "question": "What's the total value of consigned items?",
        "sql": "SELECT SUM(price) AS total_consigned_value FROM inventory_inventoryitem WHERE is_consigned = true OR status = 'consigned'",
        "category": "pricing"
    },
    {
        "question": "Which category has the highest average item price?",
        "sql": "SELECT c.name AS category_name, AVG(ii.price) AS average_price, COUNT(ii.id) AS item_count FROM inventory_category c JOIN inventory_inventoryitem ii ON c.id = ii.category_id GROUP BY c.name HAVING COUNT(ii.id) >= 3 ORDER BY average_price DESC LIMIT 5",
        "category": "pricing"
    },
    
    # ===== RECENT CATEGORY =====
    {
        "question": "Show me all items added this week",
        "sql": "SELECT name, price, date_added FROM inventory_inventoryitem WHERE date_added >= CURRENT_DATE - INTERVAL '7 days' ORDER BY date_added DESC",
        "category": "recent"
    },
    {
        "question": "What items were updated in the last 24 hours?",
        "sql": "SELECT name, price, updated_at FROM inventory_inventoryitem WHERE updated_at >= NOW() - INTERVAL '24 hours' ORDER BY updated_at DESC",
        "category": "recent"
    },
    {
        "question": "Show me the most recently added items from each category",
        "sql": "WITH ranked_items AS (SELECT ii.name, ii.price, c.name AS category_name, ii.date_added, ROW_NUMBER() OVER (PARTITION BY ii.category_id ORDER BY ii.date_added DESC) AS rn FROM inventory_inventoryitem ii JOIN inventory_category c ON ii.category_id = c.id) SELECT name, price, category_name, date_added FROM ranked_items WHERE rn = 1 ORDER BY date_added DESC",
        "category": "recent"
    },
    
    # ===== GRADING CATEGORY =====
    {
        "question": "List all NGC graded coins above MS-65",
        "sql": "SELECT name, attributes->'coin'->'grade'->>'display' AS grade FROM inventory_inventoryitem WHERE attributes->'coin'->'grade'->>'service' = 'NGC' AND (attributes->'coin'->'grade'->>'display' LIKE 'MS-6%' OR attributes->'coin'->'grade'->>'display' LIKE 'MS-7%' OR attributes->'coin'->'grade'->>'display' LIKE 'PF-6%' OR attributes->'coin'->'grade'->>'display' LIKE 'PF-7%')",
        "category": "grading"
    },
    {
        "question": "How many coins do I have by grade level?",
        "sql": "SELECT SUBSTRING(attributes->'coin'->'grade'->>'display' FROM 1 FOR 4) AS grade_level, COUNT(*) AS coin_count FROM inventory_inventoryitem WHERE attributes->'coin'->'grade'->>'display' IS NOT NULL GROUP BY grade_level ORDER BY grade_level",
        "category": "grading"
    },
    {
        "question": "Show me all PCGS graded coins",
        "sql": "SELECT name, attributes->'coin'->'grade'->>'display' AS grade FROM inventory_inventoryitem WHERE attributes->'coin'->'grade'->>'service' = 'PCGS'",
        "category": "grading"
    },
    {
        "question": "What's the average price by grade for Morgan Dollars?",
        "sql": "SELECT attributes->'coin'->'grade'->>'display' AS grade, AVG(price) AS average_price, COUNT(*) AS count FROM inventory_inventoryitem WHERE name ILIKE '%Morgan%Dollar%' OR attributes->'coin'->>'denomination' = 'DOLLAR' AND attributes->'coin'->>'variety' ILIKE '%Morgan%' GROUP BY grade HAVING COUNT(*) > 1 ORDER BY average_price DESC",
        "category": "grading"
    },
    {
        "question": "How many coins have special labels or designations?",
        "sql": "SELECT attributes->'coin'->'grade'->>'label' AS special_label, COUNT(*) AS coin_count FROM inventory_inventoryitem WHERE attributes->'coin'->'grade'->>'label' IS NOT NULL AND attributes->'coin'->'grade'->>'label' != '' GROUP BY special_label ORDER BY coin_count DESC",
        "category": "grading"
    },
    
    # ===== ANALYSIS CATEGORY =====
    {
        "question": "What's the distribution of coins by country?",
        "sql": "SELECT attributes->'coin'->>'mint_mark' AS country, COUNT(*) AS coin_count FROM inventory_inventoryitem WHERE attributes->'coin'->>'mint_mark' IS NOT NULL GROUP BY country ORDER BY coin_count DESC",
        "category": "analysis"
    },
    {
        "question": "Which decades have the most coins in my collection?",
        "sql": "SELECT FLOOR(attributes->'coin'->>'year'::numeric / 10) * 10 AS decade, COUNT(*) AS coin_count FROM inventory_inventoryitem WHERE attributes->'coin'->>'year' ~ '^[0-9]+$' GROUP BY decade ORDER BY decade",
        "category": "analysis"
    },
    {
        "question": "What's the weight distribution of my gold coins?",
        "sql": "SELECT weight, weight_unit, COUNT(*) AS coin_count FROM inventory_inventoryitem WHERE (attributes->'coin'->>'metal_type' ILIKE '%gold%' OR name ILIKE '%gold%') AND weight IS NOT NULL GROUP BY weight, weight_unit ORDER BY weight",
        "category": "analysis"
    },
    {
        "question": "Show me the variety distribution for Lincoln cents",
        "sql": "SELECT attributes->'coin'->>'variety' AS variety, COUNT(*) AS coin_count FROM inventory_inventoryitem WHERE name ILIKE '%Lincoln%cent%' OR (attributes->'coin'->>'denomination' = '1C' AND attributes->'coin'->>'variety' ILIKE '%Lincoln%') GROUP BY variety ORDER BY coin_count DESC",
        "category": "analysis"
    },
    {
        "question": "What's the total weight of my silver inventory?",
        "sql": "SELECT SUM(weight) AS total_weight, weight_unit FROM inventory_inventoryitem WHERE (attributes->'coin'->>'metal_type' ILIKE '%silver%' OR name ILIKE '%silver%') AND weight IS NOT NULL GROUP BY weight_unit",
        "category": "analysis"
    },
    
    # ===== SPECIALIZED QUERIES =====
    {
        "question": "Show me all Indian coins in my collection",
        "sql": "SELECT name, price, attributes->'coin'->'grade'->>'display' AS grade FROM inventory_inventoryitem WHERE attributes->'coin'->>'mint_mark' = 'INDIA' OR name ILIKE '%India%'",
        "category": "specialized"
    },
    {
        "question": "Which NGC certified coins need their images updated?",
        "sql": "SELECT name, identification_number FROM inventory_inventoryitem WHERE attributes->'coin'->'grade'->>'service' = 'NGC' AND (images IS NULL OR jsonb_array_length(images) = 0)",
        "category": "specialized"
    },
    {
        "question": "Find all coins with certification numbers but missing lookup URLs",
        "sql": "SELECT name, identification_number FROM inventory_inventoryitem WHERE identification_number IS NOT NULL AND identification_number != '' AND (lookup_url IS NULL OR lookup_url = '')",
        "category": "specialized"
    },
    {
        "question": "Show me all proof coins with cameo or deep cameo designations",
        "sql": "SELECT name, attributes->'coin'->'grade'->>'display' AS grade FROM inventory_inventoryitem WHERE attributes->'coin'->'grade'->>'display' ILIKE 'PF%' AND (attributes->'coin'->'grade'->>'label' ILIKE '%CAM%' OR attributes->'coin'->'grade'->>'label' ILIKE '%DCAM%')",
        "category": "specialized"
    },
    {
        "question": "What's the total insurance value of my collection?",
        "sql": "SELECT SUM(price) AS total_insurance_value FROM inventory_inventoryitem WHERE status != 'sold'",
        "category": "specialized"
    }
]

class Command(BaseCommand):
    help = 'Initialize the FAQ database with comprehensive questions and SQL queries'

    def add_arguments(self, parser):
        parser.add_argument(
            '--file',
            type=str,
            help='Path to a JSON file with FAQs to import',
        )
        parser.add_argument(
            '--append',
            action='store_true',
            help='Append to existing FAQs instead of replacing them',
        )
        parser.add_argument(
            '--category',
            type=str,
            help='Only import FAQs from a specific category',
        )

    def handle(self, *args, **options):
        file_path = options.get('file')
        append_mode = options.get('append', False)
        filter_category = options.get('category')
        
        if file_path:
            try:
                with open(file_path, 'r') as f:
                    faqs = json.load(f)
                self.stdout.write(f"Loaded {len(faqs)} FAQs from {file_path}")
            except Exception as e:
                self.stderr.write(f"Error loading FAQs from file: {e}")
                return
        else:
            faqs = INITIAL_FAQS
            self.stdout.write(f"Using {len(faqs)} built-in FAQs")
        
        # Filter by category if specified
        if filter_category:
            original_count = len(faqs)
            faqs = [faq for faq in faqs if faq.get('category', '').lower() == filter_category.lower()]
            self.stdout.write(f"Filtered to {len(faqs)} FAQs in category '{filter_category}' (from {original_count} total)")
        
        # Group FAQs by category for reporting
        categories = {}
        for faq in faqs:
            category = faq.get('category', 'uncategorized')
            if category not in categories:
                categories[category] = 0
            categories[category] += 1
        
        # Report categories
        self.stdout.write("\nFAQs by category:")
        for category, count in sorted(categories.items()):
            self.stdout.write(f"  - {category}: {count} questions")
        
        count = 0
        for faq in faqs:
            try:
                add_faq(
                    question=faq["question"],
                    sql=faq["sql"],
                    category=faq.get("category", "")
                )
                count += 1
                if count % 10 == 0:
                    self.stdout.write(f"Added {count}/{len(faqs)} FAQs...")
            except Exception as e:
                self.stderr.write(f"Error adding FAQ '{faq['question']}': {e}")
        
        self.stdout.write(self.style.SUCCESS(f'Successfully added {count} FAQs to the database'))
