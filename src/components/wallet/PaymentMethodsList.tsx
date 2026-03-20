import React from "react";
import { cn } from "@/lib/utils";
import { PaymentMethod } from "@/hooks/usePaymentMethods";
import { CreditCard, Building2, Smartphone, Star, Trash2 } from "lucide-react";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  upi: <Smartphone className="w-4 h-4 text-blue" />,
  bank_account: <Building2 className="w-4 h-4 text-success" />,
  card: <CreditCard className="w-4 h-4 text-yellow" />,
};

const TYPE_LABELS: Record<string, string> = {
  upi: "UPI",
  bank_account: "Bank Account",
  card: "Card",
};

interface Props {
  methods: PaymentMethod[];
  onSetDefault: (id: string) => void;
  onRemove: (id: string) => void;
  selectedId?: string;
  onSelect?: (id: string) => void;
}

const PaymentMethodsList: React.FC<Props> = ({ methods, onSetDefault, onRemove, selectedId, onSelect }) => {
  if (methods.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="font-mono text-xs text-muted-foreground tracking-wider uppercase">
          No payment methods linked
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {methods.map((m) => (
        <div
          key={m.id}
          onClick={() => onSelect?.(m.id)}
          className={cn(
            "flex items-center gap-3 p-3 border rounded transition-all",
            selectedId === m.id
              ? "border-blue bg-blue/5"
              : "border-border bg-surface-card hover:border-border-bright",
            onSelect && "cursor-pointer"
          )}
        >
          <span className="w-8 h-8 bg-surface-raised rounded flex items-center justify-center flex-shrink-0">
            {TYPE_ICONS[m.type] ?? <CreditCard className="w-4 h-4" />}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-condensed font-600 text-sm text-foreground truncate">{m.label}</p>
              {m.is_default && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-yellow/15 text-yellow rounded font-mono text-[0.5rem] font-bold tracking-wider uppercase">
                  <Star className="w-2.5 h-2.5 fill-current" /> Default
                </span>
              )}
              {!m.is_verified && (
                <span className="px-1.5 py-0.5 bg-warning/15 text-warning rounded font-mono text-[0.5rem] font-bold tracking-wider uppercase">
                  Unverified
                </span>
              )}
            </div>
            <p className="font-mono text-[0.55rem] text-muted-foreground tracking-wider">
              {TYPE_LABELS[m.type] ?? m.type}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {!m.is_default && (
              <button
                onClick={(e) => { e.stopPropagation(); onSetDefault(m.id); }}
                title="Set as default"
                className="p-1.5 rounded hover:bg-surface-raised transition-colors text-muted-foreground hover:text-yellow"
              >
                <Star className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(m.id); }}
              title="Remove"
              className="p-1.5 rounded hover:bg-loss/10 transition-colors text-muted-foreground hover:text-loss"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PaymentMethodsList;
