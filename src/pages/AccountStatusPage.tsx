import React from "react";
import { useAccountStatus } from "@/hooks/useAccountStatus";
import { useKyc } from "@/hooks/useKyc";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Shield, AlertTriangle, Ban, Lock, CheckCircle2, ArrowRight } from "lucide-react";

const RISK_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  low: { color: "text-success", icon: <CheckCircle2 className="w-5 h-5 text-success" />, label: "Low Risk" },
  medium: { color: "text-yellow", icon: <AlertTriangle className="w-5 h-5 text-yellow" />, label: "Medium Risk" },
  high: { color: "text-loss", icon: <AlertTriangle className="w-5 h-5 text-loss" />, label: "High Risk" },
  critical: { color: "text-loss", icon: <Ban className="w-5 h-5 text-loss" />, label: "Critical Risk" },
};

const STATUS_MSG: Record<string, { title: string; desc: string; color: string }> = {
  active: { title: "Account Active", desc: "Your account is in good standing. All features are available.", color: "text-success" },
  restricted: { title: "Account Restricted", desc: "Some features are limited. Certain bet types or markets may be unavailable.", color: "text-yellow" },
  suspended: { title: "Account Suspended", desc: "Your account has been temporarily suspended. Betting and withdrawals are disabled. Contact support for assistance.", color: "text-loss" },
  under_review: { title: "Under Review", desc: "Your account is being reviewed by our compliance team. Withdrawals may be delayed.", color: "text-blue" },
  blocked: { title: "Account Blocked", desc: "Your account has been permanently blocked. Contact support if you believe this is an error.", color: "text-loss" },
};

const AccountStatusPage: React.FC = () => {
  const { riskProfile, loading } = useAccountStatus();
  const kyc = useKyc();
  const navigate = useNavigate();

  const risk = RISK_CONFIG[riskProfile.risk_level] ?? RISK_CONFIG.low;
  const status = STATUS_MSG[riskProfile.account_status] ?? STATUS_MSG.active;

  if (loading) {
    return (
      <div className="pb-20 lg:pb-8">
        <div className="px-4 lg:px-6 py-5 border-b border-border">
          <h1 className="font-condensed font-black text-2xl tracking-wider uppercase">Account Status</h1>
        </div>
        <div className="px-4 lg:px-6 py-6 space-y-3 max-w-2xl">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-surface-card border border-border rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-20 lg:pb-8">
      <div className="px-4 lg:px-6 py-5 border-b border-border">
        <h1 className="font-condensed font-black text-2xl tracking-wider uppercase">Account Status</h1>
      </div>

      <div className="px-4 lg:px-6 py-6 max-w-2xl space-y-6">
        {/* Account Status Card */}
        <div className={cn("border rounded p-6", riskProfile.account_status === "active" ? "bg-surface-card border-border" : "bg-loss/5 border-loss/30")}>
          <div className="flex items-center gap-3 mb-3">
            {riskProfile.account_status === "active" ? (
              <CheckCircle2 className="w-6 h-6 text-success" />
            ) : riskProfile.account_status === "blocked" ? (
              <Ban className="w-6 h-6 text-loss" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-yellow" />
            )}
            <h2 className={cn("font-condensed font-black text-xl", status.color)}>{status.title}</h2>
          </div>
          <p className="font-mono text-xs text-muted-foreground leading-relaxed">{status.desc}</p>
        </div>

        {/* Risk Indicator */}
        <div className="bg-surface-card border border-border rounded p-5">
          <div className="flex items-center gap-3 mb-4">
            {risk.icon}
            <div>
              <p className="font-condensed font-bold text-lg">{risk.label}</p>
              <p className="font-mono text-[0.6rem] text-muted-foreground">
                Score: {riskProfile.risk_score}/100
              </p>
            </div>
          </div>
          <div className="h-3 bg-surface rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                riskProfile.risk_score >= 75 ? "bg-loss" :
                riskProfile.risk_score >= 50 ? "bg-yellow" :
                riskProfile.risk_score >= 25 ? "bg-blue" : "bg-success"
              )}
              style={{ width: `${riskProfile.risk_score}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="font-mono text-[0.55rem] text-success">Low</span>
            <span className="font-mono text-[0.55rem] text-yellow">Medium</span>
            <span className="font-mono text-[0.55rem] text-loss">Critical</span>
          </div>
        </div>

        {/* Restrictions */}
        {(riskProfile.flags.length > 0 || riskProfile.max_bet_override || riskProfile.bonuses_disabled || riskProfile.withdrawal_delay_hours > 0) && (
          <div className="bg-surface-card border border-border rounded p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-4 h-4 text-yellow" />
              <p className="font-condensed font-bold text-sm uppercase tracking-wider">Active Restrictions</p>
            </div>
            <div className="space-y-2">
              {riskProfile.max_bet_override && (
                <p className="font-mono text-xs text-muted-foreground">
                  • Max bet limited to ₹{riskProfile.max_bet_override.toLocaleString("en-IN")}
                </p>
              )}
              {riskProfile.bonuses_disabled && (
                <p className="font-mono text-xs text-loss">• Bonuses disabled</p>
              )}
              {riskProfile.withdrawal_delay_hours > 0 && (
                <p className="font-mono text-xs text-yellow">
                  • Withdrawal delay: {riskProfile.withdrawal_delay_hours}h processing time
                </p>
              )}
              {riskProfile.flags.map((f) => (
                <p key={f} className="font-mono text-xs text-loss">• Flag: {f.replace(/_/g, " ")}</p>
              ))}
            </div>
          </div>
        )}

        {/* KYC CTA */}
        {!kyc.loading && kyc.profile && kyc.profile.kyc_level < 2 && (
          <button
            onClick={() => navigate("/profile")}
            className="w-full bg-blue/10 border border-blue/30 rounded p-4 flex items-center justify-between hover:bg-blue/20 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-blue" />
              <div className="text-left">
                <p className="font-condensed font-bold text-sm text-blue">Complete KYC Verification</p>
                <p className="font-mono text-[0.6rem] text-muted-foreground">
                  {kyc.profile.kyc_level === 0
                    ? "Enable withdrawals by verifying your identity"
                    : "Upgrade to Level 2 for unlimited withdrawals"}
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-blue" />
          </button>
        )}
      </div>
    </div>
  );
};

export default AccountStatusPage;
