import React, { useState, useEffect } from 'react';
import { CURATED_PLAYLISTS } from './data/curatedPlaylists';
import { AIChartBlueprint, GameDifficulty, GameSettings, Playlist, ScoreState, Track } from './types';
import { Navbar } from './components/Navbar';
import { PlaylistSelector } from './components/PlaylistSelector';
import { RhythmGame } from './components/RhythmGame';
import { ResultsModal } from './components/ResultsModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { SettingsModal } from './components/SettingsModal';
import { audioEngine } from './utils/audioEngine';

const DEFAULT_SETTINGS: GameSettings = {
  scrollSpeed: 1.8,
  audioOffsetMs: 0,
  musicVolume: 0.85,
  sfxVolume: 0.25, // Unobtrusive, comfortable hit sound confirmation level
  perspective3D: false,
  keyBindings: {
    lane0: 'KeyD',
    lane1: 'KeyF',
    lane2: 'KeyJ',
    lane3: 'KeyK',
    laneLabels: ['D', 'F', 'J', 'K'],
  },
};

export default function App() {
  const [playlists, setPlaylists] = useState<Playlist[]>(CURATED_PLAYLISTS);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist>(CURATED_PLAYLISTS[0]);
  const [selectedTrack, setSelectedTrack] = useState<Track>(CURATED_PLAYLISTS[0].tracks[0]);
  const [difficulty, setDifficulty] = useState<GameDifficulty>('MEDIUM');

  // Game flow states
  const [gameState, setGameState] = useState<'SELECTOR' | 'PLAYING' | 'RESULTS'>('SELECTOR');
  const [lastScore, setLastScore] = useState<ScoreState | null>(null);

  // Modals
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Settings & Audio
  const [settings, setSettings] = useState<GameSettings>(() => {
    try {
      const saved = localStorage.getItem('youtube_hero_settings') || localStorage.getItem('beatify_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        // If old loud default 0.9 or 0.35 was stored, gracefully migrate down to 0.25
        if (parsed.sfxVolume === undefined || parsed.sfxVolume > 0.3) {
          parsed.sfxVolume = 0.25;
        }
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (e) {
      // ignore
    }
    return DEFAULT_SETTINGS;
  });

  const [isMuted, setIsMuted] = useState(false);

  // Save settings when changed
  const handleUpdateSettings = (newSettings: GameSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem('youtube_hero_settings', JSON.stringify(newSettings));
    } catch (e) {
      // ignore
    }
  };

  const handleToggleMute = () => {
    if (isMuted) {
      audioEngine.setVolumes(settings.musicVolume, settings.sfxVolume);
      setIsMuted(false);
    } else {
      audioEngine.setVolumes(0, 0);
      setIsMuted(true);
    }
  };

  // Fetch initial playlists from server API
  useEffect(() => {
    fetch('/api/playlists/curated')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data) && data.length > 0) {
          setPlaylists(data);
          setSelectedPlaylist(data[0]);
          setSelectedTrack(data[0].tracks[0]);
        }
      })
      .catch((err) => console.log('Using local curated playlists fallback:', err));
  }, []);

  // Import YouTube / YouTube Music playlist or track with strict validation
  const handleImportPlaylist = async (urlOrId: string): Promise<{ success: boolean; error?: string }> => {
    setIsImporting(true);
    const trimmed = urlOrId.trim();

    try {
      // 1. Explicitly disallow Spotify links
      if (/spotify\.com|spotify:/i.test(trimmed)) {
        return {
          success: false,
          error: 'Spotify links are not supported. Please paste a YouTube or YouTube Music link.',
        };
      }

      // 2. Validate that it is a YouTube link or video ID
      const isYtUrl =
        /^(https?:\/\/)?(www\.|music\.|m\.)?(youtube\.com|youtu\.be)\//i.test(trimmed) ||
        /^[a-zA-Z0-9_-]{11}$/.test(trimmed);

      if (!isYtUrl) {
        return {
          success: false,
          error: 'Please enter a valid YouTube or YouTube Music link (e.g., https://music.youtube.com/watch?v=... or https://youtu.be/...).',
        };
      }

      // 3. Call the server parse endpoint (which attaches default Melodic Virtuoso AI chart)
      try {
        const res = await fetch('/api/youtube/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urlOrId: trimmed }),
          // This endpoint now does real work (oEmbed fetch + a GetSongBPM
          // lookup), each with their own short internal timeouts, but no
          // LLM call — 15s is a comfortable margin above their worst case.
          signal: AbortSignal.timeout(15000),
        });

        if (res.ok) {
          const imported: Playlist = await res.json();
          if (imported && imported.tracks && imported.tracks.length > 0) {
            // Ensure first track has AI chart attached (default: MELODY).
            // This is a separate request from the parse above, on purpose —
            // it's the slow one (real LLM call), so it must never be allowed
            // to block or time out the fast metadata response.
            if (!imported.tracks[0].aiChart) {
              try {
                const chartRes = await fetch('/api/chart/ai-generate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    trackTitle: imported.tracks[0].title,
                    artist: imported.tracks[0].artist,
                    genre: imported.tracks[0].genre || 'Electronic',
                    tempo: imported.tracks[0].tempo,
                    key: imported.tracks[0].key || 'C',
                    timeSignature: imported.tracks[0].timeSignature || 4,
                    danceability: imported.tracks[0].danceability,
                    difficulty,
                    focusStyle: 'MELODY',
                  }),
                  // Bounded so a slow/unresponsive Gemini call can't hang the
                  // import flow indefinitely — the game is fully playable on
                  // the procedural/curated fallback chart if this times out.
                  signal: AbortSignal.timeout(25000),
                });
                if (chartRes.ok) {
                  const chartData = await chartRes.json();
                  if (chartData.blueprint) {
                    imported.tracks[0].aiChart = chartData.blueprint;
                  }
                }
              } catch (chartErr) {
                console.warn('Auto AI chart generation fell back to procedural:', chartErr);
              }
            }

            setPlaylists((prev) => {
              const filtered = prev.filter((p) => p.id !== imported.id);
              return [imported, ...filtered];
            });
            setSelectedPlaylist(imported);
            setSelectedTrack(imported.tracks[0]);
            return { success: true };
          }
        } else {
          const errData = await res.json().catch(() => null);
          if (errData?.error) {
            return { success: false, error: errData.error };
          }
        }
      } catch (err) {
        console.warn('Server parse temporarily unavailable, utilizing client-side parser:', err);
      }

      // Client-side fallback for verified YouTube formats
      const ytMatch = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/)|music\.youtube\.com\/watch\?v=|^)([a-zA-Z0-9_-]{11})(?:$|[?&])/);
      if (!ytMatch || !ytMatch[1]) {
        return {
          success: false,
          error: 'Could not resolve YouTube video ID. Please check the URL format.',
        };
      }

      const videoId = ytMatch[1];
      const fallbackTrack: Track = {
        id: `yt-track-${videoId}`,
        title: 'YouTube Track',
        artist: 'YouTube Music',
        album: 'Imported Selection',
        albumArt: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        tempo: 124,
        timeSignature: 4,
        energy: 0.85,
        danceability: 0.8,
        durationMs: 80000,
        youtubeVideoId: videoId,
        sourceType: 'YOUTUBE',
        genre: 'Electronic',
      };

      // Generate default Melodic Virtuoso AI chart for fallback track
      try {
        const chartRes = await fetch('/api/chart/ai-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trackTitle: fallbackTrack.title,
            artist: fallbackTrack.artist,
            genre: 'Electronic',
            tempo: fallbackTrack.tempo,
            key: 'C',
            difficulty,
            focusStyle: 'MELODY',
          }),
        });
        if (chartRes.ok) {
          const chartData = await chartRes.json();
          if (chartData.blueprint) {
            fallbackTrack.aiChart = chartData.blueprint;
          }
        }
      } catch (err) {
        console.warn('Fallback track AI generation error:', err);
      }

      const fallbackPlaylist: Playlist = {
        id: `yt-pl-${videoId}`,
        name: 'YouTube Music Track',
        description: 'Auto-analyzed tempo and melody-driven charts streamed via YouTube Music.',
        coverArt: fallbackTrack.albumArt,
        tracksCount: 1,
        tracks: [fallbackTrack],
        youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
        sourceType: 'YOUTUBE',
      };

      setPlaylists((prev) => [fallbackPlaylist, ...prev.filter((p) => p.id !== fallbackPlaylist.id)]);
      setSelectedPlaylist(fallbackPlaylist);
      setSelectedTrack(fallbackPlaylist.tracks[0]);
      return { success: true };
    } catch (fallbackErr: any) {
      console.error('Import failed:', fallbackErr);
      return {
        success: false,
        error: 'Failed to analyze YouTube link. Please check your internet connection and URL.',
      };
    } finally {
      setIsImporting(false);
    }
  };

  // Game state transitions
  const handleStartGame = async () => {
    audioEngine.init();

    // Default to AI chart generation if track doesn't have one yet
    if (selectedTrack && !selectedTrack.aiChart) {
      try {
        const res = await fetch('/api/chart/ai-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trackTitle: selectedTrack.title,
            artist: selectedTrack.artist,
            genre: selectedTrack.genre || 'Electronic',
            tempo: selectedTrack.tempo,
            key: selectedTrack.key || 'C',
            difficulty,
            focusStyle: 'MELODY',
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.blueprint) {
            handleApplyAIChart(data.blueprint);
          }
        }
      } catch (err) {
        console.warn('AI chart auto-generation fell back to procedural:', err);
      }
    }

    setGameState('PLAYING');
  };

  const handleFinishGame = (finalScore: ScoreState) => {
    setLastScore(finalScore);
    setGameState('RESULTS');
  };

  const handleQuitGame = () => {
    audioEngine.stopTrack();
    setGameState('SELECTOR');
  };

  const handlePlayAgain = () => {
    setGameState('PLAYING');
  };

  const handleOpenLeaderboardForTrack = (trackId: string) => {
    const track = selectedPlaylist?.tracks.find((t) => t.id === trackId);
    if (track) setSelectedTrack(track);
    setShowLeaderboard(true);
  };

  const handleApplyAIChart = (blueprint: AIChartBlueprint) => {
    if (!selectedTrack) return;
    const updated = { ...selectedTrack, aiChart: blueprint };
    setSelectedTrack(updated);
    if (selectedPlaylist) {
      const updatedTracks = selectedPlaylist.tracks.map((t) => (t.id === updated.id ? updated : t));
      setSelectedPlaylist({ ...selectedPlaylist, tracks: updatedTracks });
    }
  };

  const handleRemoveAIChart = () => {
    if (!selectedTrack) return;
    const { aiChart, ...rest } = selectedTrack;
    const updated = rest as Track;
    setSelectedTrack(updated);
    if (selectedPlaylist) {
      const updatedTracks = selectedPlaylist.tracks.map((t) => (t.id === selectedTrack.id ? updated : t));
      setSelectedPlaylist({ ...selectedPlaylist, tracks: updatedTracks });
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Persistent Navigation Bar */}
      <Navbar
        currentTrack={selectedTrack}
        isPlaying={gameState === 'PLAYING'}
        onOpenLeaderboard={() => setShowLeaderboard(true)}
        onOpenSettings={() => setShowSettings(true)}
        onOpenPlaylistSelector={() => setGameState('SELECTOR')}
        onStartGame={handleStartGame}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        {gameState === 'SELECTOR' && (
          <PlaylistSelector
            playlists={playlists}
            selectedPlaylist={selectedPlaylist}
            selectedTrack={selectedTrack}
            difficulty={difficulty}
            onSelectPlaylist={(p) => {
              setSelectedPlaylist(p);
              if (p.tracks.length > 0) setSelectedTrack(p.tracks[0]);
            }}
            onSelectTrack={(t) => setSelectedTrack(t)}
            onSelectDifficulty={(d) => setDifficulty(d)}
            onStartGame={handleStartGame}
            onOpenLeaderboardForTrack={handleOpenLeaderboardForTrack}
            onImportPlaylist={handleImportPlaylist}
            isImporting={isImporting}
            onApplyAIChart={handleApplyAIChart}
            onRemoveAIChart={handleRemoveAIChart}
          />
        )}

        {gameState === 'PLAYING' && selectedTrack && (
          <RhythmGame
            track={selectedTrack}
            difficulty={difficulty}
            settings={settings}
            onUpdateSettings={setSettings}
            onFinishGame={handleFinishGame}
            onQuitGame={handleQuitGame}
          />
        )}
      </main>

      {/* Results Modal */}
      {gameState === 'RESULTS' && lastScore && selectedTrack && (
        <ResultsModal
          track={selectedTrack}
          difficulty={difficulty}
          score={lastScore}
          onPlayAgain={handlePlayAgain}
          onBackToTracks={() => setGameState('SELECTOR')}
          onViewLeaderboard={() => setShowLeaderboard(true)}
          onSwitchAIChartStyle={handleApplyAIChart}
        />
      )}

      {/* Global Leaderboard Modal */}
      {showLeaderboard && (
        <LeaderboardModal
          currentTrack={selectedTrack}
          onClose={() => setShowLeaderboard(false)}
        />
      )}

      {/* Settings & Calibration Modal */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
