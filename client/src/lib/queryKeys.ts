export const queryKeys = {
  products: {
    all: ["/api/products"] as const,
    detail: (id: string) => ["/api/products", id] as const,
    stats: ["/api/products/stats"] as const,
  },
  dashboard: {
    stats: ["/api/dashboard/stats"] as const,
  },
  categories: {
    all: ["/api/categories"] as const,
  },
  inventory: {
    all: ["/api/inventory"] as const,
    detail: (id: string) => ["/api/inventory", id] as const,
  },
  accounting: {
    entries: ["/api/accounting/entries"] as const,
    report: ["/api/accounting/report"] as const,
  }
} as const;