import { NextRequest, NextResponse } from 'next/server';

// This route handles GET (get FAQ by ID), PUT (update FAQ), and DELETE (delete FAQ)
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    
    // Call backend API
    const response = await fetch(`${process.env.API_BASE_URL || 'https://www.conejocoin.net'}/api/v1/ai/faqs/${id}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: error || 'Failed to fetch FAQ' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`Error fetching FAQ ${params.id}:`, error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication from cookies or headers
    const authToken = req.cookies.get('firebase_token')?.value;
    
    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const id = params.id;
    const body = await req.json();
    
    // Call backend API
    const response = await fetch(`${process.env.API_BASE_URL || 'https://www.conejocoin.net'}/api/v1/ai/faqs/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: error || 'Failed to update FAQ' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error(`Error updating FAQ ${params.id}:`, error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication from cookies or headers
    const authToken = req.cookies.get('firebase_token')?.value;
    
    if (!authToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const id = params.id;
    
    // Call backend API
    const response = await fetch(`${process.env.API_BASE_URL || 'https://www.conejocoin.net'}/api/v1/ai/faqs/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });
    
    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: error || 'Failed to delete FAQ' },
        { status: response.status }
      );
    }
    
    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    console.error(`Error deleting FAQ ${params.id}:`, error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
