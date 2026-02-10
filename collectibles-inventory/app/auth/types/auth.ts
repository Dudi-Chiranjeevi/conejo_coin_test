import { Permission } from "@/app/settings/types/rbac";

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: "super-admin" | "admin" | "manager" | "user" | "guest" | string
  phone: string;
  description: string;
  avatar?: string
  lastLogin?: string
  twoFactorEnabled: boolean
  permissions?: Permission[]
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  loginAttempts: number
  isLocked: boolean
  lockoutTime?: number
}

export interface SignupCredentials {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
}

export interface LoginCredentials {
  email: string
  password: string
  rememberMe: boolean
}

export interface PasswordResetRequest {
  email: string
}

export interface PasswordReset {
  token: string
  password: string
  confirmPassword: string
}

export interface TwoFactorVerification {
  code: string
  backupCode?: string
}

export const mockUser: User = {
  id: "1",
  email: "admin@conejocoin.com",
  firstName: "Madhuri",
  lastName: "Pothapragada",
  phone:"",
  description:"",
  role: "admin",
  avatar: "/placeholder.svg?height=40&width=40",
  lastLogin: "2024-01-15T10:30:00Z",
  twoFactorEnabled: true,
}

// Mock authentication functions
export const mockLogin = async (credentials: LoginCredentials): Promise<{ user: User; requiresTwoFactor: boolean }> => {
  await new Promise((resolve) => setTimeout(resolve, 2000)) // Simulate API delay

  if (credentials.email === "admin@conejocoin.com" && credentials.password === "password123") {
    return { user: mockUser, requiresTwoFactor: true }
  }

  throw new Error("Invalid email or password")
}

export const mockVerifyTwoFactor = async (code: string): Promise<User> => {
  await new Promise((resolve) => setTimeout(resolve, 1500))

  if (code === "123456") {
    return mockUser
  }

  throw new Error("Invalid verification code")
}

export const mockForgotPassword = async (email: string): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 1000))
  // Always succeed for demo
}

export const mockResetPassword = async (token: string, password: string): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 1000))
  // Always succeed for demo
}
