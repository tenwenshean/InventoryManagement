export const queryKeys = {
  products: {
    all: ["/api/products"] as const,
    detail: (id: string) => ["/api/products", id] as const,
    stats: ["/api/products/stats"] as const,
  },
  // Public products for customer shop (separate from enterprise products)
  publicProducts: {
    all: ["/api/public/products"] as const,
    bySeller: (sellerId: string) => ["/api/public/products/seller", sellerId] as const,
  },
  dashboard: {
    stats: ["/api/dashboard/stats"] as const,
  },
  categories: {
    all: ["/api/categories"] as const,
  },
  publicCategories: {
    all: ["/api/public/categories"] as const,
  },
  inventory: {
    all: ["/api/inventory"] as const,
    detail: (id: string) => ["/api/inventory", id] as const,
  },
  accounting: {
    entries: (month?: string) => ["/api/accounting/entries", month ?? "all"] as const,
    entriesRoot: ["/api/accounting/entries"] as const,
    report: (month?: string) => ["/api/accounting/report", month ?? "current"] as const,
    reportRoot: ["/api/accounting/report"] as const,
  }
} as const;