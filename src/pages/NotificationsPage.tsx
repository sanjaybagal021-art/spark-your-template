import React from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck, Gift, TrendingUp, ArrowDownLeft, ArrowUpRight, Shield } from "lucide-react";

const ICON_MAP: Record<string, React.ReactNode> = {
  bet_accepted: <TrendingUp className="w-4 h-4 text-blue" />,
  bet_won: <TrendingUp className="w-4 h-4 text-success" />,
  bet_lost: <TrendingUp className="w-4 h-4 text-loss" />,
  deposit: <ArrowDownLeft className="w-4 h-4 text-success" />,
  withdrawal: <ArrowUpRight className="w-4 h-4 text-loss" />,
  security: <Shield className="w-4 h-4 text-yellow" />,
  bonus: <Gift className="w-4 h-4 text-blue" />,
};

const NotificationsPage: React.FC = () => {
  const { notifications, loading, unreadCount, markAllRead, markRead } = useNotifications();

  return (
    <div className="pb-20 lg:pb-8">
      <div className="px-4 lg:px-6 py-5 border-b border-border flex items-center justify-between">
        <h1 className="font-condensed font-black text-2xl tracking-wider uppercase">Notifications</h1>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 font-mono text-[0.65rem] text-blue hover:text-blue/80 tracking-wider uppercase"
          >
            <CheckCheck className="w-3.5 h-3.5" /> Mark all read
          </button>
        )}
      </div>

      <div className="px-4 lg:px-6 py-4 max-w-2xl">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-surface-card border border-border rounded animate-pulse" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-20 text-center">
            <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="font-mono text-sm text-muted-foreground tracking-wider uppercase">No notifications yet</p>
          </div>
        ) : (
          <div className="bg-surface-card border border-border rounded overflow-hidden">
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => !n.read && markRead(n.id)}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-4 border-b border-border/50 last:border-0 text-left transition-colors",
                  !n.read ? "bg-blue/5 hover:bg-blue/10" : "hover:bg-surface-raised"
                )}
              >
                <span className="w-8 h-8 bg-surface-raised rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                  {ICON_MAP[n.type] ?? <Bell className="w-4 h-4 text-muted-foreground" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn("font-condensed font-600 text-sm truncate", !n.read && "text-foreground font-bold")}>
                      {n.title}
                    </p>
                    {!n.read && <div className="w-2 h-2 bg-blue rounded-full flex-shrink-0" />}
                  </div>
                  {n.body && (
                    <p className="font-mono text-[0.6rem] text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                  )}
                  <p className="font-mono text-[0.55rem] text-muted-foreground/60 mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
