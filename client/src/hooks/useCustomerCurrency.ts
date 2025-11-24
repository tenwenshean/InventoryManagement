import { useMemo } from "react";

/**
 * Exchange rates relative to USD (1 USD = X currency)
 * 
 * IMPORTANT: These are static rates for demonstration purposes.
 * In production, these should come from a live API like:
 * - exchangerate-api.com
 * - openexchangerates.org
 * - currencyapi.com
 * 
 * Update these rates regularly or integrate with a live API service.
 * Last updated: November 2025
 */
const exchangeRates: Record<string, number> = {
  usd: 1.0,
  eur: 0.92,      // 1 USD = 0.92 EUR
  gbp: 0.79,      // 1 USD = 0.79 GBP
  cad: 1.36,      // 1 USD = 1.36 CAD
  sgd: 1.34,      // 1 USD = 1.34 SGD
  myr: 4.47,      // 1 USD = 4.47 MYR
  jpy: 149.50,    // 1 USD = 149.50 JPY
};

const currencyMap: Record<string, string> = {
  usd: "USD",
  eur: "EUR",
  gbp: "GBP",
  cad: "CAD",
  sgd: "SGD",
  myr: "MYR",
  jpy: "JPY",
};

function detectShopCurrency(): string {
  try {
    // For customer view, we need to know the shop's currency to convert from
    const viewer = localStorage.getItem("viewer_currency");
    if (viewer && currencyMap[viewer]) return viewer;

    const appPref = localStorage.getItem("app_currency");
    if (appPref && currencyMap[appPref]) return appPref;
  } catch {}
  return "usd";
}

/**
 * Hook for customer-facing currency display
 * Always shows prices in USD, but converts from the shop's currency
 */
export function useCustomerCurrency() {
  const shopCurrencyCode = useMemo(() => detectShopCurrency(), []);
  
  /**
   * Converts a price from the shop's currency to USD for customer display
   * @param amount - Price in shop's currency
   * @returns Price converted to USD
   */
  const convertToUSD = (amount: number | string | undefined | null): number => {
    const n = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
    const numAmount = Number.isFinite(n as number) ? (n as number) : 0;
    
    // If already in USD, no conversion needed
    if (shopCurrencyCode === "usd") {
      return numAmount;
    }
    
    // Convert from shop currency to USD
    const rate = exchangeRates[shopCurrencyCode] || 1.0;
    return numAmount / rate;
  };

  /**
   * Formats a price for customer display (always in USD)
   * @param amount - Price in shop's currency (will be converted to USD)
   * @returns Formatted USD string
   */
  const formatPrice = (amount: number | string | undefined | null): string => {
    const usdAmount = convertToUSD(amount);
    
    try {
      return new Intl.NumberFormat("en-US", { 
        style: "currency", 
        currency: "USD", 
        maximumFractionDigits: 2 
      }).format(usdAmount);
    } catch {
      // Fallback simple format
      return `$${usdAmount.toFixed(2)}`;
    }
  };

  return { 
    formatPrice,
    convertToUSD,
    shopCurrency: currencyMap[shopCurrencyCode] || "USD"
  };
}
