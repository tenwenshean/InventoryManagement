import { useMemo } from "react";

const currencyMap: Record<string, string> = {
  usd: "USD",
  eur: "EUR",
  gbp: "GBP",
  cad: "CAD",
};

function detectCurrency(): string {
  try {
    const viewer = localStorage.getItem("viewer_currency");
    if (viewer && currencyMap[viewer]) return viewer;

    const appPref = localStorage.getItem("app_currency");
    if (appPref && currencyMap[appPref]) return appPref;
  } catch {}
  return "usd";
}

export function useCurrency() {
  const code = useMemo(() => detectCurrency(), []);
  const intlCode = currencyMap[code] || "USD";

  const formatCurrency = (amount: number | string | undefined | null) => {
    const n = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: intlCode, maximumFractionDigits: 2 }).format(Number.isFinite(n as number) ? (n as number) : 0);
    } catch {
      // Fallback simple format
      const symbol = intlCode === "EUR" ? "€" : intlCode === "GBP" ? "£" : intlCode === "CAD" ? "CA$" : "$";
      const num = Number.isFinite(n as number) ? (n as number) : 0;
      return `${symbol}${num.toFixed(2)}`;
    }
  };

  return { currencyCode: code, formatCurrency };
}
