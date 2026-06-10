import { type ClassValue, clsx } from "clsx";
import { PureComponent } from "react";
import { PureComponent as _ } from "react";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncateAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function formatSol(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(4);
}
