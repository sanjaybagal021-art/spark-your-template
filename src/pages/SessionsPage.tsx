import React from "react";
import { useActiveSessions } from "@/hooks/useActiveSessions";
import { useLoginHistory } from "@/hooks/useLoginHistory";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Smartphone, Activity, Shield } from "lucide-react";

const parseDevice = (ua: string | null) => {
  if (!ua) return "Unknown Device";
  if (ua.includes("Mobile")) return "Mobile";
  if (ua.includes("Windows")) return "Windows PC";
  if (ua.includes("Mac")) return "macOS";
  if (ua.includes("Linux")) return "Linux";
  return "Browser";
};

const SessionsPage: React.FC = () => {
  const sessions = useActiveSessions();
  const loginHistory = useLoginHistory();

  return (
    <div className="pb-20 lg:pb-8">
      <div className="px-4 lg:px-6 py-5 border-b border-border">
        <h1 className="font-condensed font-black text-2xl tracking-wider uppercase">Sessions & Security</h1>
      </div>

      <div className="px-4 lg:px-6 py-6 max-w-2xl space-y-6">
        {/* Active Sessions */}
        <div className="bg-surface-card border border-border rounded overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-blue" />
            <h3 className="font-condensed font-700 text-base tracking-wider uppercase">
              Active Devices ({sessions.sessions.length})
            </h3>
          </div>
          <div className="p-5 space-y-2">
            {sessions.loading ? (
              <div className="h-12 bg-surface-raised animate-pulse rounded" />
            ) : sessions.sessions.length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground py-3 text-center">No active sessions</p>
            ) : (
              sessions.sessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between bg-surface-raised border border-border rounded p-3">
                  <div>
                    <p className="font-condensed font-600 text-sm text-foreground">{parseDevice(session.user_agent)}</p>
                    <p className="font-mono text-[0.55rem] text-muted-foreground">
                      {session.screen_resolution} · {session.timezone} · Last seen{" "}
                      {formatDistanceToNow(new Date(session.last_seen_at), { addSuffix: true })}
                    </p>
                  </div>
                  <button
                    onClick={() => sessions.revokeSession(session.id)}
                    className="font-mono text-[0.6rem] text-loss hover:text-loss/80 tracking-wider uppercase"
                  >
                    Revoke
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Login History */}
        <div className="bg-surface-card border border-border rounded overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue" />
            <h3 className="font-condensed font-700 text-base tracking-wider uppercase">Login History</h3>
          </div>
          <div className="p-5 space-y-2">
            {loginHistory.loading ? (
              <div className="h-12 bg-surface-raised animate-pulse rounded" />
            ) : loginHistory.events.length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground py-3 text-center">No login history</p>
            ) : (
              loginHistory.events.map((event) => (
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
                    {event.risk_flags.map((flag) => (
                      <span key={flag} className="font-mono text-[0.55rem] bg-loss/10 text-loss border border-loss/20 px-1.5 py-0.5 rounded">
                        {flag.replace(/_/g, " ")}
                      </span>
                    ))}
                    {event.risk_flags.length === 0 && !event.is_new_device && (
                      <span className="font-mono text-[0.55rem] text-success">
                        <Shield className="w-3 h-3 inline mr-1" />
                        Clean login
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionsPage;
