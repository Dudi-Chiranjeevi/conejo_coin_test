"use client";

import { useEffect, useState } from "react";
import LoginPage from "./login-page";
import SignupPage from "./signup-page";
import { Dashboard } from "../../dashboard/components/dashboard";
import { useAuth } from "../context/auth-context";
import type { User } from "../types/auth";

interface AuthSystemProps {
  onNavigate: (path: string) => void;
}

export function AuthSystem({ onNavigate }: AuthSystemProps) {
  const { user, isAuthenticated, isLoading, checkAuthStatus, logout } =
    useAuth();
  const [hasRedirected, setHasRedirected] = useState(false);
  const [authView, setAuthView] = useState<"login" | "signup">("login");

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      await checkAuthStatus();
    };
    checkAuth();
  }, []);

  const handleLoginSuccess = (userData: User) => {
    // The auth context already handles setting the user state
    // We just need to navigate to the dashboard
  };

  const handleSignupSuccess = (userData: User) => {
    // Switch back to login view after successful signup
    setAuthView("login");
  };

  const handleSwitchToSignup = () => {
    setAuthView("signup");
  };

  const handleSwitchToLogin = () => {
    setAuthView("login");
  };

  const handleLogout = async () => {
    await logout();
  };

  // Redirect to dashboard after authentication
  useEffect(() => {
    if (isAuthenticated && user && !isLoading && !hasRedirected) {
      // Add a small delay to ensure state is fully updated before redirect
      const timer = setTimeout(() => {
        setHasRedirected(true);
        onNavigate("/dashboard");
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, user, isLoading, onNavigate, hasRedirected]);

  return (
    <>
      {authView === "login" ? (
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onSwitchToSignup={handleSwitchToSignup}
        />
      ) : (
        <SignupPage
          // onSignupSuccess={handleSignupSuccess}
          onSwitchToLogin={handleSwitchToLogin}
        />
      )}
    </>
  );
}
