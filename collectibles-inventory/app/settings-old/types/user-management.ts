export interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  avatar?: string
  role: UserRole
  status: "active" | "inactive" | "pending"
  department?: string
  lastLogin?: string
  createdAt: string
  isEmailVerified: boolean
  twoFactorEnabled: boolean
  permissions: Permission[]
}

export interface UserRole {
  id: string
  name: string
  description: string
  color: string
  permissions: Permission[]
  userCount: number
  isCustom: boolean
}

export interface Permission {
  id: string
  module: string
  action: "view" | "create" | "edit" | "delete" | "admin"
  granted: boolean
}

export interface UserStats {
  totalUsers: number
  activeUsers: number
  adminUsers: number
  recentActivity: number
  trends: {
    totalChange: number
    activeChange: number
    adminChange: number
  }
}

export interface APIConfig {
  id: string
  name: string
  status: "connected" | "disconnected" | "error"
  endpoint: string
  apiKey: string
  lastSync?: string
  rateLimitUsed: number
  rateLimitTotal: number
  settings: Record<string, any>
}

export interface SystemSettings {
  autoSyncInterval: number
  syncSchedule: string
  dataRetentionDays: number
  backupEnabled: boolean
  notificationThresholds: {
    lowStock: number
    highValue: number
    syncErrors: number
  }
}

export interface UserSession {
  id: string
  deviceInfo: string
  location: string
  lastActivity: string
  isCurrentSession: boolean
}

// Mock data
export const mockUsers: User[] = [
  {
    id: "1",
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@conejocoin.com",
    phone: "+1 (555) 123-4567",
    avatar: "/placeholder.svg?height=40&width=40",
    role: {
      id: "admin",
      name: "Administrator",
      description: "Full system access",
      color: "#2196F3",
      permissions: [],
      userCount: 3,
      isCustom: false,
    },
    status: "active",
    department: "Management",
    lastLogin: "2024-01-15T10:30:00Z",
    createdAt: "2023-06-01T00:00:00Z",
    isEmailVerified: true,
    twoFactorEnabled: true,
    permissions: [],
  },
  {
    id: "2",
    firstName: "Sarah",
    lastName: "Johnson",
    email: "sarah.johnson@conejocoin.com",
    avatar: "/placeholder.svg?height=40&width=40",
    role: {
      id: "manager",
      name: "Manager",
      description: "Department management access",
      color: "#FF9800",
      permissions: [],
      userCount: 5,
      isCustom: false,
    },
    status: "active",
    department: "Operations",
    lastLogin: "2024-01-15T08:15:00Z",
    createdAt: "2023-08-15T00:00:00Z",
    isEmailVerified: true,
    twoFactorEnabled: false,
    permissions: [],
  },
  {
    id: "3",
    firstName: "Mike",
    lastName: "Chen",
    email: "mike.chen@conejocoin.com",
    role: {
      id: "user",
      name: "User",
      description: "Standard user access",
      color: "#4CAF50",
      permissions: [],
      userCount: 12,
      isCustom: false,
    },
    status: "inactive",
    department: "Inventory",
    lastLogin: "2024-01-10T14:22:00Z",
    createdAt: "2023-09-20T00:00:00Z",
    isEmailVerified: true,
    twoFactorEnabled: false,
    permissions: [],
  },
]

export const mockUserStats: UserStats = {
  totalUsers: 20,
  activeUsers: 18,
  adminUsers: 3,
  recentActivity: 15,
  trends: {
    totalChange: 2,
    activeChange: 1,
    adminChange: 0,
  },
}

export const mockAPIConfigs: APIConfig[] = [
  {
    id: "ngc",
    name: "NGC API",
    status: "connected",
    endpoint: "https://api.ngccoin.com/v1",
    apiKey: "ngc_****_****_****_1234",
    lastSync: "2024-01-15T10:30:00Z",
    rateLimitUsed: 450,
    rateLimitTotal: 1000,
    settings: {
      autoSync: true,
      syncInterval: 15,
    },
  },
  {
    id: "ebay",
    name: "eBay API",
    status: "connected",
    endpoint: "https://api.ebay.com/ws/api.dll",
    apiKey: "ebay_****_****_****_5678",
    lastSync: "2024-01-15T09:45:00Z",
    rateLimitUsed: 2300,
    rateLimitTotal: 5000,
    settings: {
      sandbox: false,
      autoList: true,
    },
  },
  {
    id: "openai",
    name: "OpenAI API",
    status: "error",
    endpoint: "https://api.openai.com/v1",
    apiKey: "sk-****_****_****_9012",
    rateLimitUsed: 0,
    rateLimitTotal: 10000,
    settings: {
      model: "gpt-4",
      maxTokens: 2000,
    },
  },
]

export const mockUserRoles: UserRole[] = [
  {
    id: "super-admin",
    name: "Super Administrator",
    description: "Complete system control and configuration",
    color: "#9C27B0",
    permissions: [],
    userCount: 1,
    isCustom: false,
  },
  {
    id: "admin",
    name: "Administrator",
    description: "Full system access with user management",
    color: "#2196F3",
    permissions: [],
    userCount: 3,
    isCustom: false,
  },
  {
    id: "manager",
    name: "Manager",
    description: "Department management and reporting access",
    color: "#FF9800",
    permissions: [],
    userCount: 5,
    isCustom: false,
  },
  {
    id: "user",
    name: "User",
    description: "Standard inventory management access",
    color: "#4CAF50",
    permissions: [],
    userCount: 12,
    isCustom: false,
  },
  {
    id: "guest",
    name: "Guest",
    description: "Read-only access to basic features",
    color: "#607D8B",
    permissions: [],
    userCount: 2,
    isCustom: false,
  },
]

export const mockPermissionModules = [
  {
    id: "inventory",
    name: "Inventory Management",
    permissions: ["view", "create", "edit", "delete"],
  },
  {
    id: "locations",
    name: "Location Management",
    permissions: ["view", "create", "edit", "delete"],
  },
  {
    id: "reports",
    name: "Reports & Analytics",
    permissions: ["view", "create", "export"],
  },
  {
    id: "users",
    name: "User Management",
    permissions: ["view", "create", "edit", "delete", "admin"],
  },
  {
    id: "settings",
    name: "System Settings",
    permissions: ["view", "edit", "admin"],
  },
  {
    id: "api",
    name: "API Management",
    permissions: ["view", "configure", "admin"],
  },
]
