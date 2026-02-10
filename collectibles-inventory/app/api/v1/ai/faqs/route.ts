import { NextRequest, NextResponse } from 'next/server';

// This route handles GET (list all FAQs) and POST (create a new FAQ)
export async function GET(req: NextRequest) {
  try {
    // Get category from query params if present
    const url = new URL(req.url);
    const category = url.searchParams.get('category');
    
    // Build API URL
    const apiUrl = new URL('/api/v1/ai/faqs', process.env.API_BASE_URL || 'https://www.conejocoin.net');
    if (category) {
      apiUrl.searchParams.append('category', category);
    }
    
    // Call backend API
    const response = await fetch(apiUrl.toString(), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: error || 'Failed to fetch FAQs' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching FAQs:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication from cookies
    const authToken = req.cookies.get('firebase_token')?.value;
    
    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Parse request body
    const body = await req.json();
    
    // Validate required fields
    if (!body.question || !body.sql) {
      return NextResponse.json(
        { error: 'Question and SQL are required fields' },
        { status: 400 }
      );
    }
    
    // Call backend API
    const response = await fetch(`${process.env.API_BASE_URL || 'https://www.conejocoin.net'}/api/v1/ai/faqs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        question: body.question,
        sql: body.sql,
        category: body.category || '',
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: error || 'Failed to create FAQ' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error creating FAQ:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
