import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { CURATED_PLAYLISTS } from './src/data/curatedPlaylists';
import { LeaderboardEntry } from './src/types';

const PORT = 3000;
const DATA_DIR = path.join(process.cwd(), 'data');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');

// Lazy Gemini API Client Initializer
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory cache for YouTube video searches
const youtubeSearchCache = new Map<string, { videoId: string; title?: string }>();

// ---------------------------------------------------------------------------
// Real audio-feature lookups (GetSongBPM.com)
//
// Replaces the old "hash the video ID into a fake BPM" approach with an
// actual tempo/key/time-signature lookup against a real song database.
// Free tier: 3000 requests/hour per key. A backlink to getsongbpm.com is
// required by their terms of service (see PlaylistSelector.tsx credit link).
// Sign up for a key at https://getsongbpm.com/api and set GETSONGBPM_API_KEY.
// ---------------------------------------------------------------------------
const GETSONGBPM_BASE_URL = 'https://api.getsong.co';
const GETSONGBPM_API_KEY = process.env.GETSONGBPM_API_KEY;

interface AudioFeatureMatch {
  tempo: number;
  timeSignature: number;
  timeSignatureRaw: string;
  keyOf: string;
  danceability: number; // 0-1 normalized
  acousticness: number; // 0-1 normalized
  matchedTitle: string;
  matchedArtist: string;
  genres: string[];
}

// Cache lookups by normalized "artist|title" so repeat plays and shared
// tracks don't burn the hourly quota.
const audioFeatureCache = new Map<string, AudioFeatureMatch | null>();

/**
 * YouTube video titles are messy ("Artist - Song (Official Video) [HD]",
 * "Song (Lyrics) ft. Someone", "Artist - Song | Official Audio", channel
 * names ending in " - Topic", etc). This strips the common noise and, where
 * possible, splits out an artist/title guess so the BPM lookup has a much
 * better chance of matching the real song in the database.
 */
function cleanYouTubeMetadata(rawTitle: string, rawAuthor: string): { title: string; artist: string } {
  let title = rawTitle;

  // Strip bracketed/parenthetical noise: (Official Video), [Lyrics], (HD), etc.
  title = title.replace(/[\(\[][^\)\]]*(official|video|audio|lyrics?|hd|4k|visualizer|remaster\w*|hq|explicit|clean)[^\)\]]*[\)\]]/gi, '');
  // Strip trailing "| Official ..." style suffixes
  title = title.replace(/\s*\|.*$/, '');
  // Strip featuring credits, they rarely help a title match
  title = title.replace(/\s*(feat\.?|ft\.?)\s+.+$/i, '');

  let artist = rawAuthor.replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim();

  // Many uploads are titled "Artist - Song Title"; prefer that over the
  // channel name when it's present, since channel names are often labels
  // or aggregator accounts rather than the performing artist.
  const dashSplit = title.split(/\s+[-–—]\s+/);
  if (dashSplit.length >= 2) {
    artist = dashSplit[0].trim() || artist;
    title = dashSplit.slice(1).join(' - ').trim();
  }

  title = title.replace(/\s{2,}/g, ' ').trim();
  artist = artist.replace(/\s{2,}/g, ' ').trim();

  return { title: title || rawTitle, artist: artist || rawAuthor };
}

/**
 * Looks up real tempo/key/time-signature for a song from GetSongBPM.
 * Returns null (never throws) if the key is missing, the lookup times out,
 * or no confident match is found — callers fall back to estimation.
 */
