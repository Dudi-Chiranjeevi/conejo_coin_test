"use client";

import React, { useState } from "react";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  Loader2,
  CheckCircle,
  AlertCircle,
  User,
  X,
} from "lucide-react";
import type { SignupCredentials, AuthState } from "../types/auth";

interface SignupPageProps {
  onSwitchToLogin: () => void;
}

const SignupPage = ({ onSwitchToLogin }: SignupPageProps) => {
  const [credentials, setCredentials] = useState<SignupCredentials>({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
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
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [signupStatus, setSignupStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");

  const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!credentials.email) {
      errors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(credentials.email)) {
      errors.email = "Enter a valid email address";
    }

    if (!credentials.firstName) {
      errors.firstName = "First name is required";
    }

    if (!credentials.lastName) {
      errors.lastName = "Last name is required";
    }

    if (!credentials.password) {
      errors.password = "Password is required";
    } else if (credentials.password.length < 6) {
      errors.password = "Minimum 6 characters required";
    }

    if (!credentials.confirmPassword) {
      errors.confirmPassword = "Please confirm your password";
    } else if (credentials.password !== credentials.confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSignupStatus("loading");
    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/signup/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
          firstName: credentials.firstName,
          lastName: credentials.lastName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 409) {
          setModalMessage(
            "Email already exists. Please use a different email or try logging in."
          );
          setShowErrorModal(true);
          throw new Error("Email already exists");
        }
        throw new Error(data.error || "Signup failed");
      }

      if (data.success) {
        setSignupStatus("success");
        setModalMessage(
          data.message ||
            "Account created successfully! Please check your email for verification. " +
              "You must verify your email before you can log in."
        );
        setShowSuccessModal(true);

        // Clear form after successful signup
        setCredentials({
          email: "",
          password: "",
          confirmPassword: "",
          firstName: "",
          lastName: "",
        });
      } else {
        throw new Error(data.error || "Signup failed");
      }
    } catch (error: any) {
      setSignupStatus("error");
      const errorMessage =
        error instanceof Error ? error.message : "Signup failed";
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));

      // Only show modal if not already shown for email exists case
      if (!showErrorModal) {
        setModalMessage(errorMessage);
        setShowErrorModal(true);
      }
    } finally {
      setAuthState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false);
    onSwitchToLogin(); // Redirect to login page
  };

  const handleCloseErrorModal = () => {
    setShowErrorModal(false);
    setSignupStatus("idle");
  };

  // Add this function to your SignupPage component:

  const handleResendVerification = async (email: string) => {
    try {
      setAuthState((prev) => ({ ...prev, isLoading: true }));

      const response = await fetch(
        `${API_BASE_URL}/api/v1/auth/resend-verification/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        setModalMessage("Verification email sent! Please check your inbox.");
      } else {
        throw new Error(data.error || "Failed to send verification email");
      }
    } catch (error: any) {
      setModalMessage(
        error instanceof Error
          ? error.message
          : "Failed to send verification email"
      );
    } finally {
      setAuthState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  return (
    <div className="relative w-full min-h-screen bg-warmBg flex items-center justify-center px-4 py-10 sm:p-6 font-urbanist">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[30vh] bg-auth-ambient opacity-40 blur-2xl" />

      {/* Glassmorphism Card */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white/55 backdrop-blur-2xl ring-1 ring-white/60 border border-white/30 shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
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
            <h1 className="text-4xl font-semibold text-black mb-8">Sign up</h1>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSignup}
            className="space-y-6"
            autoComplete="off"
            noValidate
          >
            {/* First Name */}
            <div>
              <label className="mb-2 block text-base font-semibold text-ink">
                First Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={credentials.firstName}
                  onChange={(e) =>
                    setCredentials({
                      ...credentials,
                      firstName: e.target.value,
                    })
                  }
                  disabled={authState.isLoading}
                  className="w-full h-12 rounded-xl border border-white/60 bg-white/80 shadow-inner px-5 text-ink placeholder-black/35 outline-none focus:ring-4 focus:ring-black/5"
                  placeholder="John"
                  required
                />
                <User className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/40 w-5 h-5" />
              </div>
              {validationErrors.firstName && (
                <p className="text-sm text-red-600 mt-1">
                  {validationErrors.firstName}
                </p>
              )}
            </div>

            {/* Last Name */}
            <div>
              <label className="mb-2 block text-base font-semibold text-ink">
                Last Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={credentials.lastName}
                  onChange={(e) =>
                    setCredentials({
                      ...credentials,
                      lastName: e.target.value,
                    })
                  }
                  disabled={authState.isLoading}
                  className="w-full h-12 rounded-xl border border-white/60 bg-white/80 shadow-inner px-5 text-ink placeholder-black/35 outline-none focus:ring-4 focus:ring-black/5"
                  placeholder="Doe"
                  required
                />
                <User className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/40 w-5 h-5" />
              </div>
              {validationErrors.lastName && (
                <p className="text-sm text-red-600 mt-1">
                  {validationErrors.lastName}
                </p>
              )}
            </div>

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
                  disabled={authState.isLoading}
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
                  autoComplete="new-password"
                  value={credentials.password}
                  onChange={(e) =>
                    setCredentials({
                      ...credentials,
                      password: e.target.value,
                    })
                  }
                  disabled={authState.isLoading}
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

            {/* Confirm Password */}
            <div>
              <label className="mb-2 block text-base font-medium text-ink">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={credentials.confirmPassword}
                  onChange={(e) =>
                    setCredentials({
                      ...credentials,
                      confirmPassword: e.target.value,
                    })
                  }
                  disabled={authState.isLoading}
                  className="w-full h-12 rounded-xl border border-white/60 bg-white/80 shadow-inner px-5 text-ink placeholder-black/35 outline-none focus:ring-4 focus:ring-black/5 pr-12"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-black/50 hover:text-black/80 transition-colors"
                  disabled={authState.isLoading}
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {validationErrors.confirmPassword && (
                <p className="text-sm text-red-600 mt-1">
                  {validationErrors.confirmPassword}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={authState.isLoading}
              className="w-full h-12 rounded-xl font-semibold bg-goldYellow text-ink hover:opacity-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="inline-flex items-center justify-center gap-2">
                {signupStatus === "loading" ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating account...
                  </>
                ) : signupStatus === "success" ? (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Success!
                  </>
                ) : signupStatus === "error" ? (
                  <>
                    <AlertCircle className="w-5 h-5" />
                    Try again
                  </>
                ) : (
                  <>Sign up</>
                )}
              </span>
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center text-sm text-ink/50">
            Already have an account?{" "}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-sky-600 font-medium hover:underline"
              disabled={authState.isLoading}
            >
              Log in
            </button>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-lg p-6">
            <button
              onClick={handleCloseSuccessModal}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex flex-col items-center text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Account Created
              </h3>
              <p className="text-gray-600 mb-4">{modalMessage}</p>

              {/* ✅ NEW: Resend verification option */}
              <button
                onClick={() => handleResendVerification(credentials.email)}
                className="text-sm text-sky-600 font-medium hover:underline mb-4"
                disabled={authState.isLoading}
              >
                Didn't receive the email? Resend verification
              </button>

              <button
                onClick={handleCloseSuccessModal}
                className="px-6 py-2 bg-goldYellow text-ink font-semibold rounded-xl hover:opacity-90 transition-opacity"
              >
                Continue to Login
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-lg p-6">
            <button
              onClick={handleCloseErrorModal}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex flex-col items-center text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Sign Up Failed
              </h3>
              <p className="text-gray-600 mb-6">{modalMessage}</p>
              <button
                onClick={handleCloseErrorModal}
                className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-xl hover:bg-gray-300 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SignupPage;
