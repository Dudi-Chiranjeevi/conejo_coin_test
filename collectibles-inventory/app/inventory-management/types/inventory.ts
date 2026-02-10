export interface InventoryItem {
  id: string // UUID from API
  name: string
  category: string // UUID reference to category
  status: "in_store" | "in_transit" | "consigned" | "sold" | "ebay"
  price: string // Decimal as string from API
  thumbnail: string
  frontURL?: string // Front image URL
  description?: string
  date_added?: string // API uses snake_case
  updated_at?: string // Last update timestamp
  updated_by?: string // Last updater identifier
  location?: string // UUID reference to location
  notes?: string
  images?: {
    meta?: Record<string, any>
    source?: string
    rear_url?: string
    front_url?: string
    rear_thumbnail_url?: string
    front_thumbnail_url?: string
  }[] // Array of image objects from API
  weight?: string // Decimal as string from API
  weight_unit?: "g" | "oz"
  is_consigned?: boolean
  quantity?: number // Number of items in inventory
  identification_number?: string // Certificate or identification number
  
  // API fields for related objects
  category_name?: string // Name of the category from API
  location_name?: string // Name of the location from API
  location_path?: string // Full path of the location from API
  attributes?: Record<string, any> // JSON attributes from API
  
  // Frontend-only fields for UI display
  displayCategory?: string // Human-readable category name
  displayLocation?: string // Human-readable location
  displayStatus?: string // Human-readable status
  
  categorySpecifics?: {
    // Coins
    certNumber?: string
    grade?: string
    year?: string
    mintMark?: string
    denomination?: string
    metalType?: string
    // Stamps
    issueDate?: string
    perforation?: string
    condition?: string
    country?: string
    // Cards
    playerName?: string
    cardYear?: string
    brand?: string
    cardNumber?: string
    cardCondition?: string
    // Musical Instruments
    serialNumber?: string
    make?: string
    model?: string
  }
}

// Status mapping for display purposes
export const statusMapping = {
  in_store: "In Store",
  in_transit: "In Transit",
  consigned: "Consigned",
  sold: "Sold",
  ebay: "eBay"
};

