// types/ebay.ts
export interface StatusCard {
  title: string
  count: number
  change: string
  icon: string
  color: "blue" | "green" | "yellow" | "red"
  trend: "up" | "down" | "neutral"
}

export interface SyncStatus {
  lastSync: string
  status: "success" | "syncing" | "error"
  nextSync: string
  syncDuration: string
}

export interface InventoryItem {
  id: number
  name: string
  category: string
  price: number
  status: string
  thumbnail: string
  description: string
  images: string[] // Added this
  attributes: Record<string, any> // Added this
  is_listed?: boolean // ✅ ADD THIS
  previously_listed?: boolean; // ADD THIS LINE
}

export interface ListingTemplate {
  id: string
  name: string
  description: string
  preview: string
  category: string
}

export interface SyncProgress {
  isActive: boolean
  currentStep: string
  progress: number
  itemsProcessed: number
  totalItems: number
  timeRemaining: string
  errors: number
}

export interface SyncError {
  id: number
  timestamp: string
  type: string
  message: string
  itemId: number
  itemName: string
  retryable: boolean
  attempts: number
}

export const statusData: StatusCard[] = [
  {
    title: "Active Listings",
    count: 247,
    change: "+12 this week",
    icon: "bar-chart",
    color: "blue",
    trend: "up",
  },
  {
    title: "Sold Items",
    count: 89,
    change: "+23 this week",
    icon: "dollar-sign",
    color: "green",
    trend: "up",
  },
  {
    title: "Pending Listings",
    count: 15,
    change: "Awaiting approval",
    icon: "clock",
    color: "yellow",
    trend: "neutral",
  },
  {
    title: "Sync Errors",
    count: 3,
    change: "Need attention",
    icon: "alert-triangle",
    color: "red",
    trend: "down",
  },
]

export const inventoryItems: InventoryItem[] = [
  {
    id: 1,
    name: "1851-O $2.5 Gold Liberty Head",
    category: "Coins",
    price: 2450.0,
    status: "In Store",
    thumbnail: "/placeholder.svg?height=100&width=100",
    description: "Beautiful AU-58 graded gold coin with original luster",
    images: ["/placeholder.svg?height=100&width=100"], // Added
    is_listed: false,
    attributes: { // Added
      grade: "AU-58",
      year: "1851",
      mint: "New Orleans",
      denomination: "$2.5",
      certification: "PCGS",
      metal: "Gold"
    }
  },
  {
    id: 2,
    name: "1893 Columbian Exposition Stamp",
    category: "Stamps",
    price: 125.0,
    status: "In Store",
    thumbnail: "/placeholder.svg?height=100&width=100",
    description: "Mint condition commemorative stamp",
    images: ["/placeholder.svg?height=100&width=100"], // Added
    is_listed: false,
    attributes: { // Added
      condition: "Mint",
      year: "1893"
    }
  },
  {
    id: 3,
    name: "1986 Michael Jordan Rookie Card",
    category: "Cards",
    price: 8500.0,
    status: "In Store",
    thumbnail: "/placeholder.svg?height=100&width=100",
    description: "PSA 9 graded rookie card in excellent condition",
    images: ["/placeholder.svg?height=100&width=100"], // Added
    is_listed: false,
    attributes: { // Added
      grade: "PSA 9",
      year: "1986",
      player: "Michael Jordan"
    }
  },
  {
    id: 4,
    name: "American Silver Eagle 2023",
    category: "Silver",
    price: 35.0,
    status: "In Store",
    thumbnail: "/placeholder.svg?height=100&width=100",
    description: "Uncirculated American Silver Eagle coin",
    images: ["/placeholder.svg?height=100&width=100"], // Added
    is_listed: false,
    attributes: { // Added
      year: "2023",
      metal: "Silver",
      weight: "1 oz"
    }
  },
]

export const listingTemplates: ListingTemplate[] = [
  {
    id: "premium-coin",
    name: "Premium Coin Template",
    description: "Professional layout for high-value coins",
    preview: "Elegant design with certification details",
    category: "Coins",
  },
  {
    id: "standard-stamp",
    name: "Standard Stamp Template",
    description: "Clean layout for stamp collectors",
    preview: "Focus on condition and postal history",
    category: "Stamps",
  },
  {
    id: "sports-card",
    name: "Sports Card Template",
    description: "Dynamic layout for trading cards",
    preview: "Highlights player stats and card condition",
    category: "Cards",
  },
  {
    id: "bullion-basic",
    name: "Bullion Basic Template",
    description: "Simple layout for precious metals",
    preview: "Clean design focusing on weight and purity",
    category: "Metals",
  },
]

export const syncErrors: SyncError[] = [
  {
    id: 1,
    timestamp: "2024-01-15 14:32:15",
    type: "Rate Limit",
    message: "eBay API rate limit exceeded",
    itemId: 1851,
    itemName: "1921 Morgan Dollar",
    retryable: true,
    attempts: 2,
  },
  {
    id: 2,
    timestamp: "2024-01-15 14:28:09",
    type: "Invalid Category",
    message: "Category 'Ancient Coins' not found",
    itemId: 1847,
    itemName: "Roman Denarius",
    retryable: false,
    attempts: 1,
  },
  {
    id: 3,
    timestamp: "2024-01-15 14:25:33",
    type: "Network Error",
    message: "Connection timeout during upload",
    itemId: 1849,
    itemName: "Walking Liberty Half Dollar",
    retryable: true,
    attempts: 1,
  },
]