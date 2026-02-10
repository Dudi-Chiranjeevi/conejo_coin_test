export type SQLResponse = { sql: string }

export interface FAQ {
  id: number;
  question: string;
  sql: string;
  category: string;
  created_at: string;
}

export async function askSQL(question: string, opts?: { forceRefresh?: boolean }) {
  const res = await fetch("/api/v1/ai/sql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      force_refresh: opts?.forceRefresh ?? false, 
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `HTTP ${res.status}`)
  }
  const data = (await res.json()) as SQLResponse
  return data.sql?.trim()
}

// FAQ Management Functions
export async function getFAQs(category?: string): Promise<FAQ[]> {
  const url = new URL("/api/v1/ai/faqs", window.location.origin);
  if (category) {
    url.searchParams.append("category", category);
  }
  
  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  
  return res.json();
}

export async function queryFAQs(query: string, category?: string, limit: number = 5): Promise<FAQ[]> {
  const res = await fetch("/api/v1/ai/faqs/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      category,
      limit,
    }),
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  
  return res.json();
}

export async function createFAQ(data: { question: string; sql: string; category: string }): Promise<FAQ> {
  const res = await fetch("/api/v1/ai/faqs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  
  return res.json();
}

export async function updateFAQ(id: number, data: { question?: string; sql?: string; category?: string }): Promise<FAQ> {
  const res = await fetch(`/api/v1/ai/faqs/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  
  return res.json();
}

export async function deleteFAQ(id: number): Promise<void> {
  const res = await fetch(`/api/v1/ai/faqs/${id}`, {
    method: "DELETE",
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
}
