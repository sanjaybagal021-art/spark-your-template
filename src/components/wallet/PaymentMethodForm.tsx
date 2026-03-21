import React, { useState } from "react";
import { cn } from "@/lib/utils";

interface PaymentMethodFormProps {
  onSubmit: (type: string, label: string, details: Record<string, string>, setDefault: boolean) => Promise<boolean>;
  onCancel: () => void;
}

const METHOD_TYPES = [
  { value: "upi", label: "UPI" },
  { value: "bank_account", label: "Bank Account" },
  { value: "crypto", label: "Crypto Wallet" },
];

const PaymentMethodForm: React.FC<PaymentMethodFormProps> = ({ onSubmit, onCancel }) => {
  const [type, setType] = useState("upi");
  const [label, setLabel] = useState("");
  const [upiId, setUpiId] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [cryptoAddress, setCryptoAddress] = useState("");
  const [setDefault, setSetDefault] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    const details: Record<string, string> = {};
    if (type === "upi") details.upi_id = upiId;
    if (type === "bank_account") { details.account_number = accountNumber; details.ifsc = ifsc; }
    if (type === "crypto") details.address = cryptoAddress;
    await onSubmit(type, label || METHOD_TYPES.find(m => m.value === type)?.label || type, details, setDefault);
    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {METHOD_TYPES.map((m) => (
          <button
            key={m.value}
            onClick={() => setType(m.value)}
            className={cn(
              "font-mono text-[0.65rem] uppercase tracking-wider px-3 py-2 border rounded transition-colors",
              type === m.value ? "border-blue text-blue bg-blue/10" : "border-border text-muted-foreground hover:border-blue"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      <input
        placeholder="Label (e.g., My UPI)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="stake-input text-base"
      />
      {type === "upi" && (
        <input placeholder="UPI ID (e.g., name@paytm)" value={upiId} onChange={(e) => setUpiId(e.target.value)} className="stake-input text-base" />
      )}
      {type === "bank_account" && (
        <>
          <input placeholder="Account Number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="stake-input text-base" />
          <input placeholder="IFSC Code" value={ifsc} onChange={(e) => setIfsc(e.target.value)} className="stake-input text-base" />
        </>
      )}
      {type === "crypto" && (
        <input placeholder="Wallet Address" value={cryptoAddress} onChange={(e) => setCryptoAddress(e.target.value)} className="stake-input text-base" />
      )}
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={setDefault} onChange={(e) => setSetDefault(e.target.checked)} className="accent-blue" />
        <span className="font-mono text-[0.65rem] text-muted-foreground">Set as default</span>
      </label>
      <div className="flex gap-3">
        <button onClick={handleSubmit} disabled={submitting} className="cta-place-bet flex-1 disabled:opacity-50">
          {submitting ? "Adding..." : "Add Method"}
        </button>
        <button onClick={onCancel} className="font-condensed font-bold text-sm uppercase tracking-widest border border-border bg-surface-raised text-foreground py-2.5 px-6 rounded hover:border-blue transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
};

export default PaymentMethodForm;
