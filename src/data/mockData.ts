// Cricket-only mock data for LIVEBET platform

export type Sport = "Cricket";
export const SPORTS: Sport[] = ["Cricket"];
export const SPORT_ICONS: Record<Sport, string> = { Cricket: "🏏" };

export interface OddOption {
  id: string;
  label: string;
  value: number;
  trend: "up" | "down" | null;
}

export interface Market {
  id: string;
  name: string;
  odds: OddOption[];
}

export interface Match {
  id: string;
  team1: string;
  team2: string;
  team1Short: string;
  team2Short: string;
  league: string;
  sport: Sport;
  status: "live" | "upcoming" | "completed";
  score1?: string;
  score2?: string;
  time: string;
  detail?: string;
  markets: Market[];
}

export interface BetSelection {
  matchId: string;
  matchTitle: string;
  marketName: string;
  selectionLabel: string;
  odds: number;
}

function makeOdds(team1: string, team2: string, drawOdds?: number): OddOption[] {
  const odds: OddOption[] = [
    { id: crypto.randomUUID(), label: team1, value: 1.75 + Math.random() * 0.5, trend: null },
    { id: crypto.randomUUID(), label: team2, value: 1.85 + Math.random() * 0.6, trend: null },
  ];
  if (drawOdds) {
    odds.push({ id: crypto.randomUUID(), label: "Draw", value: drawOdds, trend: null });
  }
  return odds;
}

function makeMarkets(t1: string, t2: string): Market[] {
  return [
    {
      id: crypto.randomUUID(),
      name: "Match Winner",
      odds: makeOdds(t1, t2),
    },
    {
      id: crypto.randomUUID(),
      name: "Toss Winner",
      odds: [
        { id: crypto.randomUUID(), label: t1, value: 1.9 + Math.random() * 0.2, trend: null },
        { id: crypto.randomUUID(), label: t2, value: 1.9 + Math.random() * 0.2, trend: null },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: "Top Batsman",
      odds: [
        { id: crypto.randomUUID(), label: "Player A", value: 3.5 + Math.random(), trend: null },
        { id: crypto.randomUUID(), label: "Player B", value: 4.0 + Math.random(), trend: null },
        { id: crypto.randomUUID(), label: "Player C", value: 5.0 + Math.random(), trend: null },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: "Total Runs O/U",
      odds: [
        { id: crypto.randomUUID(), label: "Over 320.5", value: 1.85 + Math.random() * 0.3, trend: null },
        { id: crypto.randomUUID(), label: "Under 320.5", value: 1.85 + Math.random() * 0.3, trend: null },
      ],
    },
  ];
}

export const INITIAL_MATCHES: Match[] = [
  {
    id: "ipl-csk-mi",
    team1: "Chennai Super Kings",
    team2: "Mumbai Indians",
    team1Short: "CSK",
    team2Short: "MI",
    league: "IPL 2025",
    sport: "Cricket",
    status: "live",
    score1: "178/4 (18.2 ov)",
    score2: "—",
    time: "7:30 PM",
    detail: "18.2 ov",
    markets: makeMarkets("CSK", "MI"),
  },
  {
    id: "ipl-rcb-dc",
    team1: "Royal Challengers Bangalore",
    team2: "Delhi Capitals",
    team1Short: "RCB",
    team2Short: "DC",
    league: "IPL 2025",
    sport: "Cricket",
    status: "live",
    score1: "142/3 (15.4 ov)",
    score2: "—",
    time: "3:30 PM",
    detail: "15.4 ov",
    markets: makeMarkets("RCB", "DC"),
  },
  {
    id: "ipl-kkr-srh",
    team1: "Kolkata Knight Riders",
    team2: "Sunrisers Hyderabad",
    team1Short: "KKR",
    team2Short: "SRH",
    league: "IPL 2025",
    sport: "Cricket",
    status: "upcoming",
    time: "Tomorrow 7:30 PM",
    markets: makeMarkets("KKR", "SRH"),
  },
  {
    id: "ipl-gt-lsg",
    team1: "Gujarat Titans",
    team2: "Lucknow Super Giants",
    team1Short: "GT",
    team2Short: "LSG",
    league: "IPL 2025",
    sport: "Cricket",
    status: "upcoming",
    time: "Tomorrow 3:30 PM",
    markets: makeMarkets("GT", "LSG"),
  },
  {
    id: "ind-aus-odi",
    team1: "India",
    team2: "Australia",
    team1Short: "IND",
    team2Short: "AUS",
    league: "ODI SERIES",
    sport: "Cricket",
    status: "live",
    score1: "245/5 (42.3 ov)",
    score2: "289/8 (50 ov)",
    time: "2:00 PM",
    detail: "42.3 ov · IND need 45 runs",
    markets: makeMarkets("IND", "AUS"),
  },
  {
    id: "eng-sa-test",
    team1: "England",
    team2: "South Africa",
    team1Short: "ENG",
    team2Short: "SA",
    league: "TEST SERIES",
    sport: "Cricket",
    status: "live",
    score1: "312/7",
    score2: "198",
    time: "Day 2",
    detail: "Day 2 · Session 2",
    markets: makeMarkets("ENG", "SA"),
  },
  {
    id: "ipl-pbks-rr",
    team1: "Punjab Kings",
    team2: "Rajasthan Royals",
    team1Short: "PBKS",
    team2Short: "RR",
    league: "IPL 2025",
    sport: "Cricket",
    status: "upcoming",
    time: "Mar 23, 7:30 PM",
    markets: makeMarkets("PBKS", "RR"),
  },
  {
    id: "nz-pak-t20",
    team1: "New Zealand",
    team2: "Pakistan",
    team1Short: "NZ",
    team2Short: "PAK",
    league: "T20I SERIES",
    sport: "Cricket",
    status: "completed",
    score1: "185/6 (20 ov)",
    score2: "172/9 (20 ov)",
    time: "Completed",
    detail: "NZ won by 13 runs",
    markets: makeMarkets("NZ", "PAK"),
  },
];
