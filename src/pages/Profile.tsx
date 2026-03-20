import React, { useState, useEffect } from "react";
import { Mail, User, Lock, Bell, LogOut, Shield } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useKyc } from "@/hooks/useKyc";
import KycVerificationFlow from "@/components/kyc/KycVerificationFlow";
import { useDeviceTracking } from "@/hooks/useDeviceTracking";
import { useNotificationPreferences, type NotifChannel, type NotifCategory } from "@/hooks/useNotificationPreferences";
const Profile: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ display_name: string | null; username: string | null; phone: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [betsStats, setBetsStats] = useState({ total: 0, wins: 0, wagered: 0, profit: 0 });

  const kyc = useKyc();
  useDeviceTracking();
  const notifPrefs = useNotificationPreferences();

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username, phone")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setProfile(data);
        setDisplayName(data.display_name ?? "");
      }
      setLoading(false);
    };
    const fetchStats = async () => {
      const { data: bets } = await supabase
        .from("bets")
        .select("stake, potential_win, profit_loss, status")
        .eq("user_id", user.id);
      if (bets) {
        const wagered = bets.reduce((s, b) => s + Number(b.stake), 0);
        const wins = bets.filter((b) => b.status === "won").length;
        const profit = bets.reduce((s, b) => s + (Number(b.profit_loss) || 0), 0);
        setBetsStats({ total: bets.length, wins, wagered, profit });
      }
    };
    fetchProfile();
    fetchStats();
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

        {/* KYC Verification — Multi-level flow */}
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
