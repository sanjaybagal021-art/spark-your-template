import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { LayoutContext } from "@/components/AppLayout";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowUpRight, ArrowDownLeft, Gift, TrendingUp, Minus,
  Plus, Shield, ChevronDown, ChevronUp, Wallet as WalletIcon, Lock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Database } from "@/integrations/supabase/types";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useWithdrawalLimits } from "@/hooks/useWithdrawalLimits";
import { useLockedFunds } from "@/hooks/useLockedFunds";
import PaymentMethodForm from "@/components/wallet/PaymentMethodForm";
import PaymentMethodsList from "@/components/wallet/PaymentMethodsList";
import TransactionFilters from "@/components/wallet/TransactionFilters";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];

const TX_ICONS: Record<string, React.ReactNode> = {
  deposit: <ArrowDownLeft className="w-4 h-4 text-success" />,
  withdrawal: <ArrowUpRight className="w-4 h-4 text-loss" />,
  bet_placed: <Minus className="w-4 h-4 text-yellow" />,
  bet_win: <TrendingUp className="w-4 h-4 text-success" />,
  bet_refund: <TrendingUp className="w-4 h-4 text-blue" />,
  bonus: <Gift className="w-4 h-4 text-blue" />,
};

const DEPOSIT_AMOUNTS = [500, 1000, 2000, 5000];
const WITHDRAW_MIN = 100;
const WITHDRAW_MAX = 100000;