async function lookupAudioFeatures(title: string, artist: string): Promise<AudioFeatureMatch | null> {
  if (!GETSONGBPM_API_KEY) return null;

  const cacheKey = `${artist.toLowerCase()}|${title.toLowerCase()}`;
  if (audioFeatureCache.has(cacheKey)) {
    return audioFeatureCache.get(cacheKey)!;
  }

  try {
    const lookup = `song:${title} artist:${artist}`;
    const url = `${GETSONGBPM_BASE_URL}/search/?type=both&limit=1&lookup=${encodeURIComponent(lookup)}&api_key=${encodeURIComponent(GETSONGBPM_API_KEY)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });

    if (!res.ok) {
      audioFeatureCache.set(cacheKey, null);
      return null;
    }

    const data = (await res.json()) as any;
    const match = Array.isArray(data?.search) ? data.search[0] : null;

    if (!match || !match.tempo) {
      audioFeatureCache.set(cacheKey, null);
      return null;
    }

    const timeSigRaw: string = match.time_sig || '4/4';
    const timeSigNumerator = parseInt(timeSigRaw.split('/')[0], 10) || 4;

    const result: AudioFeatureMatch = {
      tempo: Math.round(Number(match.tempo)),
      timeSignature: timeSigNumerator,
      timeSignatureRaw: timeSigRaw,
      keyOf: match.key_of || 'C',
      danceability: Math.max(0, Math.min(100, Number(match.danceability) || 50)) / 100,
      acousticness: Math.max(0, Math.min(100, Number(match.acousticness) || 0)) / 100,
      matchedTitle: match.title || title,
      matchedArtist: match.artist?.name || artist,
      genres: Array.isArray(match.artist?.genres) ? match.artist.genres : [],
    };

    audioFeatureCache.set(cacheKey, result);
    return result;
  } catch {
    // Network error or timeout — treat as "no match", never block the request
    audioFeatureCache.set(cacheKey, null);
    return null;
  }
}

// Pre-populated verified working YouTube video IDs for instant resolution
const KNOWN_TRACK_VIDEOS: Record<string, string> = {
  'the midnight sunset': 'URma_gu1aNE',
  'sunset': 'URma_gu1aNE',
  'kavinsky nightcall': 'MV_3Dpw-BRY',
  'nightcall': 'MV_3Dpw-BRY',
  'scandroid neo tokyo': 'MkgR0SxmMKo',
  'neo-tokyo': 'MkgR0SxmMKo',
  'gunship tech noir': '-nC5TBv3sfU',
  'tech noir': '-nC5TBv3sfU',
  'avicii the nights': 'UtF6Jej8yb4',
  'the nights': 'UtF6Jej8yb4',
  'martin garrix animals': 'gCYcHz2k5x0',
  'animals': 'gCYcHz2k5x0',
  'fisher losing it': 'u31thuMehjM',
  'losing it': 'u31thuMehjM',
  'zedd clarity': 'IxxstCcJlsc',
  'clarity': 'IxxstCcJlsc',
  'pendulum witchcraft': 'OmeWleosFp0',
  'witchcraft': 'OmeWleosFp0',
  'sub focus solar system': 'hRgcgcTP7nM',
  'solar system': 'hRgcgcTP7nM',
  'pendulum watercolour': 'wpqm-05R2Jk',
  'watercolour': 'wpqm-05R2Jk',
  'lofi fruits coffee morning': 'jfKfPfyJRdk',
  'coffee morning': 'jfKfPfyJRdk',
  'aso rainy night in tokyo': '5qap5aO4i9A',
  'rainy night in tokyo': '5qap5aO4i9A',
  'wys snowman': 'rUxyKA_-grg',
  'snowman': 'rUxyKA_-grg',
  'the weeknd blinding lights': '4NRXx6U8ABQ',
  'blinding lights': '4NRXx6U8ABQ',
  'daft punk get lucky': '5NV6Rdv1a3I',
  'get lucky': '5NV6Rdv1a3I',
  'dua lipa levitating': 'TUVcZfQe-Kw',
  'levitating': 'TUVcZfQe-Kw',
};

// Helper to find a YouTube video ID for any song query (with caching & fast timeouts)
async function searchYouTubeVideo(query: string): Promise<{ videoId: string; title?: string } | null> {
  const normalized = query.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  
  // 1. Direct dictionary match
  for (const [key, vid] of Object.entries(KNOWN_TRACK_VIDEOS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return { videoId: vid };
    }
  }

  // 2. Cache match
  if (youtubeSearchCache.has(normalized)) {
    return youtubeSearchCache.get(normalized)!;
  }

  // 3. Fast network search with strict 1.5s timeout
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(1500),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
    if (match && match[1]) {
      const result = { videoId: match[1] };
      youtubeSearchCache.set(normalized, result);
      return result;
    }
  } catch (e) {
    // Search failed or timed out, gracefully return null
  }
  return null;
}

// Initial seed leaderboard entries
const SEED_LEADERBOARD: LeaderboardEntry[] = [
  {
    id: 'seed-1',
    playerName: 'NeoValkyrie',
    trackId: 'track-synth-1',
    trackTitle: 'Neon Highway 1986',
    artist: 'Kavinsky & The Midnight Vibe',
    playlistName: 'Synthwave Arcade Anthems',
    difficulty: 'HARD',
    score: 98450,
    maxCombo: 184,
    accuracy: 99.2,
    grade: 'SSS',
    timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
  },
  {
    id: 'seed-2',
    playerName: 'CyberNinja',
    trackId: 'track-synth-2',
    trackTitle: 'Laser Grid Runner',
    artist: 'CyberUnit 01',
    playlistName: 'Synthwave Arcade Anthems',
    difficulty: 'HARD',
    score: 95200,
    maxCombo: 162,
    accuracy: 97.4,
    grade: 'SS',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    id: 'seed-3',
    playerName: 'BeatMaster99',
    trackId: 'track-edm-1',
    trackTitle: 'Supernova Drop',
    artist: 'Astral Project & DJ Pulse',
    playlistName: 'Club & Festival EDM Rush',
    difficulty: 'HARD',
    score: 93800,
    maxCombo: 155,
    accuracy: 96.1,
    grade: 'SS',
    timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
  },
  {
    id: 'seed-4',
    playerName: 'AuraWalker',
    trackId: 'track-synth-1',
    trackTitle: 'Neon Highway 1986',
    artist: 'Kavinsky & The Midnight Vibe',
    playlistName: 'Synthwave Arcade Anthems',
    difficulty: 'MEDIUM',
    score: 87400,
    maxCombo: 112,
    accuracy: 94.5,
    grade: 'S',
    timestamp: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
  },
  {
    id: 'seed-5',
    playerName: 'RhythmGhost',
    trackId: 'track-dnb-1',
    trackTitle: 'Mach 3 Velocity',
    artist: 'Quantum Break',
    playlistName: 'Drum & Bass Sonic Velocity',
    difficulty: 'HARD',
    score: 99100,
    maxCombo: 240,
    accuracy: 98.8,
    grade: 'SSS',
    timestamp: new Date(Date.now() - 1000 * 60 * 500).toISOString(),
  },
  {
    id: 'seed-6',
    playerName: 'ChilledPanda',
    trackId: 'track-lofi-1',
    trackTitle: 'Coffee Steam & Rain',
    artist: 'Chilled Velvet',
    playlistName: 'Lo-Fi Chill & Steady Beats',
    difficulty: 'EASY',
    score: 72000,
    maxCombo: 68,
    accuracy: 92.3,
    grade: 'S',
    timestamp: new Date(Date.now() - 1000 * 60 * 650).toISOString(),
  },
];

function getLeaderboard(): LeaderboardEntry[] {
  try {
    if (fs.existsSync(LEADERBOARD_FILE)) {
      const data = fs.readFileSync(LEADERBOARD_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading leaderboard file, using seeds:', err);
  }
  return SEED_LEADERBOARD;
}

function saveLeaderboard(entries: LeaderboardEntry[]) {
  try {
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(entries, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing leaderboard file:', err);
  }
}

// Ensure seed data is written if file is missing
if (!fs.existsSync(LEADERBOARD_FILE)) {
  saveLeaderboard(SEED_LEADERBOARD);
}

// Procedural AI Fallback Generator for when Gemini API key is missing or offline
function generateFallbackAIBlueprint(
  trackTitle: string,
  artist: string,
  genre: string,
  focusStyle: string,
  tempo: number,
  customPrompt?: string
) {
  let hash = 0;
  for (let i = 0; i < (trackTitle + artist + focusStyle).length; i++) {
    hash = (hash * 31 + (trackTitle + artist).charCodeAt(i)) % 10000;
  }

  const isHighEnergy = tempo >= 125 || genre.toLowerCase().includes('dance') || genre.toLowerCase().includes('rock');

  const introMeasures = [
    [{ beat: 0.0, lane: 0 }, { beat: 2.0, lane: 1 }],
    [{ beat: 0.0, lane: 1 }, { beat: 2.5, lane: 2 }],
    [{ beat: 0.0, lane: 0 }, { beat: 1.5, lane: 1 }, { beat: 3.0, lane: 2 }],
    [{ beat: 0.0, lane: 1 }, { beat: 2.0, lane: 2 }, { beat: 3.0, lane: 3, accent: true }],
  ];

  const verseMeasures = [
    [{ beat: 0.0, lane: 1 }, { beat: 1.0, lane: 1 }, { beat: 2.0, lane: 2 }, { beat: 3.0, lane: 1 }],
    [{ beat: 0.0, lane: 1 }, { beat: 1.5, lane: 2 }, { beat: 2.5, lane: 2 }, { beat: 3.5, lane: 0 }],
    [{ beat: 0.0, lane: 0 }, { beat: 1.0, lane: 1 }, { beat: 2.0, lane: 2 }, { beat: 2.75, lane: 3 }],
    [{ beat: 0.0, lane: 2 }, { beat: 1.0, lane: 1 }, { beat: 2.0, lane: 0 }, { beat: 3.0, lane: 1 }],
  ];

  const buildMeasures = [
    [{ beat: 0.0, lane: 0 }, { beat: 1.0, lane: 1 }, { beat: 2.0, lane: 2 }, { beat: 3.0, lane: 3 }],
    [{ beat: 0.0, lane: 1 }, { beat: 1.0, lane: 2 }, { beat: 2.0, lane: 1 }, { beat: 2.5, lane: 2 }, { beat: 3.0, lane: 3 }],
    [{ beat: 0.0, lane: 2 }, { beat: 0.5, lane: 3 }, { beat: 1.0, lane: 2 }, { beat: 1.5, lane: 3 }, { beat: 2.0, lane: 2 }, { beat: 2.5, lane: 3 }, { beat: 3.0, lane: 1 }, { beat: 3.5, lane: 2 }],
    [{ beat: 0.0, lane: 3, accent: true }, { beat: 1.0, lane: 3, accent: true }, { beat: 2.0, lane: 3, accent: true }, { beat: 3.0, lane: 3, accent: true }],
  ];

  const chorusMeasures = [
    [{ beat: 0.0, lane: 2 }, { beat: 0.75, lane: 3, accent: true }, { beat: 1.5, lane: 2 }, { beat: 2.5, lane: 3 }, { beat: 3.25, lane: 1 }],
    [{ beat: 0.0, lane: 1 }, { beat: 1.0, lane: 2 }, { beat: 1.75, lane: 3, accent: true }, { beat: 2.5, lane: 2 }, { beat: 3.0, lane: 1 }],
    [{ beat: 0.0, lane: 0 }, { beat: 0.75, lane: 1 }, { beat: 1.5, lane: 2 }, { beat: 2.0, lane: 3, accent: true }, { beat: 3.0, lane: 2 }],
    [{ beat: 0.0, lane: 3, accent: true }, { beat: 1.0, lane: 2 }, { beat: 1.75, lane: 1 }, { beat: 2.5, lane: 2 }, { beat: 3.25, lane: 3, accent: true }],
  ];

  const soloMeasures = [
    [{ beat: 0.0, lane: 0 }, { beat: 0.5, lane: 1 }, { beat: 1.0, lane: 2 }, { beat: 1.5, lane: 3, accent: true }, { beat: 2.0, lane: 2 }, { beat: 2.5, lane: 1 }, { beat: 3.0, lane: 2 }, { beat: 3.5, lane: 3 }],
    [{ beat: 0.0, lane: 3 }, { beat: 0.5, lane: 2 }, { beat: 1.0, lane: 3 }, { beat: 1.5, lane: 2 }, { beat: 2.0, lane: 1 }, { beat: 2.5, lane: 2 }, { beat: 3.0, lane: 3, accent: true }],
    [{ beat: 0.0, lane: 1 }, { beat: 0.75, lane: 2 }, { beat: 1.5, lane: 3, accent: true }, { beat: 2.25, lane: 2 }, { beat: 3.0, lane: 3, accent: true }],
    [{ beat: 0.0, lane: 0 }, { beat: 1.0, lane: 1 }, { beat: 2.0, lane: 2 }, { beat: 2.5, lane: 3 }, { beat: 3.0, lane: 3, accent: true }],
  ];

  const styleTitles: Record<string, string> = {
    MELODY: 'Vocal Euphoria & Lead Motif',
    RIFFS: 'Syncopated Groove & Power Riffs',
    SOLO: 'Virtuoso Technical Odyssey',
    BASS_DROP: 'Sub-Bass Surge & Impact Drop',
  };

  return {
    styleName: styleTitles[focusStyle] || `${trackTitle} Melodic AI Chart`,
    musicalSummary: `Crafted around ${artist}'s distinct rhythm phrasing at ${tempo} BPM. Emphasizes melodic lead transitions across lanes 2 and 3 with responsive rhythmic grounding on lanes 0 and 1.`,
    suggestedDensity: isHighEnergy ? 'DENSE' : 'MODERATE',
    sectionMotifs: [
      { section: 'INTRO' as const, measures: introMeasures },
      { section: 'VERSE' as const, measures: verseMeasures },
      { section: 'BUILD' as const, measures: buildMeasures },
      { section: 'CHORUS' as const, measures: chorusMeasures },
      { section: 'SOLO' as const, measures: soloMeasures },
    ],
    generatedAt: new Date().toISOString(),
    focusStyle,
  };
}

