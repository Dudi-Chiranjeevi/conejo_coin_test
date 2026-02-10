export interface ChatMessage {
  id: string
  type: "user" | "ai" | "system"
  content: string
  timestamp: string
  hasChart?: boolean
  hasTable?: boolean
  confidence?: "high" | "medium" | "low"
  processingTime?: string
}

export interface QuerySuggestion {
  id: string
  text: string
  icon?: string
  resultType: "chart" | "table" | "value" | "summary"
  category: string
  description?: string
}

export interface QueryResult {
  id: string
  query: string
  type: "table" | "chart" | "summary"
  data: any
  processingTime: string
  confidence: "high" | "medium" | "low"
  timestamp: string
}

export interface QueryHistoryItem {
  id: string
  query: string
  timestamp: string
  resultType: "table" | "chart" | "summary" | "value"
  isFavorited: boolean
  processingTime: string
  resultPreview: string
  confidence: "high" | "medium" | "low"
}

export interface ChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    backgroundColor: string[]
    borderColor?: string[]
  }[]
}

export interface TableData {
  columns: string[]
  data: (string | number)[][]
  totalRows: number
}
