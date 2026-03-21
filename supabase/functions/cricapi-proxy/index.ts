import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version",
};

const RAPIDAPI_KEY = Deno.env.get("RAPIDAPI_KEY");
const CRICBUZZ_HOST = "cricbuzz-cricket.p.rapidapi.com";

// In-memory cache
let cache: { data: unknown; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 60_000; // 60 seconds

async function fetchWithRetry(url: string, headers: Record<string, string>, retries = 3, delayMs = 1500): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      const res = await fetch(url, { signal: controller.signal, headers });
      clearTimeout(timeout);
      return res;
    } catch (err) {
      const isLast = attempt === retries;
      if (isLast) throw err;
      console.warn(`Cricbuzz API attempt ${attempt} failed, retrying in ${delayMs}ms...`);
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
  throw new Error("All retries exhausted");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!RAPIDAPI_KEY) {
      return new Response(
        JSON.stringify({ error: "RAPIDAPI_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint") ?? "currentMatches";
    const matchId = url.searchParams.get("matchId");

    const rapidHeaders = {
      "X-RapidAPI-Key": RAPIDAPI_KEY,
      "X-RapidAPI-Host": CRICBUZZ_HOST,
    };

    // For currentMatches, use cache to reduce API hits
    const useCache = endpoint === "currentMatches";
    if (useCache && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
      return new Response(JSON.stringify(cache.data), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "HIT" },
      });
    }

    let apiUrl: string;
    if (endpoint === "match" && matchId) {
      apiUrl = `https://${CRICBUZZ_HOST}/mcenter/v1/${matchId}`;
    } else if (endpoint === "scorecard" && matchId) {
      apiUrl = `https://${CRICBUZZ_HOST}/mcenter/v1/${matchId}/hscard`;
    } else if (endpoint === "commentary" && matchId) {
      apiUrl = `https://${CRICBUZZ_HOST}/mcenter/v1/${matchId}/comm`;
    } else {
      // Get current/recent matches
      apiUrl = `https://${CRICBUZZ_HOST}/matches/v1/recent`;
    }

    const res = await fetchWithRetry(apiUrl, rapidHeaders);

    if (!res.ok) {
      if (useCache && cache) {
        console.warn(`Cricbuzz API returned ${res.status}, serving stale cache`);
        return new Response(JSON.stringify(cache.data), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "STALE" },
        });
      }
      throw new Error(`Cricbuzz API returned HTTP ${res.status}`);
    }

    const data = await res.json();

    // Normalize the response for the frontend
    let normalized: any;
    if (endpoint === "currentMatches") {
      // Extract matches from typeMatches array
      const allMatches: any[] = [];
      if (data.typeMatches && Array.isArray(data.typeMatches)) {
        for (const typeMatch of data.typeMatches) {
          if (typeMatch.seriesMatches && Array.isArray(typeMatch.seriesMatches)) {
            for (const seriesMatch of typeMatch.seriesMatches) {
              const seriesAdWrapper = seriesMatch.seriesAdWrapper;
              if (seriesAdWrapper?.matches && Array.isArray(seriesAdWrapper.matches)) {
                for (const matchWrapper of seriesAdWrapper.matches) {
                  if (matchWrapper.matchInfo) {
                    const info = matchWrapper.matchInfo;
                    allMatches.push({
                      matchId: info.matchId,
                      matchDescription: info.matchDesc,
                      matchFormat: info.matchFormat,
                      status: info.status,
                      state: info.state,
                      team1: info.team1,
                      team2: info.team2,
                      venueInfo: info.venueInfo,
                      seriesName: info.seriesName,
                      startDate: info.startDate,
                      matchScore: matchWrapper.matchScore,
                    });
                  }
                }
              }
            }
          }
        }
      }
      normalized = { matches: allMatches };
    } else {
      normalized = data;
    }

    if (useCache) {
      cache = { data: normalized, fetchedAt: Date.now() };
    }

    return new Response(JSON.stringify(normalized), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "MISS" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("cricapi-proxy error:", message);

    if (cache) {
      console.warn("Serving stale cache after error");
      return new Response(JSON.stringify(cache.data), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-Cache": "STALE" },
      });
    }

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
