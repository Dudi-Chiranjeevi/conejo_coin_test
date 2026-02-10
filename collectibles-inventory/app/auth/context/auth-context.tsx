"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
} from "react";
import { User } from "../types/auth";
import { env } from "../../config/env";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signup: (
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ) => Promise<void>;
  forgotPassword: (email: string) => Promise<boolean>;
  checkAuthStatus: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

// Token will be refreshed when it's this close to expiring (in milliseconds)
// Default: 5 minutes before expiration
const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000;

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenExpiryTime, setTokenExpiryTime] = useState<number | null>(null);

  const signup = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string
  ): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // First, clear any existing cookies to ensure we start fresh
      clearAuthCookies();

      // Add a random query parameter to bypass any caching
      const signupUrl = `${API_BASE_URL}/api/v1/auth/signup/?_=${Date.now()}`;
      console.log(`Using signup URL: ${signupUrl}`);

      const response = await fetch(signupUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
        }),
      });

      const data = await response.json();
      console.log("Signup response:", data);

      if (!response.ok) {
        throw new Error(data.error || data.detail || "Signup failed");
      }

      // Don't set user or isAuthenticated here since signup typically requires email verification
      console.log("Signup successful for:", email);
    } catch (err) {
      console.error("Signup error:", err);
      setError(err instanceof Error ? err.message : "Signup failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Check auth status on mount
  const didInitRef = useRef(false);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    checkAuthStatus();
  }, []);

  // Check if token needs refresh
  const checkTokenExpiry = () => {
    if (!tokenExpiryTime || !isAuthenticated) return;

    const now = Date.now();
    const timeUntilExpiry = tokenExpiryTime - now;

    // console.log(
    //   `Token expires in ${Math.floor(timeUntilExpiry / 1000)} seconds`
    // );

    // If token is expiring soon, refresh it
    if (timeUntilExpiry < TOKEN_REFRESH_THRESHOLD && timeUntilExpiry > 0) {
      console.log("Token expiring soon, refreshing...");
      refreshToken().catch((err) => {
        console.log("Token refresh failed:", err);
      });
    }
  };

  // Start refresh token interval when authenticated
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  useEffect(() => {
    // start interval once when authenticated
    if (isAuthenticated && !refreshIntervalRef.current) {
      refreshIntervalRef.current = setInterval(() => {
        checkTokenExpiry();
      }, 60_000); // every minute
    }

    // stop interval when unauthenticated
    if (!isAuthenticated && refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [isAuthenticated]);

  // API base URL for Django backend - hardcoded as a temporary solution
  const API_BASE_URL =
    process.env.BACKEND_URL ||
    "https://www.conejocoin.net" ||
    "https://conejo-backend-146447649143.us-central1.run.app";

  // For debugging
  console.log("Auth context API_BASE_URL:", API_BASE_URL);

  // Helper function to get CSRF token from cookies
  const getCsrfToken = (): string | null => {
    return (
      document.cookie
        .split("; ")
        .find((row) => row.startsWith("csrftoken="))
        ?.split("=")[1] || null
    );
  };

  // Helper function to fetch a CSRF token
  const fetchCsrfToken = async (): Promise<string | null> => {
    try {
      console.log("Fetching CSRF token");
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/status/`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });

      // Check if we got a CSRF token
      const csrfToken = getCsrfToken();
      console.log("CSRF token after status check:", csrfToken || "Not found");
      return csrfToken;
    } catch (e) {
      console.log("Error fetching CSRF token:", e);
      return null;
    }
  };

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // First, clear any existing cookies to ensure we start fresh
      clearAuthCookies();

      console.log("Using backend-only authentication approach");

      // Always use the backend for authentication, never contact Firebase directly

      // Try to get a CSRF token first
      await fetchCsrfToken();

      // Add a random query parameter to bypass any caching
      const loginUrl = `${API_BASE_URL}/api/v1/auth/login/?_=${Date.now()}`;
      console.log(`Using login URL: ${loginUrl}`);

      // Get CSRF token from cookies
      const csrfToken = getCsrfToken();
      console.log("CSRF token for login request:", csrfToken || "Not found");

      // Try regular login with Django backend
      const response = await fetch(loginUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          "X-Requested-With": "XMLHttpRequest", // This helps with CSRF exemption
          ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
        },
        credentials: "include", // Important for cookies
        body: JSON.stringify({
          email,
          password: btoa(password), // Base64 encode the password for security
          bypass_csrf: true, // Signal to backend this is a trusted request
        }),
      });

      // Log the response status and headers for debugging
      console.log(`Login response status: ${response.status}`);

      // Handle 403 Forbidden specifically
      if (response.status === 403) {
        console.log(
          "Received 403 Forbidden, attempting to clear cookies and retry"
        );

        // Clear cookies again
        clearAuthCookies();

        // Wait a moment
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Retry the login request
        const retryResponse = await fetch(loginUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
          credentials: "include",
          body: JSON.stringify({ 
            email, 
            password: btoa(password) // Base64 encode the password for security
          }),
        });

        // Use the retry response from now on
        const data = await retryResponse.json();
        console.log("Retry login response:", data);

        if (!retryResponse.ok) {
          throw new Error(
            data.error || data.detail || "Login failed after retry"
          );
        }

        if (data.success) {
          console.log("Login successful after retry, user data:", data.user);
          setUser(data.user);
          setIsAuthenticated(true);

          // Calculate token expiry time
          const expiryTime = Date.now() + 3600 * 1000;
          setTokenExpiryTime(expiryTime);
          console.log(
            `Token will expire at: ${new Date(expiryTime).toISOString()}`
          );
        } else {
          throw new Error(
            data.error || data.detail || "Login failed after retry"
          );
        }

        return; // Exit early since we've handled the retry
      }

      const data = await response.json();
      console.log("Login response:", data);

      if (!response.ok) {
        throw new Error(data.error || data.detail || "Login failed");
      }

      if (data.success) {
        console.log("Login successful, user data:", data.user);
        setUser(data.user);
        setIsAuthenticated(true);

        // Calculate token expiry time based on current time + expiresIn (default 1 hour)
        // Firebase tokens typically expire in 3600 seconds (1 hour)
        const expiryTime = Date.now() + 3600 * 1000;
        setTokenExpiryTime(expiryTime);
        console.log(
          `Token will expire at: ${new Date(expiryTime).toISOString()}`
        );
      } else {
        throw new Error(data.error || data.detail || "Login failed");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError(err instanceof Error ? err.message : "Login failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to clear authentication cookies
  const clearAuthCookies = () => {
    // Get all cookies
    const cookies = document.cookie.split(";");
    const domain = window.location.hostname;
    const paths = ["/", "", "/api", "/api/v1", "/auth"];
    const sameSiteOptions = ["Lax", "Strict", "None"];

    // Clear all cookies with different path and domain combinations
    for (const cookie of cookies) {
      const cookieName = cookie.split("=")[0].trim();

      // Skip empty cookie names
      if (!cookieName) continue;

      console.log(`Clearing cookie: ${cookieName}`);

      // Clear with all path combinations
      for (const path of paths) {
        // Basic cookie clearing
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}`;

        // With domain
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}; domain=${domain}`;

        // Try all SameSite options
        for (const sameSite of sameSiteOptions) {
          // Without secure
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}; SameSite=${sameSite}`;
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}; domain=${domain}; SameSite=${sameSite}`;

          // With secure
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}; SameSite=${sameSite}; Secure`;
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}; domain=${domain}; SameSite=${sameSite}; Secure`;
        }
      }
    }

    // Explicitly clear known cookies with all possible combinations
    const knownCookies = [
      env.auth.firebaseCookieName,
      env.auth.csrfCookieName,
      "sessionid",
      "logout_sentinel",
      "csrftoken",
    ];

    for (const cookieName of knownCookies) {
      for (const path of paths) {
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}`;
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}; domain=${domain}`;

        // With SameSite and Secure variations
        for (const sameSite of sameSiteOptions) {
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}; SameSite=${sameSite}`;
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}; SameSite=${sameSite}; Secure`;
        }
      }
    }

    console.log("All cookies thoroughly cleared");
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      // clear client state first
      setUser(null);
      setIsAuthenticated(false);
      setTokenExpiryTime(null);

      // stop interval
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      // prevent residual refresh
      isRefreshingRef.current = false;

      // Clear all authentication cookies BEFORE calling logout
      clearAuthCookies();

      try {
        // Call both logout endpoints to ensure all logout handlers are triggered
        // First call the auth logout endpoint
        await fetch(`${API_BASE_URL}/api/v1/auth/logout/`, {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        });

        // Clear cookies again after the first logout call
        clearAuthCookies();

        // Wait a moment before the next request
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Also call the inventory logout endpoint to ensure both are handled
        await fetch(`${API_BASE_URL}/api/v1/inventory/auth/logout/`, {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        }).catch((e) =>
          console.log("Inventory logout endpoint might not exist, ignoring:", e)
        );
      } catch (e) {
        console.log(
          "Error during logout API calls, continuing with client-side logout:",
          e
        );
      }

      // Clear all authentication cookies again after all logout calls
      clearAuthCookies();

      // Set a strong logout sentinel cookie to prevent automatic re-login
      document.cookie = `logout_sentinel=1; path=/; max-age=3600; SameSite=Lax`;

      // Disable automatic status check after logout
      didInitRef.current = true;

      // Force a page reload to ensure all state is cleared
      // This is the most reliable way to ensure we start fresh
      setTimeout(() => {
        // Use location.replace to prevent the page from being added to history
        window.location.replace("/");
      }, 300);
    } finally {
      setIsLoading(false);
    }
  };

  const didKickInitialRefreshRef = useRef(false);

  const checkAuthStatus = async (): Promise<void> => {
    setIsLoading(true);
    try {
      // Check for logout sentinel cookie first
      const hasLogoutSentinel = document.cookie
        .split("; ")
        .some((row) => row.startsWith("logout_sentinel="));

      if (hasLogoutSentinel) {
        console.log("Logout sentinel found, preventing automatic login");
        setUser(null);
        setIsAuthenticated(false);
        setTokenExpiryTime(null);
        setIsLoading(false);
        return;
      }

      console.log("Checking auth status via backend");

      const response = await fetch(`${API_BASE_URL}/api/v1/auth/status/`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });

      const data = await response.json();

      if (data.authenticated) {
        setUser(data.user);
        setIsAuthenticated(true);

        // One-shot refresh to get server-aligned expiry, only once per session
        if (!didKickInitialRefreshRef.current && tokenExpiryTime == null) {
          didKickInitialRefreshRef.current = true;
          // fire-and-forget; don't await to avoid chaining loops
          refreshToken().catch(() => {});
        }
      } else {
        console.log("User is not authenticated");
        setUser(null);
        setIsAuthenticated(false);
        setTokenExpiryTime(null);
        didKickInitialRefreshRef.current = false; // allow one-shot next time user logs in
      }
    } catch (err) {
      console.error("Auth status check error:", err);
      setUser(null);
      setIsAuthenticated(false);
      setTokenExpiryTime(null);
      didKickInitialRefreshRef.current = false;
    } finally {
      setIsLoading(false);
    }
  };

  // Add forgot password function
  const forgotPassword = async (email: string): Promise<boolean> => {
    try {
      console.log("Sending password reset email");

      const response = await fetch(
        `${API_BASE_URL}/api/v1/auth/forgot-password/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();
      console.log("Forgot password response:", data);

      if (!response.ok) {
        throw new Error(data.error || "Failed to send reset email");
      }

      return data.success;
    } catch (err) {
      console.error("Forgot password error:", err);
      throw err;
    }
  };

  const isRefreshingRef = useRef(false);

  const refreshToken = async (): Promise<boolean> => {
    if (isRefreshingRef.current) return false;
    isRefreshingRef.current = true;
    try {
      // console.log("Refreshing token via backend");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh/`, {
        method: "POST",
        credentials: "include",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.log("Token refresh failed - server error");
        return false;
      }

      const data = await response.json();
      console.log("Token refresh result:", data.success);

      if (data.success) {
        const seconds = Number(data.expires_in ?? 3600);
        const expiryTime = Date.now() + seconds * 1000;
        setTokenExpiryTime(expiryTime);
        console.log(
          `Token refreshed, will expire at: ${new Date(
            expiryTime
          ).toISOString()}`
        );
        // ⬅️ do NOT call checkAuthStatus() here
      }

      return !!data.success;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        console.log("Token refresh request timed out");
      } else {
        console.log("Token refresh failed - will try again later");
      }
      return false;
    } finally {
      isRefreshingRef.current = false;
    }
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    forgotPassword,
    signup,
    checkAuthStatus,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
