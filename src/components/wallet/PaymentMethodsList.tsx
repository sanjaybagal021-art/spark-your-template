import React from "react";
import { cn } from "@/lib/utils";

interface PaymentMethod {
  id: string;
  type: string;
  label: string;
  is_default: boolean;
}

interface PaymentMethodsListProps {
  methods: PaymentMethod[];
  onSetDefault: (id: string) => void;
  onRemove: (id: string) => void;
  selectedId?: string;
  onSelect?: (id: string) => void;
}

const PaymentMethodsList: React.FC<PaymentMethodsListProps> = ({ methods, onSetDefault, onRemove, selectedId, onSelect }) => {
  if (methods.length === 0) {
    return <p className="font-mono text-xs text-muted-foreground py-4 text-center">No payment methods added</p>;
  }

  return (
    <div className="space-y-2">
      {methods.map((m) => (
        <div
          key={m.id}
          onClick={() => onSelect?.(m.id)}
          className={cn(
            "flex items-center justify-between p-3 border rounded cursor-pointer transition-colors",
            selectedId === m.id ? "border-blue bg-blue/5" : "border-border hover:border-blue/50"
          )}
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-[0.6rem] uppercase tracking-wider px-1.5 py-0.5 border border-border rounded text-muted-foreground">
              {m.type.replace(/_/g, " ")}
            </span>
            <span className="font-condensed font-600 text-sm">{m.label}</span>
            {m.is_default && (
              <span className="font-mono text-[0.5rem] text-success uppercase tracking-wider">Default</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!m.is_default && (
              <button
                onClick={(e) => { e.stopPropagation(); onSetDefault(m.id); }}
                className="font-mono text-[0.55rem] text-blue hover:underline"
              >
                Set Default
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(m.id); }}
              className="font-mono text-[0.55rem] text-loss hover:underline"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PaymentMethodsList;
