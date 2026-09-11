export type GameDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type HitJudgment = 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumArt: string;
  tempo: number; // BPM
  timeSignature: number;
  energy: number; // 0 to 1
  danceability: number; // 0 to 1
  durationMs: number;
  previewUrl?: string | null;
  youtubeVideoId?: string;
  sourceType?: 'YOUTUBE' | 'SYNTH';
  key?: string;
  genre?: string;
  beatOffset?: number; // offset in seconds to the first drum downbeat
  aiChart?: AIChartBlueprint;
}

export interface AIMelodicStep {
  beat: number; // 0.0 to 3.99 relative to measure start
  lane: number; // 0, 1, 2, 3
  accent?: boolean;
}

export interface AISectionPhrase {
  section: 'INTRO' | 'VERSE' | 'BUILD' | 'CHORUS' | 'SOLO';
  measures: AIMelodicStep[][]; // exactly 4 measures per phrase
}

export interface AIChartBlueprint {
  styleName: string;
  musicalSummary: string;
  suggestedDensity: 'LIGHT' | 'MODERATE' | 'DENSE';
  sectionMotifs: AISectionPhrase[];
  generatedAt?: string;
  focusStyle?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  coverArt: string;
  tracksCount: number;
  tracks: Track[];
  youtubeUrl?: string;
  sourceType?: 'YOUTUBE';
  curated?: boolean;
}

export interface Note {
  id: number;
  lane: number; // 0, 1, 2, 3
  time: number; // in seconds from song start
  duration?: number; // for hold notes (future/optional)
  hit?: boolean;
  missed?: boolean;
  judgment?: HitJudgment;
}

export interface ScoreState {
  score: number;
  combo: number;
  maxCombo: number;
  perfects: number;
  greats: number;
  goods: number;
  misses: number;
  accuracy: number;
  health: number; // 0 to 100
  grade: 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' | 'F';
}

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  trackId: string;
  trackTitle: string;
  artist: string;
  playlistName: string;
  difficulty: GameDifficulty;
  score: number;
  maxCombo: number;
  accuracy: number;
  grade: 'SSS' | 'SS' | 'S' | 'A' | 'B' | 'C' | 'F';
  timestamp: string;
}

export interface KeyBindings {
  lane0: string; // e.g. "KeyD"
  lane1: string; // e.g. "KeyF"
  lane2: string; // e.g. "KeyJ"
  lane3: string; // e.g. "KeyK"
  laneLabels: [string, string, string, string]; // e.g. ["D", "F", "J", "K"]
}

export interface GameSettings {
  scrollSpeed: number; // 1.0 to 3.0
  audioOffsetMs: number; // -150 to +150 ms
  musicVolume: number; // 0.0 to 1.0
  sfxVolume: number; // 0.0 to 1.0
  keyBindings: KeyBindings;
  perspective3D: boolean;
}
