import { NextRequest, NextResponse } from "next/server";

// Mock database schema for reference when generating SQL
const mockSchema = {
  tables: {
    items: {
      columns: ["id", "name", "description", "category_id", "location_id", "value", "purchase_date", "condition", "created_at", "updated_at"],
    },
    categories: {
      columns: ["id", "name", "description", "parent_id", "created_at", "updated_at"],
    },
    locations: {
      columns: ["id", "name", "description", "parent_id", "created_at", "updated_at"],
    },
  },
};

// Sample SQL queries for common questions
const sampleQueries: Record<string, string> = {
  "total value": `SELECT SUM(value) AS total_value FROM items WHERE deleted_at IS NULL;`,
  "category": `SELECT c.name AS category_name, COUNT(i.id) AS item_count, SUM(i.value) AS total_value 
FROM items i 
JOIN categories c ON i.category_id = c.id 
WHERE i.deleted_at IS NULL 
GROUP BY c.name 
ORDER BY total_value DESC;`,
  "location": `SELECT l.name AS location_name, COUNT(i.id) AS item_count 
FROM items i 
JOIN locations l ON i.location_id = l.id 
WHERE i.deleted_at IS NULL 
GROUP BY l.name 
ORDER BY item_count DESC;`,
  "average": `SELECT AVG(value) AS average_value FROM items WHERE deleted_at IS NULL;`,
  "recent": `SELECT * FROM items WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 10;`,
  "valuable": `SELECT * FROM items WHERE deleted_at IS NULL ORDER BY value DESC LIMIT 10;`,
  "platinum": `SELECT COUNT(*) AS count FROM items WHERE category_id IN (SELECT id FROM categories WHERE name LIKE '%platinum%') AND deleted_at IS NULL;`,
  "morgan": `SELECT AVG(value) AS average_price FROM items WHERE name LIKE '%Morgan%' AND deleted_at IS NULL;`,
  "graded": `SELECT * FROM items WHERE condition LIKE 'MS-%' AND value > 0 AND deleted_at IS NULL ORDER BY condition DESC;`,
};

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    const { question, force_refresh = false } = body;

    if (!question) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    // Add a small delay to simulate processing
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Convert question to lowercase for matching
    const lowerQuestion = question.toLowerCase();
    
    // Find a matching sample query or generate a generic one
    let sql = "";
    
    // Try to match the question with our sample queries
    for (const [keyword, query] of Object.entries(sampleQueries)) {
      if (lowerQuestion.includes(keyword)) {
        sql = query;
        break;
      }
    }
    
    // If no match found, generate a generic query based on the question
    if (!sql) {
      if (lowerQuestion.includes("count") || lowerQuestion.includes("how many")) {
        sql = `SELECT COUNT(*) AS count FROM items WHERE deleted_at IS NULL;`;
      } else if (lowerQuestion.includes("list") || lowerQuestion.includes("show")) {
        sql = `SELECT * FROM items WHERE deleted_at IS NULL LIMIT 10;`;
      } else {
        // Default query
        sql = `-- Generated SQL for: ${question}\nSELECT * FROM items WHERE deleted_at IS NULL LIMIT 10;`;
      }
    }

    // Return the SQL response
    return NextResponse.json({ sql });
  } catch (error) {
    console.error("Error processing SQL request:", error);
    return NextResponse.json(
      { error: "Failed to generate SQL" },
      { status: 500 }
    );
  }
}
