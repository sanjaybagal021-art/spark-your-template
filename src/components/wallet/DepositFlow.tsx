import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useDepositRequest, DepositMethod } from "@/hooks/useDepositRequest";

interface DepositFlowProps {
  onClose: () => void;
}

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000];

const DepositFlow: React.FC<DepositFlowProps> = ({ onClose }) => {
  const { user } = useAuth();
  const deposit = useDepositRequest();
  const [amount, setAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const handleDeposit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt < 100) {
      setMsg({ text: "Minimum deposit: ₹100", ok: false });
      return;
    }
    setProcessing(true);
    try {
      await deposit.createDeposit(amt, "upi" as DepositMethod);
      setMsg({ text: `₹${amt.toLocaleString("en-IN")} deposit request submitted. Awaiting admin verification.`, ok: true });
      setAmount("");
    } catch {
      setMsg({ text: "Deposit request failed", ok: false });
    }
    setProcessing(false);
  };

  return (
    <div className="space-y-4">
      <p className="font-condensed font-700 text-lg uppercase tracking-wider">Deposit Funds</p>

      <div className="grid grid-cols-5 gap-2">
        {QUICK_AMOUNTS.map((q) => (
          <button
            key={q}
            onClick={() => setAmount(String(q))}
            className="font-condensed font-600 text-xs py-2 border border-border bg-surface-card hover:border-blue hover:text-blue transition-all rounded text-muted-foreground"
          >
            ₹{q >= 1000 ? `${q / 1000}K` : q}
          </button>
        ))}
      </div>

      <input
        type="number"
        placeholder="Enter amount (Min ₹100)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="stake-input"
        min={100}
      />

      {msg && (
        <p className={`font-mono text-xs px-3 py-2 border rounded ${msg.ok ? "text-success bg-success/10 border-success/30" : "text-loss bg-loss/10 border-loss/30"}`}>
          {msg.text}
        </p>
      )}

      <div className="flex gap-3">
        <button onClick={handleDeposit} disabled={processing} className="cta-place-bet flex-1 disabled:opacity-50">
          {processing ? "Processing..." : "Request Deposit"}
        </button>
        <button onClick={onClose} className="font-condensed font-bold text-sm uppercase tracking-widest border border-border bg-surface-raised text-foreground py-2.5 px-6 rounded hover:border-blue transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
};

export default DepositFlow;
