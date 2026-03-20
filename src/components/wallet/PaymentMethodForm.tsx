import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { PaymentMethodType } from "@/hooks/usePaymentMethods";
import { CreditCard, Building2, Smartphone } from "lucide-react";

const METHOD_TABS: { type: PaymentMethodType; label: string; icon: React.ReactNode }[] = [
  { type: "upi", label: "UPI", icon: <Smartphone className="w-4 h-4" /> },
  { type: "bank_account", label: "Bank", icon: <Building2 className="w-4 h-4" /> },
  { type: "card", label: "Card", icon: <CreditCard className="w-4 h-4" /> },
];

interface Props {
  onSubmit: (type: PaymentMethodType, label: string, details: Record<string, string>, setDefault: boolean) => Promise<boolean>;
  onCancel: () => void;
}

const PaymentMethodForm: React.FC<Props> = ({ onSubmit, onCancel }) => {
  const [type, setType] = useState<PaymentMethodType>("upi");
  const [upiId, setUpiId] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [accountName, setAccountName] = useState("");
  const [cardLast4, setCardLast4] = useState("");
  const [cardName, setCardName] = useState("");
  const [setDefault, setSetDefault] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    let label = "";
    let details: Record<string, string> = {};

    if (type === "upi") {
      if (!upiId.includes("@")) { setError("Enter a valid UPI ID"); setSubmitting(false); return; }
      label = upiId;
      details = { upi_id: upiId };
    } else if (type === "bank_account") {
      if (!accountNumber || !ifsc || !accountName) { setError("Fill all bank details"); setSubmitting(false); return; }
      label = `${accountName} ••${accountNumber.slice(-4)}`;
      details = { account_number: accountNumber, ifsc, account_name: accountName };
    } else {
      if (!cardLast4 || cardLast4.length !== 4) { setError("Enter last 4 digits"); setSubmitting(false); return; }
      label = `Card ••••${cardLast4}`;
      details = { last4: cardLast4, card_name: cardName };
    }

    const ok = await onSubmit(type, label, details, setDefault);
    if (!ok) setError("Failed to add payment method.");
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type tabs */}
      <div className="flex border border-border rounded overflow-hidden">
        {METHOD_TABS.map((tab) => (
          <button
            key={tab.type}
            type="button"
            onClick={() => setType(tab.type)}
            className={cn(
              "flex-1 py-2 flex items-center justify-center gap-1.5 font-condensed font-bold text-xs tracking-widest uppercase transition-colors",
              type === tab.type
                ? "bg-blue text-white"
                : "text-muted-foreground hover:text-foreground bg-surface-card"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* UPI fields */}
      {type === "upi" && (
        <div>
          <label className="section-label block mb-1.5">UPI ID</label>
          <input
            type="text"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="yourname@upi"
            required
            className="stake-input"
          />
        </div>
      )}

      {/* Bank fields */}
      {type === "bank_account" && (
        <>
          <div>
            <label className="section-label block mb-1.5">Account Holder Name</label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Full name"
              required
              className="stake-input"
            />
          </div>
          <div>
            <label className="section-label block mb-1.5">Account Number</label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="Account number"
              required
              className="stake-input"
            />
          </div>
          <div>
            <label className="section-label block mb-1.5">IFSC Code</label>
            <input
              type="text"
              value={ifsc}
              onChange={(e) => setIfsc(e.target.value.toUpperCase())}
              placeholder="SBIN0001234"
              required
              className="stake-input"
            />
          </div>
        </>
      )}

      {/* Card fields */}
      {type === "card" && (
        <>
          <div>
            <label className="section-label block mb-1.5">Cardholder Name</label>
            <input
              type="text"
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="Name on card"
              required
              className="stake-input"
            />
          </div>
          <div>
            <label className="section-label block mb-1.5">Last 4 Digits</label>
            <input
              type="text"
              value={cardLast4}
              onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="1234"
              required
              maxLength={4}
              className="stake-input"
            />
          </div>
        </>
      )}

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={setDefault}
          onChange={(e) => setSetDefault(e.target.checked)}
          className="accent-[hsl(var(--blue))]"
        />
        <span className="font-mono text-xs text-muted-foreground">Set as default</span>
      </label>

      {error && (
        <p className="font-mono text-xs text-loss bg-loss/10 border border-loss/30 px-3 py-2 rounded">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="cta-place-bet flex-1 disabled:opacity-50">
          {submitting ? "Adding..." : "Add Method"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="font-condensed font-bold text-sm uppercase tracking-widest border border-border bg-surface-raised text-foreground py-2.5 px-4 rounded hover:border-blue transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default PaymentMethodForm;
