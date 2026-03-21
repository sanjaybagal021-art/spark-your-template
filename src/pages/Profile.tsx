import React, { useState, useEffect } from "react";
import { Mail, User, Lock, Bell, LogOut, Shield, Smartphone, Activity, Gift, Link2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useKyc } from "@/hooks/useKyc";
import KycVerificationFlow from "@/components/kyc/KycVerificationFlow";
import { useDeviceTracking } from "@/hooks/useDeviceTracking";
import { useNotificationPreferences, type NotifChannel, type NotifCategory } from "@/hooks/useNotificationPreferences";
import { useActiveSessions } from "@/hooks/useActiveSessions";
import { useLoginHistory } from "@/hooks/useLoginHistory";
import { useLockedFunds } from "@/hooks/useLockedFunds";
import { formatDistanceToNow } from "date-fns";

const Profile: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ display_name: string | null; username: string | null; phone: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [betsStats, setBetsStats] = useState({ total: 0, wins: 0, wagered: 0, profit: 0 });
  const [referralCode, setReferralCode] = useState<string | null>(null);

  const kyc = useKyc();
  useDeviceTracking();
  const notifPrefs = useNotificationPreferences();
  const activeSessions = useActiveSessions();
  const loginHistory = useLoginHistory();
  const lockedFunds = useLockedFunds();

  const [showSessions, setShowSessions] = useState(false);
  const [showLoginHistory, setShowLoginHistory] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setProfile({ display_name: data.display_name, username: data.username, phone: "" });
        setDisplayName(data.display_name ?? "");
      }
      setLoading(false);
    };
    const fetchStats = async () => {
      const { data: bets } = await supabase
        .from("bets" as any)
        .select("stake, potential_win, profit_loss, status")
        .eq("user_id", user.id);
      if (bets) {
        const betsArr = bets as any[];
        const wagered = betsArr.reduce((s: number, b: any) => s + Number(b.stake), 0);
        const wins = betsArr.filter((b: any) => b.status === "won").length;
        const profit = betsArr.reduce((s: number, b: any) => s + (Number(b.profit_loss) || 0), 0);
        setBetsStats({ total: betsArr.length, wins, wagered, profit });
      }
    };
    const fetchReferral = async () => {
      const { data } = await supabase
        .from("user_referrals" as any)
        .select("referral_code")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setReferralCode((data as any).referral_code);
    };
    fetchProfile();
    fetchStats();
    fetchReferral();
  }, [user]);

  const handleSaveName = async () => {
    if (!user) return;
    setSaving(true);
    await supabase.from("profiles").update({ display_name: displayName }).eq("user_id", user.id);
    setProfile((p) => p ? { ...p, display_name: displayName } : p);
    setEditingName(false);
    setSaving(false);
  };

  const winRate = betsStats.total > 0 ? Math.round((betsStats.wins / betsStats.total) * 100) : 0;

  const parseDevice = (ua: string | null) => {
    if (!ua) return "Unknown Device";
    if (ua.includes("Mobile")) return "Mobile";
    if (ua.includes("Windows")) return "Windows";
    if (ua.includes("Mac")) return "macOS";
    if (ua.includes("Linux")) return "Linux";
    return "Browser";
  };

  if (loading) {
    return (
      <div className="pb-20 lg:pb-8">
        <div className="px-4 lg:px-6 py-5 border-b border-border">
          <h1 className="font-condensed font-black text-2xl tracking-wider uppercase">Profile</h1>
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
        <h1 className="font-condensed font-black text-2xl tracking-wider uppercase">Profile</h1>
      </div>

      <div className="px-4 lg:px-6 py-6 max-w-2xl space-y-6">
        {/* User Info */}
        <div className="bg-surface-card border border-border rounded p-5">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 bg-blue/20 rounded flex items-center justify-center">
              <User className="w-7 h-7 text-blue" />
            </div>
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="stake-input flex-1"
                    autoFocus
                    maxLength={50}
                  />
                  <button onClick={handleSaveName} disabled={saving} className="font-mono text-[0.65rem] text-success tracking-wider uppercase">
                    {saving ? "..." : "Save"}
                  </button>
                  <button onClick={() => setEditingName(false)} className="font-mono text-[0.65rem] text-muted-foreground tracking-wider uppercase">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="font-condensed font-black text-xl text-foreground truncate">
                    {profile?.display_name || "Unnamed Player"}
                  </h2>
                  <button onClick={() => setEditingName(true)} className="font-mono text-[0.55rem] text-blue tracking-wider uppercase hover:text-blue/80">
                    Edit
                  </button>
                </div>
              )}
              <p className="font-mono text-[0.65rem] text-muted-foreground tracking-wider truncate">{user?.email}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total Bets", value: String(betsStats.total) },
              { label: "Win Rate", value: `${winRate}%` },
              { label: "Total Wagered", value: `₹${betsStats.wagered.toLocaleString("en-IN")}` },
              {
                label: "Total P&L",
                value: `${betsStats.profit >= 0 ? "+" : ""}₹${Math.abs(betsStats.profit).toLocaleString("en-IN")}`,
                positive: betsStats.profit >= 0,
              },
            ].map((stat) => (
              <div key={stat.label} className="bg-surface-raised border border-border rounded p-3">
                <p className="section-label mb-1">{stat.label}</p>
                <p className={cn("font-condensed font-black text-lg", "positive" in stat ? (stat.positive ? "text-success" : "text-loss") : "text-foreground")}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Locked Funds Warning */}
        {!lockedFunds.loading && lockedFunds.lockedBalance > 0 && (
          <div className="bg-loss/10 border border-loss/30 rounded p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-loss" />
              <p className="font-condensed font-bold text-sm text-loss uppercase tracking-wider">Locked Funds</p>
            </div>
            <p className="font-condensed font-black text-xl text-loss">
              ₹{lockedFunds.lockedBalance.toLocaleString("en-IN")}
            </p>
            {lockedFunds.locks.length > 0 && (
              <div className="mt-2 space-y-1">
                {lockedFunds.locks.map(lock => (
                  <div key={lock.id} className="flex items-center justify-between">
                    <span className="font-mono text-[0.6rem] text-loss/80">
                      {lock.reason.replace(/_/g, " ")}
                    </span>
                    <span className="font-condensed font-bold text-sm text-loss">
                      ₹{lock.amount.toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Referral Code */}
        {referralCode && (
          <div className="bg-surface-card border border-border rounded p-4">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="w-4 h-4 text-blue" />
              <p className="font-condensed font-bold text-sm uppercase tracking-wider">Your Referral Code</p>
            </div>
            <div className="flex items-center gap-3">
              <code className="font-mono text-lg text-yellow bg-surface-raised border border-border px-4 py-2 rounded tracking-widest">
                {referralCode}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}?ref=${referralCode}`)}
                className="font-mono text-[0.6rem] text-blue hover:text-blue/80 tracking-wider uppercase"
              >
                Copy Link
              </button>
            </div>
            <p className="font-mono text-[0.55rem] text-muted-foreground mt-2">
              Share your referral link and earn rewards when friends sign up
            </p>
          </div>
        )}

        {/* KYC Verification */}
        {!kyc.loading && kyc.profile && (
          <KycVerificationFlow
            level={kyc.profile.kyc_level}
            status={kyc.profile.kyc_status}
            panNumber={kyc.profile.pan_number}
            aadhaarNumber={kyc.profile.aadhaar_number}
            dateOfBirth={kyc.profile.date_of_birth}
            rejectReason={kyc.profile.kyc_reject_reason}
            documents={kyc.documents}
            uploading={kyc.uploading}
            onSubmitLevel1={kyc.submitLevel1}
            onSubmitLevel2={kyc.submitLevel2}
            onUploadDocument={kyc.uploadDocument}
          />
        )}

        {/* Security */}
        <div className="bg-surface-card border border-border rounded overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="font-condensed font-700 text-base tracking-wider uppercase">Security</h3>
          </div>
          {[
            { icon: Lock, label: "Change Password", desc: "Update your account password", action: "Update" },
            { icon: Shield, label: "Two-Factor Authentication", desc: "Add extra security to your account", action: "Enable" },
            { icon: Mail, label: "Email Verification", desc: user?.email_confirmed_at ? "Your email is verified" : "Email not verified", action: user?.email_confirmed_at ? "Verified" : "Resend" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between px-5 py-4 border-b border-border/50 last:border-0">
              <div className="flex items-center gap-3">
                <item.icon className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="font-condensed font-600 text-sm text-foreground">{item.label}</p>
                  <p className="font-mono text-[0.6rem] text-muted-foreground">{item.desc}</p>
                </div>
              </div>
              <button className="font-mono text-[0.65rem] text-blue tracking-wider uppercase hover:text-blue/80 transition-colors">
                {item.action}
              </button>
            </div>
          ))}
        </div>

        {/* Active Sessions */}
        <div className="bg-surface-card border border-border rounded overflow-hidden">
          <button
            onClick={() => setShowSessions(!showSessions)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-surface-raised transition-colors"
          >
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-blue" />
              <span className="font-condensed font-bold text-sm uppercase tracking-wider">
                Active Devices ({activeSessions.sessions.length})
              </span>
            </div>
            <span className="font-mono text-[0.6rem] text-muted-foreground">{showSessions ? "▲" : "▼"}</span>
          </button>
          {showSessions && (
            <div className="px-5 pb-4 space-y-2">
              {activeSessions.loading ? (
                <div className="h-12 bg-surface-raised animate-pulse rounded" />
              ) : activeSessions.sessions.length === 0 ? (
                <p className="font-mono text-xs text-muted-foreground py-3 text-center">No active sessions</p>
              ) : (
                activeSessions.sessions.map(session => (
                  <div key={session.id} className="flex items-center justify-between bg-surface-raised border border-border rounded p-3">
                    <div>
                      <p className="font-condensed font-600 text-sm text-foreground">
                        {parseDevice(session.user_agent)}
                      </p>
                      <p className="font-mono text-[0.55rem] text-muted-foreground">
                        {session.screen_resolution} · {session.timezone} · Last seen {formatDistanceToNow(new Date(session.last_seen_at), { addSuffix: true })}
                      </p>
                    </div>
                    <button
                      onClick={() => activeSessions.revokeSession(session.id)}
                      className="font-mono text-[0.6rem] text-loss hover:text-loss/80 tracking-wider uppercase"
                    >
                      Revoke
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Login History */}
        <div className="bg-surface-card border border-border rounded overflow-hidden">
          <button
            onClick={() => setShowLoginHistory(!showLoginHistory)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-surface-raised transition-colors"
          >
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue" />
              <span className="font-condensed font-bold text-sm uppercase tracking-wider">
                Login History
              </span>
            </div>
            <span className="font-mono text-[0.6rem] text-muted-foreground">{showLoginHistory ? "▲" : "▼"}</span>
          </button>
          {showLoginHistory && (
            <div className="px-5 pb-4 space-y-2">
              {loginHistory.loading ? (
                <div className="h-12 bg-surface-raised animate-pulse rounded" />
              ) : loginHistory.events.length === 0 ? (
                <p className="font-mono text-xs text-muted-foreground py-3 text-center">No login history</p>
              ) : (
                loginHistory.events.map(event => (
                  <div key={event.id} className="bg-surface-raised border border-border rounded p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-condensed font-600 text-sm text-foreground">
                        {event.event_type.replace(/_/g, " ")}
                      </p>
                      <span className="font-mono text-[0.55rem] text-muted-foreground">
                        {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {event.is_new_device && (
                        <span className="font-mono text-[0.55rem] bg-yellow/10 text-yellow border border-yellow/20 px-1.5 py-0.5 rounded">
                          New Device
                        </span>
                      )}
                      {event.risk_flags.map(flag => (
                        <span key={flag} className="font-mono text-[0.55rem] bg-loss/10 text-loss border border-loss/20 px-1.5 py-0.5 rounded">
                          {flag.replace(/_/g, " ")}
                        </span>
                      ))}
                      {event.risk_flags.length === 0 && !event.is_new_device && (
                        <span className="font-mono text-[0.55rem] text-success">Clean login</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Notification Preferences */}
        <div className="bg-surface-card border border-border rounded overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="font-condensed font-700 text-base tracking-wider uppercase flex items-center gap-2">
              <Bell className="w-4 h-4" /> Notifications
            </h3>
          </div>
          {notifPrefs.loading ? (
            <div className="px-5 py-8 text-center">
              <p className="font-mono text-xs text-muted-foreground">Loading preferences...</p>
            </div>
          ) : (
            <>
              {(["bet_results", "promotions", "odds_alerts", "transactions", "security"] as NotifCategory[]).map((category) => (
                <div key={category} className="border-b border-border/50 last:border-0">
                  <div className="px-5 py-3">
                    <p className="font-condensed font-600 text-sm text-foreground capitalize">
                      {category.replace("_", " ")}
                    </p>
                    <div className="flex gap-4 mt-2">
                      {(["in_app", "email", "sms"] as NotifChannel[]).map((channel) => {
                        const enabled = notifPrefs.isEnabled(channel, category);
                        return (
                          <button
                            key={channel}
                            onClick={() => notifPrefs.toggle(channel, category)}
                            className="flex items-center gap-2"
                          >
                            <div className={cn(
                              "w-8 h-4 rounded-full cursor-pointer transition-colors flex items-center",
                              enabled ? "bg-blue justify-end" : "bg-surface-raised border border-border justify-start"
                            )}>
                              <div className="w-3 h-3 bg-foreground rounded-full mx-0.5" />
                            </div>
                            <span className="font-mono text-[0.6rem] text-muted-foreground uppercase tracking-wider">
                              {channel.replace("_", " ")}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Sign Out */}
        <button
          onClick={async () => { await signOut(); navigate("/auth"); }}
          className="w-full flex items-center justify-center gap-2 py-3 border border-loss/30 text-loss hover:bg-loss/10 transition-colors font-condensed font-bold text-sm tracking-widest uppercase rounded"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default Profile;
