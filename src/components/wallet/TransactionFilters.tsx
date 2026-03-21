import React from "react";
import { cn } from "@/lib/utils";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "deposit", label: "Deposits" },
  { key: "withdrawal", label: "Withdrawals" },
  { key: "bet_placed", label: "Bets" },
  { key: "bet_win", label: "Wins" },
  { key: "bonus", label: "Bonus" },
];

interface TransactionFiltersProps {
  active: string;
  onChange: (filter: string) => void;
}

const TransactionFilters: React.FC<TransactionFiltersProps> = ({ active, onChange }) => {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {FILTERS.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          className={cn(
            "font-mono text-[0.6rem] uppercase tracking-wider px-3 py-1.5 border rounded whitespace-nowrap transition-colors",
            active === f.key ? "border-blue text-blue bg-blue/10" : "border-border text-muted-foreground hover:border-blue"
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
};

export default TransactionFilters;
