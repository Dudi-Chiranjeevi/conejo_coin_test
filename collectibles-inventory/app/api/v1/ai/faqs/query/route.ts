import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body = await req.json();
    
    // Validate required fields
    if (!body.query) {
      return NextResponse.json(
        { error: 'Query is a required field' },
        { status: 400 }
      );
    }
    
    // Call backend API
    const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:8000'}/api/v1/ai/faqs/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: body.query,
        category: body.category || '',
        limit: body.limit || 5,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: error || 'Failed to query FAQs' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error querying FAQs:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
