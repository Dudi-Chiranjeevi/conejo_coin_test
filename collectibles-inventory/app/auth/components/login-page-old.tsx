"use client";
import React, { useState, useEffect } from "react";
import {
  Eye,
  EyeOff,
  Shield,
  Gem,
  Mail,
  Lock,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { TwoFactorModal } from "./two-factor-modal";
import { ForgotPasswordModal } from "./forgot-password-modal";
import type { LoginCredentials, AuthState } from "../types/auth";
import { mockLogin } from "../types/auth";

const floatingEmojisData = [
  { id: 1, emoji: "🪙", x: 10, y: 20, duration: 6, delay: 0 },
  { id: 2, emoji: "💎", x: 85, y: 15, duration: 8, delay: 1 },
  { id: 3, emoji: "👑", x: 15, y: 70, duration: 7, delay: 2 },
  { id: 4, emoji: "💍", x: 80, y: 75, duration: 9, delay: 0.5 },
  { id: 5, emoji: "🪙", x: 90, y: 40, duration: 5, delay: 1.5 },
  { id: 6, emoji: "💎", x: 5, y: 50, duration: 8, delay: 3 },
  { id: 7, emoji: "👑", x: 25, y: 25, duration: 6, delay: 2.5 },
  { id: 8, emoji: "💍", x: 70, y: 30, duration: 7, delay: 4 },
];

const fixedStars = [
  { left: 12, top: 30, size: 20 },
  { left: 45, top: 70, size: 25 },
  { left: 33, top: 50, size: 22 },
  { left: 70, top: 20, size: 18 },
  { left: 85, top: 80, size: 24 },
  { left: 25, top: 15, size: 21 },
  { left: 55, top: 60, size: 19 },
  { left: 10, top: 85, size: 23 },
  { left: 78, top: 40, size: 20 },
  { left: 40, top: 25, size: 22 },
];

interface LoginPageProps {
  onLoginSuccess: (user: any) => void;
}

const LoginPage = ({ onLoginSuccess }: LoginPageProps) => {
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || authState.isLocked) return;

    setLoginStatus("loading");
    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await mockLogin(credentials);
      if (result.requiresTwoFactor) {
        setShowTwoFactor(true);
        setLoginStatus("idle");
        setAuthState((prev) => ({
          ...prev,
          isLoading: false,
          user: result.user,
        }));
      } else {
        setLoginStatus("success");
        setTimeout(() => {
          onLoginSuccess(result.user);
        }, 1500);
      }
    } catch (error: any) {
      const newAttempts = authState.loginAttempts + 1;
      setLoginStatus("error");
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Login failed",
        loginAttempts: newAttempts,
        isLocked: newAttempts >= 5,
        lockoutTime: newAttempts >= 5 ? 300000 : undefined,
      }));
      setTimeout(() => setLoginStatus("idle"), 3000);
    }
  };

  return (
    <>
      {/* Floating emoji and star mesh animations CSS */}
      <style>{`
        @keyframes floatRotate {
          0% {
            transform: translateY(0) rotate(0deg);
          }
          50% {
            transform: translateY(-20px) rotate(180deg);
          }
          100% {
            transform: translateY(0) rotate(360deg);
          }
        }

        .floating-emoji {
          position: absolute;
          font-size: 1.9rem;
          animation-name: floatRotate;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          will-change: transform;
          user-select: none;
          pointer-events: none;
          filter: drop-shadow(0 0 3px rgba(255 223 70 / 0.8));
          opacity: 0.35;
          z-index: 0;
        }

        /* Star polygon shape using clip-path */
        .star-polygon {
          clip-path: polygon(
            50% 0%,
            61% 35%,
            98% 35%,
            68% 57%,
            79% 91%,
            50% 70%,
            21% 91%,
            32% 57%,
            2% 35%,
            39% 35%
          );
          background: radial-gradient(80% 80% at center, rgba(255 223 70 / 0.5), transparent);
          opacity: 0.12;
          position: absolute;
          width: 20px;
          height: 20px;
          filter: drop-shadow(0 0 1px rgba(255 223 70 / 0.15));
          pointer-events: none;
          user-select: none;
          z-index: 0;
        }
      `}</style>

      <div
        className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #0f172a 0%, #4c1d95 50%, #0f172a 100%)", // slate-900 -> purple-900 -> slate-900
        }}
      >
        {/* Golden-emerald overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(45deg, rgba(255,223,70,0.1), rgba(88,214,141,0.07), rgba(255,223,70,0.1))",
            mixBlendMode: "overlay",
            zIndex: 0,
          }}
        ></div>

        {/* Star Mesh Pattern */}
        {fixedStars.map(({ left, top, size }, i) => (
          <div
            key={`star-${i}`}
            className="star-polygon"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: size,
              height: size,
            }}
            aria-hidden="true"
          />
        ))}

        {/* Floating Collectible Emojis */}
        {floatingEmojisData.map(({ id, emoji, x, y, duration, delay }) => (
          <div
            key={id}
            className="floating-emoji"
            aria-hidden="true"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              animationDuration: `${duration}s`,
              animationDelay: `${delay}s`,
            }}
          >
            {emoji}
          </div>
        ))}

        {/* Main login container */}
        <div className="relative w-full max-w-md z-10 bg-white/95 backdrop-blur-xl border border-slate-200/60 rounded-3xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8 border-b border-slate-100/80 pb-8">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-sky-500 to-sky-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
              <Gem className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-serif font-bold text-slate-900 mb-2">
              Conejo Coins
            </h1>
            <p className="text-sm text-slate-600 tracking-widest uppercase font-medium">
              Secure Access Panel
            </p>
          </div>

          {/* Alerts */}
          <div className="mb-6">
            {authState.error && (
              <div className="mb-4 flex flex-col rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-700 text-sm">
                <div className="flex items-center space-x-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <span>{authState.error}</span>
                </div>
                {authState.loginAttempts >= 3 &&
                  authState.loginAttempts < 5 && (
                    <span className="mt-1 text-xs text-slate-800">
                      {5 - authState.loginAttempts} attempts remaining
                    </span>
                  )}
              </div>
            )}
            {authState.isLocked && (
              <div className="mb-4 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-700 text-sm">
                <AlertCircle className="w-4 h-4 text-slate-500 mr-2" />
                Too many failed attempts. Try again in 5 minutes.
              </div>
            )}
          </div>

          {/* Form */}
          <form
            onSubmit={handleLogin}
            className="space-y-7"
            autoComplete="off"
            noValidate
          >
            {/* Email */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-600 tracking-wider uppercase">
                Email Address
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
                  className="w-full px-6 py-4 bg-white/90 border-2 border-slate-200 rounded-xl font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-sky-400/10 focus:border-sky-400 transition-all duration-300 pl-12"
                  placeholder="you@example.com"
                  required
                />
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
              </div>
              {validationErrors.email && (
                <p className="text-sm text-red-600 mt-1">
                  {validationErrors.email}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-600 tracking-wider uppercase">
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
                  className="w-full px-6 py-4 bg-white/90 border-2 border-slate-200 rounded-xl font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-sky-400/10 focus:border-sky-400 transition-all duration-300 pr-12 pl-12"
                  placeholder="Enter your password"
                  required
                />
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  disabled={authState.isLoading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {validationErrors.password && (
                <p className="text-sm text-red-600 mt-1">
                  {validationErrors.password}
                </p>
              )}
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-sky-600 border-slate-300 rounded focus:ring-sky-400/20"
                  checked={credentials.rememberMe}
                  onChange={(e) =>
                    setCredentials({
                      ...credentials,
                      rememberMe: e.target.checked,
                    })
                  }
                  disabled={authState.isLoading}
                />
                <span className="text-slate-600 font-medium">Remember me</span>
              </label>
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sky-700 hover:text-sky-800 font-medium transition-colors"
                tabIndex={authState.isLoading ? -1 : 0}
                disabled={authState.isLoading}
              >
                Forgot password?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={authState.isLoading || authState.isLocked}
              className={`w-full group relative overflow-hidden bg-gradient-to-r from-sky-500 to-sky-600 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed ${
                loginStatus === "success"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : loginStatus === "error"
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : ""
              }`}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-sky-600 to-sky-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex items-center justify-center space-x-2">
                {loginStatus === "loading" ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-900" />
                    <span className="tracking-wide">Authenticating...</span>
                  </>
                ) : loginStatus === "success" ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span className="tracking-wide">Redirecting...</span>
                  </>
                ) : loginStatus === "error" ? (
                  <>
                    <AlertCircle className="w-5 h-5" />
                    <span className="tracking-wide">Login Failed</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5" />
                    <span className="tracking-wide">Access Vault</span>
                  </>
                )}
              </div>
            </button>
          </form>

          {/* Security Message */}
          <div className="mt-8 p-4 bg-slate-50/80 rounded-xl border border-slate-200/60 text-xs text-slate-600 text-center">
            <div className="mt-4 flex items-start space-x-3 text-left">
              <Shield className="w-5 h-5 text-slate-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Bank-Grade Security
                </p>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Your collection data is protected with enterprise-level
                  encryption and multi-factor authentication.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-slate-100/80 text-center">
            <p className="text-xs text-slate-500">
              Need access? Contact your{" "}
              <button
                className="text-sky-700 hover:text-sky-800 font-medium transition-colors"
                tabIndex={-1}
                disabled
                type="button"
              >
                portfolio manager
              </button>
            </p>
          </div>
        </div>

        {/* Modals */}
        <TwoFactorModal
          isOpen={showTwoFactor}
          onClose={() => setShowTwoFactor(false)}
          onSuccess={(user) => {
            setShowTwoFactor(false);
            setLoginStatus("success");
            setTimeout(() => onLoginSuccess(user), 1500);
          }}
          userEmail={credentials.email}
        />
        <ForgotPasswordModal
          isOpen={showForgotPassword}
          onClose={() => setShowForgotPassword(false)}
        />
      </div>
    </>
  );
};

export default LoginPage;