// Mock items for development/testing only
export const mockItems: InventoryItem[] = [
  {
    id: "1",
    name: "1851-O $2.5 Gold Liberty",
    category: "coins-category-uuid",
    status: "in_store",
    price: "2450.00",
    thumbnail: "/placeholder.svg?height=64&width=64",
    description: "Rare New Orleans mint gold quarter eagle in excellent condition",
    date_added: "2024-01-15",
    location: "location-uuid-1",
    displayCategory: "Coins",
    displayLocation: "Building A > Room 1 > Shelf 3",
    displayStatus: "In Store",
    categorySpecifics: {
      certNumber: "PCGS-12345",
      grade: "MS-63",
      year: "1851",
      mintMark: "O",
      denomination: "$2.50",
      metalType: "Gold",
    },
  },
  {
    id: "2",
    name: "1893 Columbian Exposition Stamp",
    category: "stamps-category-uuid",
    status: "ebay",
    price: "125.00",
    thumbnail: "/placeholder.svg?height=64&width=64",
    description: "Commemorative stamp from the World's Columbian Exposition",
    date_added: "2024-01-10",
    location: "location-uuid-2",
    displayCategory: "Stamps",
    displayLocation: "Building A > Room 2 > Cabinet 1",
    displayStatus: "eBay",
    categorySpecifics: {
      issueDate: "1893",
      perforation: "12",
      condition: "Very Fine",
      country: "United States",
    },
  },
  {
    id: "3",
    name: "1964 Fender Stratocaster",
    category: "instruments-category-uuid",
    status: "consigned",
    price: "12500.00",
    thumbnail: "/placeholder.svg?height=64&width=64",
    description: "Pre-CBS Fender Stratocaster in sunburst finish",
    date_added: "2023-12-05",
    location: "location-uuid-3",
    displayCategory: "Musical Instruments",
    displayLocation: "Building B > Secure Room",
    displayStatus: "Consigned",
    categorySpecifics: {
      serialNumber: "L54321",
      year: "1964",
      make: "Fender",
      model: "Stratocaster",
      condition: "Excellent",
    },
  },
  {
    id: "4",
    name: "American Silver Eagle 2023",
    category: "silver-category-uuid",
    status: "in_store",
    price: "35.00",
    thumbnail: "/placeholder.svg?height=64&width=64",
    description: "Uncirculated American Silver Eagle coin",
    date_added: "2024-01-25",
    location: "location-uuid-4",
    displayCategory: "Silver",
    displayLocation: "Building A > Room 1 > Shelf 1",
    displayStatus: "In Store",
  },
  {
    id: "5",
    name: "1 oz Gold Bar - PAMP Suisse",
    category: "gold-category-uuid",
    status: "in_transit",
    price: "2100.00",
    thumbnail: "/placeholder.svg?height=64&width=64",
    description: "1 troy ounce gold bar with assay certificate",
    date_added: "2024-01-22",
    location: "location-uuid-5",
    displayCategory: "Gold",
    displayLocation: "In Transit",
    displayStatus: "In Transit",
  },
  {
    id: "6",
    name: "Babe Ruth 1933 Goudey",
    category: "cards-category-uuid",
    status: "sold",
    price: "15000.00",
    thumbnail: "/placeholder.svg?height=64&width=64",
    description: "Extremely rare Babe Ruth card in good condition",
    date_added: "2024-01-05",
    location: "location-uuid-6",
    displayCategory: "Cards",
    displayLocation: "Sold",
    displayStatus: "Sold",
    categorySpecifics: {
      playerName: "Babe Ruth",
      cardYear: "1933",
      brand: "Goudey",
      cardNumber: "#181",
      cardCondition: "Good",
    },
  },
  {
    id: "7",
    name: "1909-S VDB Lincoln Cent",
    category: "coins-category-uuid",
    status: "in_store",
    price: "750.00",
    thumbnail: "/placeholder.svg?height=64&width=64",
    description: "Key date Lincoln cent with VDB initials",
    date_added: "2024-01-18",
    location: "location-uuid-7",
    displayCategory: "Coins",
    displayLocation: "Building A > Room 1 > Shelf 2",
    displayStatus: "In Store",
    categorySpecifics: {
      certNumber: "NGC-67890",
      grade: "VF-20",
      year: "1909",
      mintMark: "S",
      denomination: "1¢",
      metalType: "Bronze",
    },
  },
  {
    id: "8",
    name: "Inverted Jenny Stamp Replica",
    category: "stamps-category-uuid",
    status: "in_store",
    price: "45.00",
    thumbnail: "/placeholder.svg?height=64&width=64",
    description: "High-quality replica of the famous inverted Jenny stamp",
    date_added: "2024-01-12",
    location: "location-uuid-8",
    displayCategory: "Stamps",
    displayLocation: "Building A > Room 2 > Cabinet 2",
    displayStatus: "In Store",
    categorySpecifics: {
      issueDate: "1918",
      perforation: "11",
      condition: "Mint",
      country: "United States",
    },
  },
  {
    id: "9",
    name: "Diamond Solitaire Ring 2ct",
    category: "diamonds-category-uuid",
    status: "consigned",
    price: "12000.00",
    thumbnail: "/placeholder.svg?height=64&width=64",
    description: "2 carat round brilliant cut diamond in platinum setting",
    date_added: "2024-01-30",
    location: "location-uuid-9",
    displayCategory: "Diamonds",
    displayLocation: "Building B > Vault > Slot 5",
    displayStatus: "Consigned",
  },
  {
    id: "10",
    name: "Silver Maple Leaf 2024",
    category: "silver-category-uuid",
    status: "in_store",
    price: "32.00",
    thumbnail: "/placeholder.svg?height=64&width=64",
    description: "Canadian Silver Maple Leaf coin, 1 oz pure silver",
    date_added: "2024-02-01",
    location: "location-uuid-10",
    displayCategory: "Silver",
    displayLocation: "Building A > Room 1 > Shelf 1",
    displayStatus: "In Store",
  },
];
