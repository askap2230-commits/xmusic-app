// Copyright 2026 Azka Putra
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Modular Typo-Tolerant Smart Search, Multi-Source Blending & Dynamic Discovery Engine (v6.28.0).
 *
 * Pure TypeScript, zero external dependencies, 100% on-device:
 * - Diacritic & repeated-character normalization ("tuluuus" -> "tulus", "bernaadya" -> "bernadya")
 * - Bounded Damerau-Levenshtein edit distance (handles transpositions, missing/extra/wrong chars)
 * - Multi-source relevance ranking & source-balanced blending for the "All" tab
 * - Dynamic region + history + genre "Popular Searches" builder
 */
import { TRENDING_QUERIES } from '#lib/data/presets.ts';
import type { AlgorithmConfig, Track } from '#lib/types/music.ts';

const REGIONAL_POPULAR: Record<string, string[]> = {
  ID: ['Bernadya', 'Tulus', 'Hindia', 'Mahalini', 'Sheila On 7', 'Dewa 19', 'Nadin Amizah', 'Juicy Luicy'],
  US: ['The Weeknd', 'Billie Eilish', 'Bruno Mars', 'Taylor Swift', 'Sabrina Carpenter', 'SZA', 'Coldplay'],
  JP: ['YOASOBI', 'Kenshi Yonezu', 'Ado', 'Fujii Kaze', 'Official HIGE DANdism', 'City Pop'],
  KR: ['NewJeans', 'aespa', 'IU', 'BTS', 'BLACKPINK', 'SEVENTEEN', 'K-Drama OST'],
  GB: ['Dua Lipa', 'Arctic Monkeys', 'Ed Sheeran', 'Adele', 'Oasis', 'Coldplay'],
  GLOBAL: ['Bruno Mars', 'The Weeknd', 'Billie Eilish', 'Coldplay', 'Dua Lipa', 'Lofi Beats']
};

/**
 * Normalizes a search string for typo-tolerant matching:
 * strips diacritics, collapses 3+ repeated chars ("tuluuus" -> "tulus"), strips noise punctuation.
 */
export function normalizeSearchText(input: string): string {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/([a-z0-9])\1{2,}/g, '$1')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeQuery(input: string): string[] {
  const norm = normalizeSearchText(input);
  return norm ? norm.split(' ').filter((t) => t.length > 0) : [];
}

/**
 * Fast bounded Damerau-Levenshtein distance (returns maxDist + 1 early if exceeded).
 */
export function editDistance(a: string, b: string, maxDist = 2): number {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > maxDist) return maxDist + 1;
  if (la === 0) return lb;
  if (lb === 0) return la;

  const dp: number[][] = Array.from({ length: la + 1 }, () => new Array<number>(lb + 1).fill(0));
  for (let i = 0; i <= la; i++) dp[i][0] = i;
  for (let j = 0; j <= lb; j++) dp[0][j] = j;

  for (let i = 1; i <= la; i++) {
    let rowMin = maxDist + 1;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let val = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        val = Math.min(val, dp[i - 2][j - 2] + 1);
      }
      dp[i][j] = val;
      if (val < rowMin) rowMin = val;
    }
    if (rowMin > maxDist) return maxDist + 1;
  }
  return dp[la][lb];
}

/**
 * Computes fuzzy match quality (0..1) of a query token against a normalized target string.
 */
export function fuzzyTokenScore(qToken: string, targetNorm: string, targetTokens: string[]): number {
  if (!qToken || !targetNorm) return 0;
  if (targetTokens.includes(qToken)) return 1.0;
  if (targetTokens.some((t) => t.startsWith(qToken))) return 0.9;
  if (targetNorm.includes(qToken)) return 0.82;

  const maxDist = qToken.length >= 6 ? 2 : qToken.length >= 3 ? 1 : 0;
  if (maxDist === 0) return 0;

  let best = 0;
  for (const t of targetTokens) {
    if (Math.abs(t.length - qToken.length) > maxDist) continue;
    const d = editDistance(qToken, t, maxDist);
    if (d <= maxDist) {
      const sim = 1 - d / Math.max(qToken.length, t.length);
      if (sim > best) best = sim;
    }
  }
  return best * 0.78;
}

/**
 * Computes comprehensive relevance score for a Track against a user's query (typo-tolerant).
 */
