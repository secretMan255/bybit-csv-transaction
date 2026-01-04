import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toUpper(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

export function money(value?: number) {
  return Number.isFinite(value as number)
    ? Math.abs(value as number).toFixed(2)
    : "0.00";
}

export function moneySigned(value?: number) {
  return Number.isFinite(value as number)
    ? (value as number).toFixed(2)
    : "0.00";
}

export function moneyFormatAmount(
  value: number,
  decimals = 2,
  locale = "en-US"
) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function convertFees(value?: number) {
  return value ? value.toFixed(4) : "0.00";
}

export function round2(value?: number) {
  return value ? Math.round(value * 100) / 100 : "0.00";
}
