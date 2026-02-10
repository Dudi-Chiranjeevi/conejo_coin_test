"use client";
import { useState, useEffect, FormEvent } from "react";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import SignupPage from "./signup-page";
import { ForgotPasswordModal } from "./forgot-password-modal";
import type { LoginCredentials, AuthState } from "../types/auth";
import { useAuth } from "../context/auth-context";

// ------------- Login Page ------------

interface LoginPageProps {
  onLoginSuccess: (user: any) => void;
  onSwitchToSignup?: () => void;
}

const API_BASE_URL = process.env.API_BASE_URL || "https://www.conejocoin.net/";

const LoginPage = ({ onLoginSuccess, onSwitchToSignup }: LoginPageProps) => {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: "",
    password: "",
    rememberMe: false,
  });

  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    loginAttempts: 0,
    isLocked: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [loginStatus, setLoginStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  useEffect(() => {
    if (authState.isLocked && authState.lockoutTime) {
      const timer = setTimeout(() => {
        setAuthState((prev) => ({
          ...prev,
          isLocked: false,
          lockoutTime: undefined,
        }));
      }, authState.lockoutTime);
      return () => clearTimeout(timer);
    }
  }, [authState.isLocked, authState.lockoutTime]);

  const handleResendVerification = async (email: string, password: string) => {
    try {
      setAuthState((prev) => ({ ...prev, isLoading: true }));

      const response = await fetch(
        `${API_BASE_URL}/api/v1/auth/resend-verification/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        },
      );

      const data = await response.json();

      if (response.ok && data.success) {
        // Show success message
        setAuthState((prev) => ({
          ...prev,
          error: "Verification email sent! Please check your inbox.",
          isLoading: false,
        }));
      } else {
        throw new Error(data.error || "Failed to send verification email");
      }
    } catch (error: any) {
      setAuthState((prev) => ({
        ...prev,
        error:
          error instanceof Error
            ? error.message
            : "Failed to send verification email",
        isLoading: false,
      }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!credentials.email) {
      errors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(credentials.email)) {
      errors.email = "Enter a valid email address";
    }
    if (!credentials.password) {
      errors.password = "Password is required";
    } else if (credentials.password.length < 6) {
      errors.password = "Minimum 6 characters required";
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const { login, error: authError } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || authState.isLocked) return;

    setLoginStatus("loading");
    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      await login(credentials.email, credentials.password);
      setLoginStatus("success");

      setTimeout(() => {
        onLoginSuccess({ email: credentials.email });
      }, 1500);
    } catch (error: any) {
      const newAttempts = authState.loginAttempts + 1;

      setLoginStatus("error");

      let errorMessage =
        error instanceof Error ? error.message : "Login failed";

      if (
        errorMessage.includes("verify your email") ||
        errorMessage.includes("email verification")
      ) {
        // This is an email verification error - show specific message

        errorMessage =
          "Please verify your email before logging in. Check your inbox for the verification link.";
      }

      setAuthState((prev) => ({
        ...prev,

        isLoading: false,

        error: errorMessage,

        loginAttempts: newAttempts,

        isLocked: newAttempts >= 5,

        lockoutTime: newAttempts >= 5 ? 300000 : undefined,
      }));

      setTimeout(() => setLoginStatus("idle"), 3000);
    }
  };

  return (
    <>
      {/* Frame: warm background + gradient only at the top */}
      <div className="relative w-full min-h-screen bg-gradient-to-b from-[#f5ed31]/35 via-white to-white flex items-center justify-center px-4 py-10 sm:p-6 font-urbanist">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[36vh] bg-auth-ambient opacity-25 blur-2xl" />

        {/* Glassmorphism Card */}
        <div className="relative z-10 w-full max-w-md rounded-2xl bg-white/85 backdrop-blur-xl ring-1 ring-black/5 border border-black/5 shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
          <div className="px-6 sm:px-10 pt-10 sm:pt-12 pb-10 sm:pb-12">
            {/* Icon + Title centered and large */}
            <div className="flex flex-col items-center mb-8 sm:mb-10">
              <svg
                aria-hidden="true"
                viewBox="0 0 64 64"
                className="h-9 w-9 text-ink mb-4"
                fill="currentColor"
              >
                <path d="M16 10h32a2 2 0 0 1 0 4H16a2 2 0 0 1 0-4zm0 40h32a2 2 0 0 1 0 4H16a2 2 0 0 1 0-4zM20 14c0 9.941 9.163 14 12 18-2.837 4-12 8.059-12 18h24c0-9.941-9.163-14-12-18 2.837-4 12-8.059 12-18H20z" />
              </svg>
              <h1 className="text-4xl font-semibold text-black mb-6">Log in</h1>
            </div>

            {/* Alerts */}
            {/* Alerts */}

            {authState.error && (
              <div className="mb-5 flex flex-col gap-2 rounded-xl border border-red-200/70 bg-red-50/80 px-3 py-2 text-sm text-red-700">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />

                  <div>
                    <p>{authState.error}</p>

                    {authState.loginAttempts >= 3 &&
                      authState.loginAttempts < 5 && (
                        <span className="mt-1 block text-xs text-ink/70">
                          {5 - authState.loginAttempts} attempts remaining
                        </span>
                      )}
                  </div>
                </div>

                {/* ✅ NEW: Resend verification button for email verification errors */}
                {/*Alerts*/}
                {authState.error.includes("verify your email") && (
                  <button
                    type="button"
                    onClick={() =>
                      handleResendVerification(
                        credentials.email,
                        credentials.password,
                      )
                    }
                    className="self-start text-sm text-sky-600 font-medium hover:underline mt-2"
                    disabled={authState.isLoading}
                  >
                    Resend verification email
                  </button>
                )}
              </div>
            )}
            {authState.isLocked && (
              <div className="mb-5 flex items-center gap-2 rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-2 text-sm text-slate-700">
                <AlertCircle className="w-4 h-4" />
                Too many failed attempts. Try again in 5 minutes.
              </div>
            )}

            {/* Form */}
            <form
              onSubmit={handleLogin}
              className="space-y-6"
              autoComplete="off"
              noValidate
            >
              {/* Email */}
              <div>
                <label className="mb-2 block text-base font-semibold text-ink">
                  Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    autoComplete="username"
                    value={credentials.email}
                    onChange={(e) =>
                      setCredentials({
                        ...credentials,
                        email: e.target.value,
                      })
                    }
                    disabled={authState.isLoading || authState.isLocked}
                    className="w-full h-12 rounded-xl border border-white/60 bg-white/80 shadow-inner px-5 text-ink placeholder-black/35 outline-none focus:ring-4 focus:ring-black/5"
                    placeholder="example@email.com"
                    required
                  />
                  <Mail className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/40 w-5 h-5" />
                </div>
                {validationErrors.email && (
                  <p className="text-sm text-red-600 mt-1">
                    {validationErrors.email}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="mb-2 block text-base font-medium text-ink">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={credentials.password}
                    onChange={(e) =>
                      setCredentials({
                        ...credentials,
                        password: e.target.value,
                      })
                    }
                    disabled={authState.isLoading || authState.isLocked}
                    className="w-full h-12 rounded-xl border border-white/60 bg-white/80 shadow-inner px-5 text-ink placeholder-black/35 outline-none focus:ring-4 focus:ring-black/5 pr-12"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-black/50 hover:text-black/80 transition-colors"
                    disabled={authState.isLoading}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>

                {/* Forgot link right-aligned, blue */}
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sky-600 font-medium hover:underline"
                    tabIndex={authState.isLoading ? -1 : 0}
                    disabled={authState.isLoading}
                  >
                    Forgot password?
                  </button>
                </div>

                {validationErrors.password && (
                  <p className="text-sm text-red-600 mt-1">
                    {validationErrors.password}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={authState.isLoading || authState.isLocked}
                className="w-full h-12 rounded-xl font-semibold bg-[#f5ed31] text-black hover:opacity-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {loginStatus === "loading" ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Log in
                    </>
                  ) : loginStatus === "success" ? (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Redirecting...
                    </>
                  ) : loginStatus === "error" ? (
                    <>
                      <AlertCircle className="w-5 h-5" />
                      Try again
                    </>
                  ) : (
                    <>Log in</>
                  )}
                </span>
              </button>
            </form>

            {/* Footer - Signup button commented out */}
            {/* <div className="mt-8 text-center text-sm text-ink/50">
              Don’t have an account?{' '}
              <button
                type="button"
                onClick={onSwitchToSignup ? onSwitchToSignup : () => {}}
                className="text-sky-600 font-medium hover:underline"
                disabled={authState.isLoading || !onSwitchToSignup}
              >
                Sign up
              </button>
            </div> */}

            <ForgotPasswordModal
              isOpen={showForgotPassword}
              onClose={() => setShowForgotPassword(false)}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