export function scoreTrackRelevance(
  track: Track,
  rawQuery: string,
  likedSet: Set<string>,
  recentArtistSet: Set<string>
): number {
  const qNorm = normalizeSearchText(rawQuery);
  const qTokens = tokenizeQuery(rawQuery);
  if (!qNorm || qTokens.length === 0) return 0;

  const titleNorm = normalizeSearchText(track.title);
  const artistNorm = normalizeSearchText(track.artist);
  const albumNorm = normalizeSearchText(track.album);
  const combinedNorm = `${titleNorm} ${artistNorm} ${albumNorm}`.trim();
  const titleTokens = titleNorm ? titleNorm.split(' ') : [];
  const artistTokens = artistNorm ? artistNorm.split(' ') : [];
  const allTokens = [...titleTokens, ...artistTokens, ...(albumNorm ? albumNorm.split(' ') : [])];

  let score = 0;

  // Exact & prefix phrase boosts
  if (titleNorm === qNorm) score += 135;
  else if (titleNorm.startsWith(qNorm)) score += 95;
  else if (titleNorm.includes(qNorm)) score += 68;

  if (artistNorm === qNorm) score += 90;
  else if (artistNorm.startsWith(qNorm)) score += 62;
  else if (artistNorm.includes(qNorm)) score += 45;

  // Per-token exact + typo-tolerant fuzzy scoring
  let matchedCount = 0;
  let tokenSum = 0;
  for (const qt of qTokens) {
    const titleScore = fuzzyTokenScore(qt, titleNorm, titleTokens);
    const artistScore = fuzzyTokenScore(qt, artistNorm, artistTokens);
    const anyScore = Math.max(titleScore, artistScore, fuzzyTokenScore(qt, combinedNorm, allTokens) * 0.7);
    if (anyScore >= 0.45) {
      matchedCount += 1;
      tokenSum += titleScore * 28 + artistScore * 20 + (titleScore === 0 && artistScore === 0 ? anyScore * 16 : 0);
    }
  }
  score += tokenSum;

  // Full coverage bonus when every query word matches (even with typos)
  if (matchedCount === qTokens.length) {
    score += 42;
  } else if (matchedCount > 0) {
    score += (matchedCount / qTokens.length) * 18;
  }

  // Strong Full-Length Song Priority (never let 30s previews or 5s voice clips beat full songs)
  if (!track.isPreview) {
    score += 95;
  } else {
    score -= 65;
  }
  if (track.dur > 0 && track.dur < 45 && !track.isPreview) {
    score -= 60;
  } else if (track.dur >= 90 && track.dur <= 540) {
    score += 14;
  }
  if (track.source === 'local') score += 16;
  if (likedSet.has(track.id)) score += 14;
  if (artistNorm && recentArtistSet.has(artistNorm)) score += 10;

  // Source ranking for full-length music
  if (track.source === 'youtube') score += 18;
  else if (track.source === 'audius') score += 12;
  else if (track.source === 'archive') score += 8;

  return score;
}

/**
 * Deduplicates, ranks by typo-tolerant relevance, and source-balances results so "Semua" (All)
 * ALWAYS places the single most accurate match at #1 while surfacing Audius, YouTube Music,
 * Catalog/Deezer, Local, and Archive visibly together.
 */
