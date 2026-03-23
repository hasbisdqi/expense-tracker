export interface Currency {
  code: string; // ISO 4217 code
  symbol: string; // Display symbol
  name: string; // Human friendly name
  locale: string; // locale for formatting
}

/**
 * Reference: https://www.xe.com/symbols/
 */
export const SUPPORTED_CURRENCIES: Currency[] = [
  { code: "IDR", symbol: "Rp. ", name: "Indonesian Rupiah", locale: "id-ID" },
  { code: "INR", symbol: "₹", name: "Indian Rupee", locale: "en-IN" },
  { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US" },
  { code: "EUR", symbol: "€", name: "Euro", locale: "de-DE" },
  { code: "GBP", symbol: "£", name: "British Pound", locale: "en-GB" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", locale: "ja-JP" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan", locale: "zh-CN" },
  { code: "AUD", symbol: "$", name: "Australian Dollar", locale: "en-AU" },
  { code: "CAD", symbol: "$", name: "Canadian Dollar", locale: "en-CA" },
];

export const DEFAULT_CURRENCY_CODE = "IDR";

export function getCurrencyByCode(code: string): Currency {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code) || SUPPORTED_CURRENCIES[0];
}

export function formatNumber(value: number, locale = "id-ID") {
  try {
    return value.toLocaleString(locale);
  } catch {
    return value.toString();
  }
}
