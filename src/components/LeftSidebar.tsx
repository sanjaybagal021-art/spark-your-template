import React from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Receipt, Wallet, Shield, Bell,
  Smartphone, User, Settings, ArrowUpRight
} from "lucide-react";

interface LeftSidebarProps {
  matchCounts: Record<string, number>;
  collapsed?: boolean;
}

const NAV_LINKS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/my-bets", label: "My Bets", icon: Receipt },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/wallet?panel=withdraw", label: "Withdraw", icon: ArrowUpRight },
  { to: "/profile", label: "Profile & KYC", icon: User },
  { to: "/account-status", label: "Account Status", icon: Shield },
  { to: "/sessions", label: "Sessions", icon: Smartphone },
  { to: "/notifications", label: "Notifications", icon: Bell },
];

const LeftSidebar: React.FC<LeftSidebarProps> = ({ matchCounts, collapsed = false }) => {
  const totalMatches = Object.values(matchCounts).reduce((a, b) => a + b, 0);

  return (
    <aside
      className={cn(
        "flex flex-col h-full border-r border-border bg-surface transition-all duration-200",
        collapsed ? "w-14" : "w-52"
      )}
    >
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border flex items-center gap-2">
        <span className="font-condensed font-black text-xl text-yellow tracking-wider">
          {collapsed ? "LB" : "LIVE\u00A0BET"}
        </span>
        {!collapsed && (
          <span className="font-mono text-[0.52rem] text-muted-foreground/60 tracking-widest mt-1">
            CRICKET
          </span>
        )}
      </div>

      {/* Page Navigation */}
      {!collapsed && (
        <div className="border-b border-border py-2">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to + link.label}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 px-4 py-2.5 font-mono text-[0.68rem] tracking-widest uppercase transition-all",
                  isActive
                    ? "text-yellow bg-surface-raised border-l-2 border-yellow"
                    : "text-muted-foreground hover:text-foreground border-l-2 border-transparent"
                )
              }
            >
              <link.icon className="w-3.5 h-3.5 flex-shrink-0" />
              {link.label}
            </NavLink>
          ))}
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 px-4 py-2.5 font-mono text-[0.68rem] tracking-widest uppercase transition-all",
                isActive
                  ? "text-yellow bg-surface-raised border-l-2 border-yellow"
                  : "text-muted-foreground hover:text-foreground border-l-2 border-transparent"
              )
            }
          >
            <Settings className="w-3.5 h-3.5 flex-shrink-0" />
            Admin
          </NavLink>
        </div>
      )}

      {/* Cricket Stats */}
      <div className="flex-1 overflow-y-auto py-4 px-4">
        {!collapsed && (
          <>
            <p className="section-label pb-3">🏏 Cricket</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[0.65rem] text-muted-foreground">Total Matches</span>
                <span className="font-condensed font-bold text-sm text-foreground">{totalMatches}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[0.65rem] text-muted-foreground">Live</span>
                <span className="font-condensed font-bold text-sm text-success">{matchCounts["live"] ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[0.65rem] text-muted-foreground">Upcoming</span>
                <span className="font-condensed font-bold text-sm text-yellow">{matchCounts["upcoming"] ?? 0}</span>
              </div>
            </div>
          </>
        )}
      </div>

      {!collapsed && (
        <div className="border-t border-border p-4">
          <p className="font-mono text-[0.58rem] text-muted-foreground/50 leading-relaxed tracking-wide">
            18+ · Gamble Responsibly · T&Cs Apply
          </p>
        </div>
      )}
    </aside>
  );
};

export default LeftSidebar;