export function blendAndRankSearchResults(
  tracks: Track[],
  query: string,
  likedIds: string[],
  history: Track[]
): Track[] {
  const likedSet = new Set(likedIds);
  const recentArtistSet = new Set(
    history
      .slice(0, 20)
      .map((h) => normalizeSearchText(h.artist))
      .filter(Boolean)
  );

  // Deduplicate by ID and normalized title+artist (preferring full-length over 30s preview)
  const deduped = new Map<string, Track>();
  for (const track of tracks) {
    if (!track?.id) continue;
    const key = `${normalizeSearchText(track.title)}__${normalizeSearchText(track.artist)}`;
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, track);
    } else if (existing.isPreview && !track.isPreview) {
      deduped.set(key, track);
    }
  }

  const scored = [...deduped.values()].map((track) => ({
    track,
    score: scoreTrackRelevance(track, query, likedSet, recentArtistSet)
  }));
  scored.sort((a, b) => b.score - a.score);

  if (scored.length <= 3) return scored.map((s) => s.track);

  // Pin #1 highest-accuracy match at top, then diversify remaining sources without sacrificing relevance
  const top = scored[0];
  const rest = scored.slice(1);
  const result: Track[] = [top.track];
  const usedIds = new Set<string>([top.track.id]);

  // Ensure top diverse sources (Audius, YouTube, Catalog, Local, Archive) are represented early if relevant
  const secondarySources: Array<Track['source']> = ['youtube', 'audius', 'local', 'archive'];
  const minThreshold = Math.max(18, top.score * 0.35);

  const promoted: Track[] = [];
  for (const src of secondarySources) {
    if (src === top.track.source) continue;
    const match = rest.find(
      (item) => item.track.source === src && item.score >= minThreshold && !usedIds.has(item.track.id)
    );
    if (match) {
      promoted.push(match.track);
      usedIds.add(match.track.id);
    }
  }

  // Interleave top-ranked remaining tracks with promoted multi-source diversity hits
  let pIdx = 0;
  let rCount = 0;
  for (const item of rest) {
    if (usedIds.has(item.track.id)) continue;
    result.push(item.track);
    usedIds.add(item.track.id);
    rCount += 1;
    if (rCount % 2 === 0 && pIdx < promoted.length) {
      result.push(promoted[pIdx++]);
    }
  }
  while (pIdx < promoted.length) {
    result.push(promoted[pIdx++]);
  }

  return result;
}

/**
 * Generates dynamic, region- & taste-aware "Populer Dicari" chips (zero telemetry, 100% on-device).
 */
export function buildDynamicTrendingQueries(
  config: AlgorithmConfig,
  history: Track[],
  recentSearches: string[]
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (term: string): void => {
    const clean = term.trim();
    const key = normalizeSearchText(clean);
    if (!clean || !key || seen.has(key)) return;
    seen.add(key);
    out.push(clean);
  };

  // 1. Top on-device favorite artists from listening history (if personalization enabled)
  if (config.personalizeFromHistory && history.length > 0) {
    const counts = new Map<string, { label: string; weight: number }>();
    history.slice(0, 25).forEach((h, idx) => {
      const artist = (h.artist || '').split(',')[0].trim();
      const key = normalizeSearchText(artist);
      if (!key || key === 'youtube music' || key === 'audius' || key === 'xmusic') return;
      const prev = counts.get(key);
      const w = Math.pow(0.92, idx);
      counts.set(key, { label: prev?.label || artist, weight: (prev?.weight || 0) + w });
    });
    [...counts.values()]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .forEach((a) => push(a.label));
  }

  // 2. Active region popular artists/terms
  const regional = REGIONAL_POPULAR[config.region] || REGIONAL_POPULAR.ID;
  for (const term of regional) {
    if (out.length >= 9) break;
    push(term);
  }

  // 3. Preferred genres from local algorithm config
  for (const genre of config.preferredGenres.slice(0, 2)) {
    push(`${genre} hits`);
  }

  // 4. Fill remaining slots with curated evergreen queries (avoiding duplicates with recent searches)
  const recentSet = new Set(recentSearches.map((r) => normalizeSearchText(r)));
  for (const term of TRENDING_QUERIES) {
    if (out.length >= 12) break;
    if (!recentSet.has(normalizeSearchText(term))) {
      push(term);
    }
  }

  return out.slice(0, 12);
}

/**
 * Typo-tolerant local track filter for instant 0ms search & suggestions.
 */
export function filterLocalTracksFuzzy(tracks: Track[], rawQuery: string): Track[] {
  const qTokens = tokenizeQuery(rawQuery);
  if (qTokens.length === 0) return [];
  const scored: Array<{ track: Track; score: number }> = [];
  for (const t of tracks) {
    const hay = normalizeSearchText(`${t.title} ${t.artist} ${t.album}`);
    const hayTokens = hay ? hay.split(' ') : [];
    let hits = 0;
    let total = 0;
    for (const qt of qTokens) {
      const sc = fuzzyTokenScore(qt, hay, hayTokens);
      if (sc >= 0.5) {
        hits += 1;
        total += sc;
      }
    }
    if (hits > 0 && hits >= Math.ceil(qTokens.length * 0.6)) {
      scored.push({ track: t, score: total / qTokens.length });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.track);
}
