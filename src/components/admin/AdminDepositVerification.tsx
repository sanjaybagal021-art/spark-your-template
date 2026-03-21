import React, { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2, XCircle, Clock, Eye, RefreshCw, Image as ImageIcon,
  AlertTriangle, Search,
} from "lucide-react";

interface DepositRequest {
  id: string;
  user_id: string;
  amount: number;
  method: string;
  status: string;
  utr: string | null;
  screenshot_url: string | null;
  crypto_tx_hash: string | null;
  reject_reason: string | null;
  created_at: string;
  metadata: any;
}

const depTable = () => (supabase as any).from("deposit_requests");

const AdminDepositVerification: React.FC = () => {
  const { user } = useAuth();
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [searchUtr, setSearchUtr] = useState("");

  const fetchDeposits = useCallback(async () => {
    setLoading(true);
    let query = depTable().select("*").order("created_at", { ascending: false }).limit(100);
    if (filter === "pending") query = query.eq("status", "pending");
    const { data } = await query;
    setDeposits((data as DepositRequest[]) ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchDeposits(); }, [fetchDeposits]);

  const handleApprove = async (deposit: DepositRequest) => {
    if (!user) return;
    setProcessing(deposit.id);

    // 1. Update deposit status
    await depTable().update({
      status: "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", deposit.id);

    // 2. Credit wallet via RPC (or direct insert as fallback)
    await supabase.rpc("wallet_credit" as any, {
      p_user_id: deposit.user_id,
      p_amount: deposit.amount,
      p_type: "deposit",
      p_description: `Deposit via ${deposit.method} (UTR: ${deposit.utr ?? "N/A"})`,
      p_idempotency_key: `dep_${deposit.id}`,
    });

    // 3. Notify user
    await supabase.from("notifications").insert({
      user_id: deposit.user_id,
      type: "deposit_approved",
      title: "Deposit Approved",
      message: `₹${deposit.amount.toLocaleString("en-IN")} has been credited to your wallet.`,
    } as any);

    setProcessing(null);
    fetchDeposits();
  };

  const handleReject = async () => {
    if (!user || !rejectId) return;
    setProcessing(rejectId);

    await depTable().update({
      status: "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      reject_reason: rejectReason || "Verification failed",
    }).eq("id", rejectId);

    // Notify user
    const dep = deposits.find(d => d.id === rejectId);
    if (dep) {
      await supabase.from("notifications").insert({
        user_id: dep.user_id,
        type: "deposit_rejected",
        title: "Deposit Rejected",
        message: `₹${dep.amount.toLocaleString("en-IN")} deposit was rejected: ${rejectReason || "Verification failed"}`,
      } as any);
    }

    setProcessing(null);
    setRejectId(null);
    setRejectReason("");
    fetchDeposits();
  };

  const viewScreenshot = async (path: string) => {
    const { data } = await supabase.storage.from("payment-screenshots").createSignedUrl(path, 300);
    if (data?.signedUrl) setScreenshotUrl(data.signedUrl);
  };

  const filteredDeposits = searchUtr
    ? deposits.filter(d => d.utr?.toLowerCase().includes(searchUtr.toLowerCase()))
    : deposits;

  const pendingCount = deposits.filter(d => d.status === "pending").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          {(["pending", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 font-condensed font-bold text-[0.65rem] tracking-widest uppercase rounded border transition-all",
                filter === f ? "border-blue bg-blue/10 text-blue" : "border-border bg-surface-card text-muted-foreground hover:border-blue hover:text-blue"
              )}
            >
              {f === "pending" ? `Pending (${pendingCount})` : "All"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search UTR..."
              value={searchUtr}
              onChange={(e) => setSearchUtr(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-surface-card border border-border rounded font-mono text-xs outline-none focus:border-blue w-40"
            />
          </div>
          <button onClick={fetchDeposits} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Screenshot modal */}
      {screenshotUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setScreenshotUrl(null)}>
          <div className="max-w-lg max-h-[80vh] overflow-auto bg-surface-card rounded-lg p-2 border border-border" onClick={e => e.stopPropagation()}>
            <img src={screenshotUrl} alt="Payment screenshot" className="max-w-full rounded" />
            <button
              onClick={() => setScreenshotUrl(null)}
              className="mt-2 w-full py-2 font-condensed font-bold text-sm uppercase tracking-widest border border-border rounded hover:bg-surface-raised transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectId && (
        <div className="bg-loss/10 border border-loss/30 rounded p-4 space-y-3">
          <p className="font-condensed font-700 text-sm text-loss uppercase tracking-wider">Reject Deposit</p>
          <input
            type="text"
            placeholder="Reason for rejection..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="stake-input"
            maxLength={200}
          />
          <div className="flex gap-2">
            <button onClick={handleReject} disabled={!!processing} className="flex-1 py-2 border border-loss bg-loss/20 text-loss font-condensed font-bold text-sm uppercase tracking-widest rounded hover:bg-loss/30 transition-colors disabled:opacity-50">
              {processing ? "Rejecting..." : "Confirm Reject"}
            </button>
            <button onClick={() => { setRejectId(null); setRejectReason(""); }} className="px-4 py-2 border border-border rounded font-condensed font-bold text-sm uppercase tracking-widest hover:bg-surface-raised transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-surface-card border border-border rounded animate-pulse" />)}
        </div>
      ) : filteredDeposits.length === 0 ? (
        <div className="py-12 text-center">
          <p className="font-mono text-sm text-muted-foreground tracking-wider uppercase">
            {filter === "pending" ? "No pending deposits" : "No deposits found"}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>User</th>
                <th>Amount</th>
                <th>Method</th>
                <th>UTR / Hash</th>
                <th>Screenshot</th>
                <th>Status</th>
                <th>When</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeposits.map((dep) => (
                <tr key={dep.id}>
                  <td className="font-mono text-[0.65rem] text-muted-foreground">{dep.id.slice(0, 8).toUpperCase()}</td>
                  <td className="font-mono text-[0.65rem] text-muted-foreground">{dep.user_id.slice(0, 8)}</td>
                  <td className="font-condensed font-bold text-success">₹{dep.amount.toLocaleString("en-IN")}</td>
                  <td className="font-mono text-[0.65rem] uppercase tracking-wider">{dep.method}</td>
                  <td>
                    {dep.utr && <code className="font-mono text-[0.6rem] text-blue">{dep.utr}</code>}
                    {dep.crypto_tx_hash && <code className="font-mono text-[0.55rem] text-blue break-all">{dep.crypto_tx_hash.slice(0, 16)}...</code>}
                    {!dep.utr && !dep.crypto_tx_hash && <span className="font-mono text-[0.6rem] text-yellow">No proof</span>}
                  </td>
                  <td>
                    {dep.screenshot_url ? (
                      <button
                        onClick={() => viewScreenshot(dep.screenshot_url!)}
                        className="flex items-center gap-1 font-mono text-[0.6rem] text-blue hover:underline"
                      >
                        <ImageIcon className="w-3 h-3" /> View
                      </button>
                    ) : (
                      <span className="font-mono text-[0.55rem] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td>
                    <span className={cn("font-mono text-[0.6rem] uppercase tracking-wider font-semibold",
                      dep.status === "approved" ? "text-success" : dep.status === "pending" ? "text-yellow" : "text-loss"
                    )}>
                      {dep.status}
                    </span>
                  </td>
                  <td className="font-mono text-[0.6rem] text-muted-foreground">
                    {formatDistanceToNow(new Date(dep.created_at), { addSuffix: true })}
                  </td>
                  <td>
                    {dep.status === "pending" && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleApprove(dep)}
                          disabled={!!processing}
                          title="Approve & credit wallet"
                          className="p-1.5 rounded hover:bg-success/10 transition-colors text-muted-foreground hover:text-success disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setRejectId(dep.id)}
                          disabled={!!processing}
                          title="Reject"
                          className="p-1.5 rounded hover:bg-loss/10 transition-colors text-muted-foreground hover:text-loss disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {dep.status !== "pending" && (
                      <span className="font-mono text-[0.55rem] text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminDepositVerification;
