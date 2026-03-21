import { useState, useEffect, useCallback, useRef } from "react";
import { Match, INITIAL_MATCHES } from "@/data/mockData";

// ---------------------------------------------------------------------------
// Local odds nudge engine (simulated live odds)
// ---------------------------------------------------------------------------
function nudgeOdds(value: number): { value: number; trend: "up" | "down" | null } {
  const delta = (Math.random() - 0.5) * 0.12;
  const newVal = Math.max(1.01, Math.round((value + delta) * 100) / 100);
  const trend = newVal > value ? "up" : newVal < value ? "down" : null;
  return { value: newVal, trend };
}

// ---------------------------------------------------------------------------
// Cricbuzz RapidAPI match shape (minimal)
// ---------------------------------------------------------------------------
interface CricbuzzMatch {
  matchId: number;
  matchDescription: string;
  matchFormat: string;
  status: string;
  state: string;
  team1?: { teamName: string; teamSName: string };
  team2?: { teamName: string; teamSName: string };
  venueInfo?: { ground: string; city: string };
  currentBatTeamId?: number;
  matchScore?: {
    team1Score?: { inngs1?: { runs: number; wickets: number; overs: number } };
    team2Score?: { inngs1?: { runs: number; wickets: number; overs: number } };
  };
  seriesName?: string;
  startDate?: string;
}

function mapCricbuzzMatch(apiMatch: CricbuzzMatch, existing?: Match): Partial<Match> {
  const isLive = apiMatch.state === "In Progress" || apiMatch.status?.toLowerCase().includes("opt to");
  const isCompleted = apiMatch.state === "Complete";

  const t1Score = apiMatch.matchScore?.team1Score?.inngs1;
  const t2Score = apiMatch.matchScore?.team2Score?.inngs1;

  const score1 = t1Score ? `${t1Score.runs}/${t1Score.wickets} (${t1Score.overs} ov)` : undefined;
  const score2 = t2Score ? `${t2Score.runs}/${t2Score.wickets} (${t2Score.overs} ov)` : undefined;

  const team1Short = apiMatch.team1?.teamSName ?? existing?.team1Short ?? "";
  const team2Short = apiMatch.team2?.teamSName ?? existing?.team2Short ?? "";

  return {
    id: existing?.id ?? String(apiMatch.matchId),
    team1: apiMatch.team1?.teamName ?? existing?.team1 ?? "",
    team2: apiMatch.team2?.teamName ?? existing?.team2 ?? "",
    team1Short,
    team2Short,
    score1: score1 ?? existing?.score1,
    score2: score2 ?? existing?.score2,
    status: isLive ? "live" : isCompleted ? "completed" : (existing?.status ?? "upcoming"),
    sport: "Cricket",
    detail: t1Score ? `${t1Score.overs} ov` : existing?.detail,
    markets: existing?.markets ?? [],
    league: existing?.league ?? (apiMatch.seriesName?.toUpperCase() ?? apiMatch.matchFormat?.toUpperCase() ?? "CRICKET"),
    time: existing?.time ?? "TBD",
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useLiveOdds() {
  const [matches, setMatches] = useState<Match[]>(INITIAL_MATCHES);
  const [flashMap, setFlashMap] = useState<Record<string, "up" | "down">>({});
  const oddsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cricTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ------------------------------------------------------------------
  // Fetch live cricket data from our edge function proxy (Cricbuzz)
  // ------------------------------------------------------------------
  const fetchCricketData = useCallback(async () => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

      if (!supabaseUrl || !supabaseKey) return;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);

      const res = await fetch(
        `${supabaseUrl}/functions/v1/cricapi-proxy?endpoint=currentMatches`,
        {
          signal: controller.signal,
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        }
      );
      clearTimeout(timeout);

      if (!res.ok) return;

      const json = await res.json();
      if (json?.error || !json?.matches || !Array.isArray(json.matches)) return;

      const liveApiMatches: CricbuzzMatch[] = json.matches;

      if (liveApiMatches.length === 0) return;

      setMatches((prev) => {
        const updated = [...prev];

        liveApiMatches.forEach((apiMatch) => {
          const t1Name = (apiMatch.team1?.teamSName ?? "").toLowerCase();
          const existingIdx = updated.findIndex(
            (m) => m.id === String(apiMatch.matchId) ||
              m.team1Short.toLowerCase() === t1Name ||
              m.team2Short.toLowerCase() === t1Name
          );

          if (existingIdx >= 0) {
            const patch = mapCricbuzzMatch(apiMatch, updated[existingIdx]);
            updated[existingIdx] = { ...updated[existingIdx], ...patch };
          }
        });

        return updated;
      });
    } catch {
      // Silently fail — fall back to simulated odds
    }
  }, []);

  // ------------------------------------------------------------------
  // Simulated odds engine (always running for cricket)
  // ------------------------------------------------------------------
  const updateOdds = useCallback(() => {
    const newFlash: Record<string, "up" | "down"> = {};

    setMatches((prev) =>
      prev.map((match) => {
        if (match.status !== "live") return match;
        return {
          ...match,
          markets: match.markets.map((market) => ({
            ...market,
            odds: market.odds.map((odd) => {
              if (Math.random() > 0.35) return { ...odd, trend: null };
              const { value, trend } = nudgeOdds(odd.value);
              if (trend) newFlash[odd.id] = trend;
              return { ...odd, value, trend };
            }),
          })),
          // Cricket score bumps (simulated)
          ...(Math.random() > 0.7
            ? {
                score1: match.score1
                  ? (() => {
                      const parts = match.score1.split("/");
                      if (parts.length < 2) return match.score1;
                      const runs = parseInt(parts[0]);
                      return `${runs + Math.floor(Math.random() * 6)}/${parts[1]}`;
                    })()
                  : match.score1,
              }
            : {}),
        };
      })
    );

    setFlashMap(newFlash);
    setTimeout(() => setFlashMap({}), 1600);
  }, []);

  useEffect(() => {
    // Odds simulation: every 2.8s
    oddsTimerRef.current = setInterval(updateOdds, 2800);

    // Cricket live data: every 60s
    fetchCricketData();
    cricTimerRef.current = setInterval(fetchCricketData, 60_000);

    return () => {
      if (oddsTimerRef.current) clearInterval(oddsTimerRef.current);
      if (cricTimerRef.current) clearInterval(cricTimerRef.current);
    };
  }, [updateOdds, fetchCricketData]);

  return { matches, flashMap };
}
