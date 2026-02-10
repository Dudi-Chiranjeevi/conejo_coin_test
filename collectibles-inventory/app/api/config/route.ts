export async function GET() {
  const publicConfig = {
    API_BASE_URL: process.env.BACKEND_URL || '',
    COINS_CATEGORY_ID: process.env.COINS_CATEGORY_ID || '',
    CLIENT_ID: process.env.CLIENT_ID || '',
    SERVICEACCOUNT_CREDENTIALS: process.env.SERVICEACCOUNT_CREDENTIALS || '',
  };

  return new Response(JSON.stringify(publicConfig), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

// For App Router, export this as the default
export { GET as default };