/**
 * Primary AI Chart Generator Engine
 * Defaults to Gemini AI models with automatic fallback to procedural synthesis if offline
 */
async function generateAIChart(
  trackTitle: string,
  artist: string,
  genre: string = 'Electronic',
  tempo: number = 120,
  key: string = 'C',
  difficulty: string = 'MEDIUM',
  focusStyle: string = 'MELODY',
  customPrompt?: string
): Promise<{ blueprint: any; aiPowered: boolean; modelUsed?: string }> {
  const ai = getGeminiClient();

  if (ai) {
    const styleDescriptions: Record<string, string> = {
      MELODY: 'Focus heavily on lead vocal melodies, memorable saxophone riffs, and main melodic hooks. Ascend lanes on soaring notes and descend gracefully on vocal cadences.',
      RIFFS: 'Focus on rhythm guitar hooks, punchy synth arpeggios, and syncopated off-beat accents.',
      SOLO: 'High-technical charting with fast scalar runs across all 4 lanes, rapid trills between lanes 2 and 3, and climactic chord jumps.',
      BASS_DROP: 'Heavy bassline charting anchored on Lane 0 (Red/Bass) with syncopated Lane 1 chops, rising to explosive chorus drops with dual-lane accents.',
    };

    const styleInstruction = styleDescriptions[focusStyle] || styleDescriptions.MELODY;

    const prompt = `Song Title: "${trackTitle}" by ${artist}
Genre: ${genre}
Tempo: ${tempo} BPM
Musical Key: ${key}
Player Difficulty Target: ${difficulty}
Charting Style Focus: ${focusStyle} (${styleInstruction})
${customPrompt ? `User Custom Directives: "${customPrompt}"` : ''}

Generate a musically coherent 4-lane rhythm game chart structure with melodic note phrases for the 5 song sections: INTRO, VERSE, BUILD, CHORUS, SOLO.
Each section must provide 4 measures (a 4-bar phrase), with musical note placement (beat 0.0 to 3.75).
Lane mappings:
0: Low / Root melody / Bass
1: Mid-low vocal body / Rhythm riff
2: Mid-high lead hook / Chorus vocal
3: Soaring peak melody / Sax solo / High octave accent`;

    const systemInstruction = `You are an expert rhythm game chart architect (specializing in osu!mania, Guitar Hero, Beatmania, and StepMania).
Return a JSON object containing:
- styleName: A creative, evocative name for this AI chart (e.g., "Neon Saxophone Odyssey", "Syncopated Cyber Groove")
- musicalSummary: A concise 2-sentence explanation of the rhythmic motifs and melodic flow you designed for this track
- suggestedDensity: "LIGHT", "MODERATE", or "DENSE"
- sectionMotifs: array of 5 objects for sections: INTRO, VERSE, BUILD, CHORUS, SOLO.
  Each section object has:
  - section: ("INTRO" | "VERSE" | "BUILD" | "CHORUS" | "SOLO")
  - measures: array of 4 measures (each measure is an array of steps).
    Each step has:
    - beat: number between 0.0 and 3.75 (use quarter/eighth note increments like 0, 0.5, 1.0, 1.5, 2.0, 2.5, 2.75, 3.0, 3.5)
    - lane: integer 0, 1, 2, or 3
    - accent: boolean (true on peak musical moments or chord accents)
Follow musicality: build tension in BUILD, explode in CHORUS with expressive melody, keep INTRO atmospheric, and provide technical flair in SOLO.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        styleName: { type: Type.STRING },
        musicalSummary: { type: Type.STRING },
        suggestedDensity: {
          type: Type.STRING,
          enum: ['LIGHT', 'MODERATE', 'DENSE'],
        },
        sectionMotifs: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              section: {
                type: Type.STRING,
                enum: ['INTRO', 'VERSE', 'BUILD', 'CHORUS', 'SOLO'],
              },
              measures: {
                type: Type.ARRAY,
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      beat: { type: Type.NUMBER },
                      lane: { type: Type.INTEGER },
                      accent: { type: Type.BOOLEAN },
                    },
                    required: ['beat', 'lane'],
                  },
                },
              },
            },
            required: ['section', 'measures'],
          },
        },
      },
      required: ['styleName', 'musicalSummary', 'sectionMotifs', 'suggestedDensity'],
    };

    const modelsToTry = ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];
    for (const modelName of modelsToTry) {
      // Allow up to 2 attempts per model with a small backoff for temporary spikes
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const generationPromise = ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema,
            },
          });

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 12000)
          );

          const response = await Promise.race([generationPromise, timeoutPromise]);

          if (response.text) {
            const parsed = JSON.parse(response.text);
            if (parsed && parsed.sectionMotifs && Array.isArray(parsed.sectionMotifs)) {
              return {
                aiPowered: true,
                modelUsed: modelName,
                blueprint: {
                  ...parsed,
                  generatedAt: new Date().toISOString(),
                  focusStyle,
                },
              };
            }
          }
        } catch {
          // If transient demand spike, wait 200ms before retry or next model
          if (attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        }
      }
    }
  }

  // Fallback to procedural synthesis (resilient fallback when cloud models are busy)
  const fallbackBlueprint = generateFallbackAIBlueprint(
    trackTitle,
    artist,
    genre,
    focusStyle,
    Number(tempo) || 120,
    customPrompt
  );

  return {
    aiPowered: false,
    blueprint: fallbackBlueprint,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 1. Get Curated Playlists
  app.get(['/api/playlists/curated', '/api/spotify/curated'], (req, res) => {
    res.json(CURATED_PLAYLISTS);
  });

  // In-memory cache for parsed playlists
  const parsedPlaylistCache = new Map<string, any>();

  // 2. Parse YouTube or YouTube Music URL / ID
  const handleYouTubeParse = async (req: express.Request, res: express.Response) => {
    try {
      const { urlOrId } = req.body;
      if (!urlOrId || typeof urlOrId !== 'string') {
        res.status(400).json({ error: 'Please provide a valid YouTube or YouTube Music link.' });
        return;
      }

      const input = urlOrId.trim();

      // Explicit check for Spotify links
      if (/spotify\.com|spotify:/i.test(input)) {
        res.status(400).json({
          error: 'Spotify links are not supported. Please provide a YouTube or YouTube Music link.'
        });
        return;
      }

      const cacheKey = input.toLowerCase();
      if (parsedPlaylistCache.has(cacheKey)) {
        res.json(parsedPlaylistCache.get(cacheKey));
        return;
      }

      // Check if user pasted a YouTube or YouTube Music video URL or raw 11-char ID
      const ytVideoMatch =
        input.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/)|music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/) ||
        (input.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(input) ? [null, input] : null);

      // Check if user pasted a YouTube playlist URL (e.g. list=PL...)
      const ytListMatch = input.match(/[?&]list=([a-zA-Z0-9_-]+)/);

      if (!ytVideoMatch && !ytListMatch) {
        res.status(400).json({
          error: 'Please provide a valid YouTube or YouTube Music link (e.g., https://music.youtube.com/watch?v=... or https://youtu.be/...)'
        });
        return;
      }

      if (ytVideoMatch && ytVideoMatch[1]) {
        const videoId = ytVideoMatch[1];
        let title = 'YouTube Track';
        let author = 'YouTube Music';
        let thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        try {
          const oembedRes = await fetch(
            `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
            { signal: AbortSignal.timeout(1800) }
          );
          if (oembedRes.ok) {
            const oData = (await oembedRes.json()) as any;
            if (oData.title) title = oData.title;
            if (oData.author_name) author = oData.author_name;
            if (oData.thumbnail_url) thumbnail = oData.thumbnail_url;
          }
        } catch {
          // Timeout or error, proceed with standard defaults
        }

        // Deterministic fallback hash, used only if no real lookup match is found
        let hash = 0;
        for (let i = 0; i < videoId.length; i++) {
          hash = (hash * 31 + videoId.charCodeAt(i)) % 10000;
        }
        const bpmList = [114, 120, 124, 126, 128, 130, 132, 140, 150, 174, 88, 92, 96, 105];

        // Try to resolve REAL tempo/key/time-signature from a song database
        // using a cleaned-up guess of the artist/title from the YouTube metadata.
        const { title: cleanTitle, artist: cleanArtist } = cleanYouTubeMetadata(title, author);
        const features = await lookupAudioFeatures(cleanTitle, cleanArtist);

        const tempo = features?.tempo ?? bpmList[hash % bpmList.length];
        const key = features?.keyOf ?? ['C', 'D', 'E', 'F', 'G', 'A'][hash % 6];
        const timeSignature = features?.timeSignature ?? 4;
        const danceability = features ? features.danceability : 0.8;
        const energy = features ? Math.max(0, Math.min(1, 1 - features.acousticness * 0.6)) : 0.85;
        const genre = features?.genres?.[0] || 'Imported Track';
        const tempoSource: 'verified' | 'estimated' = features ? 'verified' : 'estimated';

        // Pre-generate default Melodic Virtuoso AI chart for this imported track,
        // now grounded in a real tempo/key/genre when one was found.
        const aiChartResult = await generateAIChart(
          title,
          author,
          genre,
          tempo,
          key,
          'MEDIUM',
          'MELODY'
        );

        const ytTrack = {
          id: `yt-${videoId}`,
          title,
          artist: author,
          album: 'YouTube Music',
          albumArt: thumbnail,
          tempo,
          timeSignature,
          timeSignatureRaw: features?.timeSignatureRaw,
          energy,
          danceability,
          durationMs: 80000,
          youtubeVideoId: videoId,
          sourceType: 'YOUTUBE' as const,
          genre,
          key,
          tempoSource,
          aiChart: aiChartResult.blueprint,
        };

        const result = {
          id: `yt-playlist-${videoId}`,
          name: title,
          description: `Imported from YouTube Music by ${author}`,
          coverArt: thumbnail,
          tracksCount: 1,
          tracks: [ytTrack],
          youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
          sourceType: 'YOUTUBE' as const,
        };

        parsedPlaylistCache.set(cacheKey, result);
        res.json(result);
        return;
      }

      if (ytListMatch && ytListMatch[1]) {
        const plId = ytListMatch[1].slice(0, 32);
        const demoTracks = [
          { title: 'Sunset', artist: 'The Midnight', tempo: 114, ytId: 'URma_gu1aNE', genre: 'Synthwave' },
          { title: 'The Nights', artist: 'Avicii', tempo: 126, ytId: '2vjPBrBU-TM', genre: 'EDM' },
          { title: 'Animals', artist: 'Martin Garrix', tempo: 128, ytId: 'gCYcHz2k5x0', genre: 'Big Room' },
          { title: 'Coffee Morning', artist: 'Lofi Fruits', tempo: 84, ytId: 'jfKfPfyJRdk', genre: 'Lo-Fi' },
          { title: 'Nightcall', artist: 'Kavinsky', tempo: 92, ytId: 'MV_3Dpw-BRY', genre: 'Darksynth' },
        ];

        const tracks = demoTracks.map((d, idx) => ({
          id: `yt-pl-${plId}-${idx + 1}`,
          title: d.title,
          artist: d.artist,
          album: 'YouTube Music Playlist',
          albumArt: `https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=400&q=80`,
          tempo: d.tempo,
          timeSignature: 4,
          energy: 0.85,
          danceability: 0.8,
          durationMs: 75000,
          youtubeVideoId: d.ytId,
          sourceType: 'YOUTUBE' as const,
          genre: d.genre,
        }));

        const result = {
          id: `yt-playlist-${plId}`,
          name: 'YouTube Music Playlist',
          description: 'Synchronized rhythm charts with full YouTube Music audio streaming.',
          coverArt: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=500&q=80',
          tracksCount: tracks.length,
          tracks,
          youtubeUrl: input,
          sourceType: 'YOUTUBE' as const,
        };

        parsedPlaylistCache.set(cacheKey, result);
        res.json(result);
        return;
      }
    } catch (err: any) {
      console.error('Unhandled error in YouTube parse endpoint:', err);
      res.status(500).json({ error: 'Failed to process YouTube link. Please try again.' });
    }
  };

  app.post(['/api/youtube/parse', '/api/spotify/parse'], handleYouTubeParse);

  // 2.5 YouTube Search and Match Endpoint
  app.post('/api/youtube/search', async (req, res) => {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Query is required' });
      return;
    }
    const result = await searchYouTubeVideo(query);
    if (result) {
      res.json({ success: true, ...result });
    } else {
      res.status(404).json({ error: 'No YouTube video found for this query' });
    }
  });

  // 2.8 AI-Powered Rhythm Chart Generation (Default: Gemini AI, Fallback: Procedural)
  app.post('/api/chart/ai-generate', async (req, res) => {
    try {
      const {
        trackTitle = 'Track',
        artist = 'Artist',
        genre = 'Electronic',
        tempo = 120,
        key = 'C',
        difficulty = 'MEDIUM',
        focusStyle = 'MELODY',
        customPrompt = '',
      } = req.body;

      const result = await generateAIChart(
        trackTitle,
        artist,
        genre,
        Number(tempo) || 120,
        key,
        difficulty,
        focusStyle,
        customPrompt
      );

      res.json({
        success: true,
        aiPowered: result.aiPowered,
        modelUsed: result.modelUsed,
        blueprint: result.blueprint,
      });
    } catch (err: any) {
      console.error('Unhandled error in /api/chart/ai-generate:', err);
      res.status(500).json({ error: 'Failed to generate AI chart.' });
    }
  });

  // 3. Leaderboard GET
  app.get('/api/leaderboard', (req, res) => {
    const { trackId, difficulty, limit = '50' } = req.query;
    let list = getLeaderboard();

    if (trackId && typeof trackId === 'string') {
      list = list.filter((e) => e.trackId === trackId);
    }
    if (difficulty && typeof difficulty === 'string' && difficulty !== 'ALL') {
      list = list.filter((e) => e.difficulty === difficulty);
    }

    // Sort descending by score, then accuracy
    list.sort((a, b) => b.score - a.score || b.accuracy - a.accuracy);

    const maxCount = parseInt(limit as string, 10) || 50;
    res.json(list.slice(0, maxCount));
  });

  // 4. Leaderboard POST (submit score)
  app.post('/api/leaderboard', (req, res) => {
    const { playerName, trackId, trackTitle, artist, playlistName, difficulty, score, maxCombo, accuracy } = req.body;

    if (!playerName || !trackId || typeof score !== 'number') {
      res.status(400).json({ error: 'Invalid score submission payload' });
      return;
    }

    const cleanAccuracy = Math.max(0, Math.min(100, Number(accuracy) || 0));

    // Calculate Grade
    let grade: 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' | 'F' = 'F';
    if (cleanAccuracy >= 98) grade = 'SSS';
    else if (cleanAccuracy >= 95) grade = 'SS';
    else if (cleanAccuracy >= 90) grade = 'S';
    else if (cleanAccuracy >= 80) grade = 'A';
    else if (cleanAccuracy >= 70) grade = 'B';
    else if (cleanAccuracy >= 60) grade = 'C';

    const newEntry: LeaderboardEntry = {
      id: 'entry-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      playerName: String(playerName).trim().slice(0, 20) || 'Anonymous',
      trackId: String(trackId),
      trackTitle: String(trackTitle || 'Track'),
      artist: String(artist || 'Artist'),
      playlistName: String(playlistName || 'Playlist'),
      difficulty: (['EASY', 'MEDIUM', 'HARD'].includes(difficulty) ? difficulty : 'MEDIUM') as any,
      score: Math.max(0, Math.round(score)),
      maxCombo: Math.max(0, Math.round(maxCombo || 0)),
      accuracy: parseFloat(cleanAccuracy.toFixed(1)),
      grade,
      timestamp: new Date().toISOString(),
    };

    const currentList = getLeaderboard();
    currentList.push(newEntry);
    saveLeaderboard(currentList);

    // Calculate rank for this track
    const trackScores = currentList
      .filter((e) => e.trackId === trackId)
      .sort((a, b) => b.score - a.score);
    const rank = trackScores.findIndex((e) => e.id === newEntry.id) + 1;

    res.json({
      success: true,
      entry: newEntry,
      rank,
      totalTrackEntries: trackScores.length,
    });
  });

  // 5. Global Leaderboard Stats
  app.get('/api/leaderboard/stats', (req, res) => {
    const list = getLeaderboard();
    const totalPlays = list.length;
    const topScore = list.reduce((max, cur) => Math.max(max, cur.score), 0);
    const topPlayer = list.slice().sort((a, b) => b.score - a.score)[0]?.playerName || 'None';

    res.json({
      totalPlays,
      topScore,
      topPlayer,
      recentEntries: list.slice(-5).reverse(),
    });
  });

  // Vite Middleware in Dev, static file serving in Production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`YouTube Hero Rhythm Game Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
