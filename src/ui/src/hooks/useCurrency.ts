import useSWR from 'swr';
import { configService } from '../services/config';

export interface CurrencyInfo {
  code: string;
  symbol: string;
  rate: number;
}

const USD: CurrencyInfo = { code: 'USD', symbol: '$', rate: 1.0 };

export function useCurrency() {
  const { data } = useSWR('config/currency', () => configService.fetchConfig(), {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const currency: CurrencyInfo = data?.currency
    ? { code: data.currency.code, symbol: data.currency.symbol, rate: data.currency.rate }
    : USD;

  const isUSD = currency.code === 'USD' || currency.rate === 1.0;

  /**
   * Format a USD cost value for display.
   * If currency is non-USD, shows: "$0.1000 / R$0.5250" (USD + converted)
   * If USD, shows just "$0.1000"
   */
  function fmtCost(usdValue: number | null): string {
    if (usdValue == null || usdValue === 0) return '—';
    const usdStr = usdValue < 0.0001 ? '<$0.0001' : `$${usdValue.toFixed(4)}`;
    if (isUSD) return usdStr;
    const converted = usdValue * currency.rate;
    const convStr = converted < 0.0001 ? `<${currency.symbol}0.0001` : `${currency.symbol}${converted.toFixed(4)}`;
    return `${usdStr} / ${convStr}`;
  }

  /**
   * Format a per-1M token price for display in model pricing table.
   * Returns: "$0.1000" for USD, "$0.1000 / R$0.5250" for others.
   */
  function fmtPrice(usdPer1m: number): string {
    const usdStr = `$${usdPer1m.toFixed(4)}`;
    if (isUSD) return usdStr;
    const converted = usdPer1m * currency.rate;
    return `${usdStr} / ${currency.symbol}${converted.toFixed(4)}`;
  }

  return { currency, isUSD, fmtCost, fmtPrice };
}
