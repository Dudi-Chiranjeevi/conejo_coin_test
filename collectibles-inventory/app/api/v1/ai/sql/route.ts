import { NextRequest, NextResponse } from "next/server";

// Proxy route to generate SQL from a natural language question
// Frontend calls this via `/api/v1/ai/sql` through `askSQL` in lib/ai.ts
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body?.question || typeof body.question !== "string") {
      return NextResponse.json(
        { error: "'question' is a required field" },
        { status: 400 }
      );
    }

    // Build backend URL – this hits Django `assistant.views.sql_from_question`
    const backendBase = process.env.API_BASE_URL || "https://www.conejocoin.net";
    const apiUrl = `${backendBase}/api/v1/ai/sql`;

    // Match backend serializer: SQLAsk { question, category? }
    const payload: { question: string; category?: string } = {
      question: body.question,
    };

    if (body.category && typeof body.category === "string") {
      payload.category = body.category;
    }

    // NOTE: `askSQL` also sends `force_refresh`; backend serializer doesn't know it,
    // so we deliberately do NOT forward that field.

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: errorText || "Failed to generate SQL" },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Expect shape { sql: string } from backend (SQLResp serializer)
    if (!data || typeof data.sql !== "string") {
      return NextResponse.json(
        { error: "Backend did not return a valid SQL string" },
        { status: 500 }
      );
    }

    return NextResponse.json({ sql: data.sql });
  } catch (error: any) {
    console.error("Error in /api/v1/ai/sql:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
