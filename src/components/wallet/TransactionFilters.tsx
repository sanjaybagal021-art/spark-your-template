import React from "react";
import { cn } from "@/lib/utils";

const TX_TYPES = [
  { value: "all", label: "All" },
  { value: "deposit", label: "Deposits" },
  { value: "withdrawal", label: "Withdrawals" },
  { value: "bet_placed", label: "Bets" },
  { value: "bet_win", label: "Winnings" },
  { value: "bonus", label: "Bonus" },
];

interface Props {
  active: string;
  onChange: (type: string) => void;
}

const TransactionFilters: React.FC<Props> = ({ active, onChange }) => (
  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
    {TX_TYPES.map((t) => (
      <button
        key={t.value}
        onClick={() => onChange(t.value)}
        className={cn(
          "px-3 py-1.5 font-condensed font-bold text-[0.65rem] tracking-widest uppercase whitespace-nowrap rounded border transition-all",
          active === t.value
            ? "border-blue bg-blue/10 text-blue"
            : "border-border bg-surface-card text-muted-foreground hover:border-blue hover:text-blue"
        )}
      >
        {t.label}
      </button>
    ))}
  </div>
);

export default TransactionFilters;
