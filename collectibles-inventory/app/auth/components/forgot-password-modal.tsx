"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { X, Mail, Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "../context/auth-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefilledEmail?: string; // Add this prop
}

export function ForgotPasswordModal({
  isOpen,
  onClose,
  prefilledEmail = "", // Initialize with default value
}: ForgotPasswordModalProps) {
  const [email, setEmail] = useState(prefilledEmail); // Use prefilledEmail as initial value
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  // Get the auth functions using the hook
  const auth = useAuth();

  // Update email when prefilledEmail changes
  useEffect(() => {
    if (prefilledEmail) {
      setEmail(prefilledEmail);
    }
  }, [prefilledEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setError("Email is required");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Use the forgotPassword function from auth context
      const success = await auth.forgotPassword(email);
      if (success) {
        setIsSuccess(true);
      } else {
        setError("Failed to send reset email. Please try again.");
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to send reset email",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail("");
    setError("");
    setIsSuccess(false);
    setIsLoading(false);
    onClose();
  };

  const handleBackToLogin = () => {
    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSuccess ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                Check Your Email
              </>
            ) : (
              <>
                <Mail className="h-5 w-5 text-blue-600" />
                Reset Password
              </>
            )}
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-4 top-4"
            onClick={handleClose}
          >
            {/* X mark removed as requested */}
          </Button>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {isSuccess ? (
            // Success State
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Reset Link Sent!
                </h3>
                <p className="text-sm text-gray-600">
                  We've sent a password reset link to <strong>{email}</strong>
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  Check your email and follow the instructions to reset your
                  password.
                </p>
              </div>

              <Alert className="border-blue-200 bg-blue-50">
                <AlertDescription className="text-blue-800 text-sm">
                  Didn't receive the email? Check your spam folder or try again
                  in a few minutes.
                </AlertDescription>
              </Alert>

              <Button
                onClick={handleBackToLogin}
                variant="outline"
                className="w-full bg-transparent"
              >
                <ArrowLeft className="h-4 w-4 mr-2 text-sky-600" />
                Back to Login
              </Button>
            </div>
          ) : (
            // Form State
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Enter your email address and we'll send you a link to reset
                  your password.
                </p>
              </div>

              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-800">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label
                  htmlFor="reset-email"
                  className="text-sm font-medium text-gray-700"
                >
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError("");
                    }}
                    className="pl-10"
                    placeholder="Enter your email"
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading || !email}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending Reset Link...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </Button>

              <Button
                type="button"
                onClick={handleBackToLogin}
                variant="ghost"
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2 text-sky-600" />
                Back to Login
              </Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
