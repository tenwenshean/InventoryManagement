import { useCallback } from "react";

/**
 * Currency configuration for customer-facing display
 * Prices are shown in the seller's currency - NO conversion
 */
const currencyMap: Record<string, string> = {
  usd: "USD",
  eur: "EUR",
  gbp: "GBP",
  cad: "CAD",
  sgd: "SGD",
  myr: "MYR",
  jpy: "JPY",
};

const currencyLocaleMap: Record<string, string> = {
  usd: "en-US",
  eur: "de-DE",
  gbp: "en-GB",
  cad: "en-CA",
  sgd: "en-SG",
  myr: "ms-MY",
  jpy: "ja-JP",
};

/**
 * Hook for customer-facing currency display
 * Displays prices in the seller's original currency (no conversion)
 * The seller's currency comes from the product data, not localStorage
 */
export function useCustomerCurrency() {
  /**
   * Formats a price for customer display in the seller's currency
   * @param amount - Price amount
   * @param sellerCurrency - The seller's currency code (e.g., 'usd', 'myr')
   * @returns Formatted currency string in seller's currency
   */
  const formatPrice = useCallback((
    amount: number | string | undefined | null, 
    sellerCurrency?: string
  ): string => {
    const n = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
    const numAmount = Number.isFinite(n) ? n : 0;
    
    // Use seller's currency or default to USD
    const currencyCode = sellerCurrency?.toLowerCase() || 'usd';
    const intlCurrency = currencyMap[currencyCode] || "USD";
    const locale = currencyLocaleMap[currencyCode] || "en-US";
    
    try {
      return new Intl.NumberFormat(locale, { 
        style: "currency", 
        currency: intlCurrency, 
        maximumFractionDigits: 2 
      }).format(numAmount);
    } catch {
      // Fallback simple format based on currency
      const symbol = intlCurrency === "EUR" ? "€" : 
                     intlCurrency === "GBP" ? "£" : 
                     intlCurrency === "CAD" ? "CA$" : 
                     intlCurrency === "SGD" ? "S$" : 
                     intlCurrency === "MYR" ? "RM" : 
                     intlCurrency === "JPY" ? "¥" : "$";
      return `${symbol}${numAmount.toFixed(intlCurrency === "JPY" ? 0 : 2)}`;
    }
  }, []);

  /**
   * Legacy format function for backward compatibility
   * Uses USD as default when seller currency not provided
   */
  const formatPriceUSD = useCallback((amount: number | string | undefined | null): string => {
    return formatPrice(amount, 'usd');
  }, [formatPrice]);

  return { 
    formatPrice,
    formatPriceUSD,
  };
}