const Wallet: React.FC = () => {
  const { wallet } = useOutletContext<LayoutContext>();
  const { user } = useAuth();
  const paymentMethods = usePaymentMethods();
  const withdrawalLimits = useWithdrawalLimits();
  const lockedFunds = useLockedFunds();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [txFilter, setTxFilter] = useState("all");

  const [panel, setPanel] = useState<"none" | "deposit" | "withdraw" | "add_method">("none");
  const [amount, setAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<string | undefined>();
  const [showMethods, setShowMethods] = useState(false);

  useEffect(() => {
    if (paymentMethods.defaultMethod && !selectedMethodId) {
      setSelectedMethodId(paymentMethods.defaultMethod.id);
    }
  }, [paymentMethods.defaultMethod, selectedMethodId]);

  useEffect(() => {
    if (!user) return;
    const fetchTx = async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setTransactions(data ?? []);
      setTxLoading(false);
    };
    fetchTx();

    const channel = supabase
      .channel(`tx:${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "transactions",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setTransactions((prev) => [payload.new as Transaction, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const filteredTx = txFilter === "all"
    ? transactions
    : transactions.filter((tx) => tx.type === txFilter);

  const flash = (text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4000);
  };

  const handleDeposit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    setProcessing(true);
    const ok = await wallet.credit(amt, "deposit", `Deposit via ${paymentMethods.methods.find(m => m.id === selectedMethodId)?.label ?? "UPI"}`);
    flash(ok ? `₹${amt.toLocaleString("en-IN")} deposited!` : "Deposit failed.", ok);
    setProcessing(false);
    if (ok) { setAmount(""); setPanel("none"); }
  };

  const handleWithdraw = async () => {
    if (!withdrawalLimits.canWithdraw) {
      flash(withdrawalLimits.reason, false);
      return;
    }
    const amt = parseFloat(amount);
    if (!amt || amt < WITHDRAW_MIN) { flash(`Min withdrawal: ₹${WITHDRAW_MIN}`, false); return; }
    if (amt > WITHDRAW_MAX) { flash(`Max withdrawal: ₹${WITHDRAW_MAX.toLocaleString("en-IN")}`, false); return; }
    if (amt > wallet.balance) { flash("Insufficient balance", false); return; }
    if (withdrawalLimits.remaining !== null && amt > withdrawalLimits.remaining) {
      flash(`Daily limit remaining: ₹${withdrawalLimits.remaining.toLocaleString("en-IN")}. Upgrade KYC for higher limits.`, false);
      return;
    }
    setProcessing(true);
    const method = paymentMethods.methods.find(m => m.id === selectedMethodId);
    const ok = await wallet.debit(amt, `Withdrawal to ${method?.label ?? "account"}`);
    flash(ok ? `₹${amt.toLocaleString("en-IN")} withdrawal initiated` : "Withdrawal failed.", ok);
    setProcessing(false);
    if (ok) { setAmount(""); setPanel("none"); withdrawalLimits.refresh(); }
  };

  return (
    <div className="pb-20 lg:pb-8">
      {/* Header */}
      <div className="px-4 lg:px-6 py-5 border-b border-border">
        <h1 className="font-condensed font-black text-2xl tracking-wider uppercase">Wallet</h1>
      </div>

      <div className="px-4 lg:px-6 py-6 space-y-6 max-w-2xl">
        {/* ── Balance Card ── */}
        <div className="bg-surface-card border border-border rounded p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="section-label mb-2">Available Balance</p>
              {wallet.loading ? (
                <div className="h-10 w-32 bg-surface-raised animate-pulse rounded" />
              ) : (
                <p className="font-condensed font-black text-4xl text-yellow leading-none">
                  ₹{wallet.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              )}
              {wallet.bonusBalance > 0 && (
                <p className="font-mono text-[0.6rem] text-blue tracking-wider mt-1">
                  + ₹{wallet.bonusBalance.toLocaleString("en-IN")} bonus (wagering required)
                </p>
              )}
              {!lockedFunds.loading && lockedFunds.lockedBalance > 0 && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Lock className="w-3 h-3 text-loss" />
                  <p className="font-mono text-[0.6rem] text-loss tracking-wider">
                    ₹{lockedFunds.lockedBalance.toLocaleString("en-IN")} locked
                  </p>
                </div>
              )}
            </div>
            <WalletIcon className="w-6 h-6 text-muted-foreground" />
          </div>

          <div className="flex gap-3 mt-5">
            <button
              onClick={() => setPanel(panel === "deposit" ? "none" : "deposit")}
              className={cn(
                "cta-place-bet w-auto flex-1",
                panel === "deposit" && "ring-2 ring-blue ring-offset-2 ring-offset-surface-card"
              )}
            >
              <ArrowDownLeft className="w-4 h-4 inline mr-1" /> Deposit
            </button>
            <button
              onClick={() => {
                if (!withdrawalLimits.canWithdraw) {
                  flash(withdrawalLimits.reason, false);
                  return;
                }
                setPanel(panel === "withdraw" ? "none" : "withdraw");
              }}
              className={cn(
                "font-condensed font-bold text-sm uppercase tracking-widest border border-border bg-surface-raised text-foreground py-2.5 px-6 rounded hover:border-blue transition-colors flex-1",
                panel === "withdraw" && "border-blue",
                !withdrawalLimits.canWithdraw && "opacity-50 cursor-not-allowed"
              )}
            >
              <ArrowUpRight className="w-4 h-4 inline mr-1" /> Withdraw
            </button>
          </div>

          {/* Flash message */}
          {msg && (
            <p className={cn(
              "mt-3 font-mono text-xs px-3 py-2 border rounded",
              msg.ok ? "text-success bg-success/10 border-success/30" : "text-loss bg-loss/10 border-loss/30"
            )}>
              {msg.text}
            </p>
          )}
        </div>

        {/* ── Deposit / Withdraw Panel ── */}
        {(panel === "deposit" || panel === "withdraw") && (
          <div className="bg-surface-card border border-border rounded p-5 space-y-4">
            <p className="font-condensed font-700 text-lg uppercase tracking-wider">
              {panel === "deposit" ? "Deposit Funds" : "Withdraw Funds"}
            </p>

            {/* Quick amounts for deposit */}
            {panel === "deposit" && (
              <div className="grid grid-cols-4 gap-1.5">
                {DEPOSIT_AMOUNTS.map((q) => (
                  <button
                    key={q}
                    onClick={() => setAmount(String(q))}
                    className={cn(
                      "font-condensed font-600 text-xs py-2 border rounded transition-all",
                      amount === String(q)
                        ? "border-blue text-blue bg-blue/10"
                        : "border-border bg-surface hover:border-blue hover:text-blue text-muted-foreground"
                    )}
                  >
                    ₹{q >= 1000 ? `${q / 1000}K` : q}
                  </button>
                ))}
              </div>
            )}

            {/* Amount input */}
            <div>
              <label className="section-label block mb-1.5">Amount (₹)</label>
              <input
                type="number"
                placeholder={panel === "withdraw" ? `Min ₹${WITHDRAW_MIN}` : "0.00"}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="stake-input"
                min={panel === "withdraw" ? WITHDRAW_MIN : 1}
                max={panel === "withdraw" ? WITHDRAW_MAX : undefined}
              />
              {panel === "withdraw" && (
                <div className="space-y-1 mt-1">
                  <p className="font-mono text-[0.55rem] text-muted-foreground">
                    Limits: ₹{WITHDRAW_MIN} – ₹{WITHDRAW_MAX.toLocaleString("en-IN")}
                  </p>
                  {withdrawalLimits.dailyLimit !== null && (
                    <p className={cn("font-mono text-[0.55rem]",
                      withdrawalLimits.remaining === 0 ? "text-loss" : "text-yellow"
                    )}>
                      Daily limit: ₹{withdrawalLimits.dailyLimit.toLocaleString("en-IN")} · 
                      Remaining: ₹{(withdrawalLimits.remaining ?? 0).toLocaleString("en-IN")} · 
                      KYC Level {withdrawalLimits.kycLevel}
                    </p>
                  )}
                  {withdrawalLimits.dailyLimit === null && (
                    <p className="font-mono text-[0.55rem] text-success">Unlimited (KYC Level 2)</p>
                  )}
                </div>
              )}
            </div>

            {/* Payment method selector */}
            <div>
              <label className="section-label block mb-1.5">
                {panel === "deposit" ? "Pay Via" : "Withdraw To"}
              </label>
              {paymentMethods.methods.length > 0 ? (
                <PaymentMethodsList
                  methods={paymentMethods.methods}
                  onSetDefault={(id) => paymentMethods.setDefault(id)}
                  onRemove={(id) => paymentMethods.removeMethod(id)}
                  selectedId={selectedMethodId}
                  onSelect={setSelectedMethodId}
                />
              ) : (
                <button
                  onClick={() => setPanel("add_method")}
                  className="w-full border border-dashed border-border rounded p-4 flex items-center justify-center gap-2 text-muted-foreground hover:text-blue hover:border-blue transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span className="font-condensed font-bold text-sm uppercase tracking-wider">Add Payment Method</span>
                </button>
              )}
            </div>

            <button
              onClick={panel === "deposit" ? handleDeposit : handleWithdraw}
              disabled={processing || !amount}
              className="cta-place-bet w-full disabled:opacity-50"
            >
              {processing ? "Processing..." : panel === "deposit" ? "Deposit" : "Withdraw"}
            </button>
          </div>
        )}

        {/* ── Add Payment Method Panel ── */}
        {panel === "add_method" && (
          <div className="bg-surface-card border border-border rounded p-5">
            <p className="font-condensed font-700 text-lg uppercase tracking-wider mb-4">
              Add Payment Method
            </p>
            <PaymentMethodForm
              onSubmit={async (type, label, details, setDef) => {
                const ok = await paymentMethods.addMethod(type, label, details, setDef);
                if (ok) setPanel("none");
                return ok;
              }}
              onCancel={() => setPanel("none")}
            />
          </div>
        )}

        {/* ── Linked Payment Methods ── */}
        <div className="bg-surface-card border border-border rounded overflow-hidden">
          <button
            onClick={() => setShowMethods(!showMethods)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-surface-raised transition-colors"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue" />
              <span className="font-condensed font-bold text-sm uppercase tracking-wider">
                Payment Methods ({paymentMethods.methods.length})
              </span>
            </div>
            {showMethods ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showMethods && (
            <div className="px-5 pb-4 space-y-3">
              <PaymentMethodsList
                methods={paymentMethods.methods}
                onSetDefault={(id) => paymentMethods.setDefault(id)}
                onRemove={(id) => paymentMethods.removeMethod(id)}
              />
              <button
                onClick={() => setPanel("add_method")}
                className="w-full border border-dashed border-border rounded py-2.5 flex items-center justify-center gap-2 text-muted-foreground hover:text-blue hover:border-blue transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="font-condensed font-bold text-xs uppercase tracking-wider">Add New</span>
              </button>
            </div>
          )}
        </div>

        {/* ── Transaction History ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="section-label">Transaction History</p>
          </div>
          <TransactionFilters active={txFilter} onChange={setTxFilter} />

          <div className="mt-3">
            {txLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-surface-card border border-border rounded animate-pulse" />
                ))}
              </div>
            ) : filteredTx.length === 0 ? (
              <div className="py-12 text-center">
                <p className="font-mono text-sm text-muted-foreground tracking-wider uppercase">
                  {txFilter === "all" ? "No transactions yet" : "No matching transactions"}
                </p>
              </div>
            ) : (
              <div className="bg-surface-card border border-border rounded overflow-hidden">
                {filteredTx.map((tx) => (
                  <div key={tx.id} className="tx-row px-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="w-8 h-8 bg-surface-raised rounded flex items-center justify-center flex-shrink-0">
                        {TX_ICONS[tx.type] ?? <Minus className="w-4 h-4 text-muted-foreground" />}
                      </span>
                      <div className="min-w-0">
                        <p className="font-condensed font-600 text-sm text-foreground truncate">
                          {tx.description ?? tx.type.replace(/_/g, " ")}
                        </p>
                        <p className="font-mono text-[0.55rem] text-muted-foreground tracking-wide">
                          {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                          {tx.status === "pending" && (
                            <span className="ml-2 text-yellow font-semibold">PENDING</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span
                        className={cn(
                          "font-condensed font-bold text-base",
                          tx.amount > 0 ? "text-success" : "text-foreground/80"
                        )}
                      >
                        {tx.amount > 0 ? "+" : ""}₹{Math.abs(tx.amount).toLocaleString("en-IN")}
                      </span>
                      {tx.balance_after !== null && (
                        <p className="font-mono text-[0.5rem] text-dim-foreground">
                          Bal: ₹{tx.balance_after.toLocaleString("en-IN")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Wallet;
