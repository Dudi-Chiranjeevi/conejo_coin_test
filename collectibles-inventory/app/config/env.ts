// Session configuration
export const sessionConfig = {
  // Session cookie settings - using naming consistent with backend
  cookieSecure: process.env.SESSION_COOKIE_SECURE === 'True',
  cookieHttpOnly: process.env.SESSION_COOKIE_HTTPONLY === 'True',
  cookieSameSite: process.env.SESSION_COOKIE_SAMESITE || 'Lax',
  cookieAge: parseInt(process.env.SESSION_COOKIE_AGE || '3600', 10),
  
  // Session storage settings
  sessionStoragePrefix: process.env.SESSION_STORAGE_PREFIX || 'coejo_session_',
};

// API configuration with hardcoded URL
export const apiConfig = {
  // Hardcoded backend URL to ensure consistent connectivity
  baseUrl: process.env.BACKEND_URL || "https://www.conejocoin.net" || "https://conejo-backend-146447649143.us-central1.run.app",
  timeout: parseInt(process.env.API_TIMEOUT || '30000', 10),
  withCredentials: true,
};

// Authentication configuration
export const authConfig = {
  firebaseCookieName: process.env.FIREBASE_COOKIE_NAME || 'firebase_token',
  csrfCookieName: process.env.CSRF_COOKIE_NAME || 'csrftoken',
  tokenRefreshInterval: parseInt(process.env.TOKEN_REFRESH_INTERVAL || '1800000', 10), // 30 minutes in ms
};

// Export all configs as a single object
export const env = {
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  session: sessionConfig,
  api: apiConfig,
  auth: authConfig,
};

export default env;
