import React, { useState } from 'react';
import { Play, Sparkles, Flame, Gauge, Link2, Music2, ExternalLink, Loader2, Trophy, Clock, Zap, Radio, Bot, CheckCircle2 } from 'lucide-react';
import { AIChartBlueprint, GameDifficulty, Playlist, Track } from '../types';
import { AIChartModal } from './AIChartModal';

interface PlaylistSelectorProps {
  playlists: Playlist[];
  selectedPlaylist: Playlist | null;
  selectedTrack: Track | null;
  difficulty: GameDifficulty;
  onSelectPlaylist: (playlist: Playlist) => void;
  onSelectTrack: (track: Track) => void;
  onSelectDifficulty: (diff: GameDifficulty) => void;
  onStartGame: () => void;
  onOpenLeaderboardForTrack: (trackId: string) => void;
  onImportPlaylist: (urlOrId: string) => Promise<{ success: boolean; error?: string } | boolean>;
  isImporting: boolean;
  onApplyAIChart?: (blueprint: AIChartBlueprint) => void;
  onRemoveAIChart?: () => void;
}

export const PlaylistSelector: React.FC<PlaylistSelectorProps> = ({
  playlists,
  selectedPlaylist,
  selectedTrack,
  difficulty,
  onSelectPlaylist,
  onSelectTrack,
  onSelectDifficulty,
  onStartGame,
  onOpenLeaderboardForTrack,
  onImportPlaylist,
  isImporting,
  onApplyAIChart,
  onRemoveAIChart,
}) => {
  const [customInput, setCustomInput] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [isAIModalOpen, setIsAIModalOpen] = useState<boolean>(false);

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customInput.trim();
    if (!trimmed || isImporting) return;
    setImportError(null);

    // Explicitly reject Spotify links
    if (/spotify\.com|spotify:/i.test(trimmed)) {
      setImportError('Spotify links are not supported. Please paste a YouTube or YouTube Music link.');
      return;
    }

    // Validate YouTube URL / video ID
    const isYt =
      /^(https?:\/\/)?(www\.|music\.|m\.)?(youtube\.com|youtu\.be)\//i.test(trimmed) ||
      /^[a-zA-Z0-9_-]{11}$/.test(trimmed);

    if (!isYt) {
      setImportError('Please enter a valid YouTube or YouTube Music link (e.g., https://music.youtube.com/watch?v=... or https://youtu.be/...).');
      return;
    }

    const res = await onImportPlaylist(trimmed);
    if (typeof res === 'object' && res !== null) {
      if (res.success) {
        setCustomInput('');
      } else {
        setImportError(res.error || 'Could not analyze this YouTube link. Please check the URL.');
      }
    } else if (res) {
      setCustomInput('');
    } else {
      setImportError('Could not analyze this YouTube link. Please check the URL.');
    }
  };

  const handleQuickSample = (sample: string) => {
    setCustomInput(sample);
  };

  const formatDuration = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTempoBadgeColor = (bpm: number) => {
    if (bpm < 100) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    if (bpm <= 130) return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    if (bpm <= 155) return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Hero / Import & Search Bar */}
      <div className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900/95 via-zinc-900/80 to-zinc-950 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* YouTube Red ambient glow */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-64 h-64 bg-red-800/5 rounded-full blur-2xl pointer-events-none" />

        <div className="max-w-3xl space-y-4 relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold">
              <Play className="w-3 h-3 fill-current" />
              YouTube Hero Rhythm Engine
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Default: Melodic Virtuoso AI Charting
            </div>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Play Any Song on <span className="text-red-500">YouTube Hero</span>
          </h1>

          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
            Every track streams high-definition audio & video powered by <strong>YouTube Music</strong> with AI-powered Melodic Virtuoso rhythm charts generated automatically by default.
          </p>

          {/* Import input box */}
          <form onSubmit={handleImportSubmit} className="pt-2 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Link2 className="w-5 h-5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="input-youtube-url"
                type="text"
                placeholder="Paste YouTube or YouTube Music link (e.g. https://music.youtube.com/watch?v=...)"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-zinc-900/90 border border-zinc-700/80 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
              />
            </div>
            <button
              id="btn-analyze-youtube"
              type="submit"
              disabled={isImporting || !customInput.trim()}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:hover:bg-red-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-red-600/20 active:scale-[0.98]"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating AI Chart...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 fill-current text-amber-300" />
                  Generate AI Chart & Play
                </>
              )}
            </button>
          </form>

          {/* Quick sample chips */}
          <div className="flex items-center gap-2 flex-wrap text-xs text-zinc-400 pt-1">
            <span className="text-zinc-500 text-[11px]">Quick samples:</span>
            {[
              { label: 'Sunset (The Midnight)', query: 'https://www.youtube.com/watch?v=URma_gu1aNE' },
              { label: 'The Nights (Avicii)', query: 'https://www.youtube.com/watch?v=UtF6Jej8yb4' },
              { label: 'Animals (Martin Garrix)', query: 'https://www.youtube.com/watch?v=gCYcHz2k5x0' },
            ].map((sample) => (
              <button
                key={sample.label}
                type="button"
                onClick={() => handleQuickSample(sample.query)}
                className="px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 hover:text-zinc-200 border border-zinc-700/60 text-[11px] transition text-zinc-300"
              >
                {sample.label}
              </button>
            ))}
          </div>

          {importError && (
            <p className="text-xs text-rose-400 font-medium">{importError}</p>
          )}
        </div>
      </div>

      {/* Curated Playlists Carousel / Tabs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Music2 className="w-5 h-5 text-red-500" />
            Curated Playlists & Genres
          </h2>
          <span className="text-xs text-zinc-500">
            {playlists.length} available collections
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {playlists.map((playlist) => {
            const isSelected = selectedPlaylist?.id === playlist.id;
            return (
              <div
                key={playlist.id}
                id={`card-playlist-${playlist.id}`}
                onClick={() => onSelectPlaylist(playlist)}
                className={`group cursor-pointer rounded-xl border p-4 transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? 'border-red-500/80 bg-zinc-900/95 ring-1 ring-red-500/50 shadow-lg shadow-red-500/10'
                    : 'border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70'
                }`}
              >
                <div>
                  <div className="aspect-video w-full rounded-lg overflow-hidden relative mb-3 bg-zinc-800">
                    <img
                      src={playlist.coverArt}
                      alt={playlist.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent" />
                    <span className="absolute bottom-2 left-2 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-zinc-900/80 text-zinc-300 border border-zinc-700">
                      {playlist.tracksCount} Tracks
                    </span>
                    {isSelected && (
                      <span className="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-600 text-white shadow-sm shadow-red-600/40">
                        Active
                      </span>
                    )}
                  </div>

                  <h3 className="font-display font-bold text-sm text-zinc-100 line-clamp-1 group-hover:text-red-400 transition">
                    {playlist.name}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                    {playlist.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
                  <span className="flex items-center gap-1 font-mono">
                    <Gauge className="w-3.5 h-3.5 text-zinc-400" />
                    BPM: {Math.min(...playlist.tracks.map((t) => t.tempo))}-{Math.max(...playlist.tracks.map((t) => t.tempo))}
                  </span>
                  {playlist.youtubeUrl && (
                    <a
                      href={playlist.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-zinc-500 hover:text-red-400 transition"
                      title="Watch on YouTube"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Playlist & Track Selection List */}
      {selectedPlaylist && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono uppercase text-red-400 font-bold tracking-wider">
                  Select Track to Play
                </span>
                <span className="text-zinc-500">•</span>
                <span className="text-xs text-zinc-400 font-medium">
                  {selectedPlaylist.name}
                </span>
              </div>
              <h3 className="font-display text-2xl font-bold text-zinc-100 mt-1">
                Choose Song & Challenge
              </h3>
            </div>

            {/* Actions: AI Chart Studio & Difficulty Pill Selector */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                id="btn-open-ai-chart-studio"
                onClick={() => setIsAIModalOpen(true)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition ${
                  selectedTrack?.aiChart
                    ? 'bg-gradient-to-r from-amber-500/25 via-orange-500/20 to-red-500/20 text-amber-300 border-amber-500/50 shadow-lg shadow-amber-500/10'
                    : 'bg-zinc-950 hover:bg-zinc-800 text-zinc-300 hover:text-white border-zinc-800 hover:border-zinc-700'
                }`}
                title="Compose custom rhythm chart with Gemini 3.8 Flash"
              >
                <Sparkles className={`w-4 h-4 ${selectedTrack?.aiChart ? 'text-amber-400 fill-amber-400' : 'text-amber-400'}`} />
                {selectedTrack?.aiChart ? (
                  <span className="flex items-center gap-1.5">
                    <span className="hidden sm:inline text-zinc-400">AI:</span>
                    <span className="text-amber-200 font-black">{selectedTrack.aiChart.styleName}</span>
                  </span>
                ) : (
                  <span>AI Chart Studio</span>
                )}
              </button>

              {/* Difficulty Pill Selector */}
              <div className="flex items-center gap-2 bg-zinc-950 p-1.5 rounded-xl border border-zinc-800">
                <span className="text-xs font-bold text-zinc-400 px-2 hidden sm:inline">Difficulty:</span>
                {(['EASY', 'MEDIUM', 'HARD'] as GameDifficulty[]).map((d) => {
                  const isActive = difficulty === d;
                  const colors = {
                    EASY: isActive ? 'bg-emerald-500 text-zinc-950 font-black' : 'text-zinc-400 hover:text-white',
                    MEDIUM: isActive ? 'bg-amber-500 text-zinc-950 font-black' : 'text-zinc-400 hover:text-white',
                    HARD: isActive ? 'bg-red-600 text-white font-black shadow-md shadow-red-600/30' : 'text-zinc-400 hover:text-white',
                  };
                  return (
                    <button
                      key={d}
                      id={`btn-diff-${d.toLowerCase()}`}
                      onClick={() => onSelectDifficulty(d)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${colors[d]}`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tracks list */}
          <div className="space-y-2">
            {selectedPlaylist.tracks.map((track, idx) => {
              const isTrackSelected = selectedTrack?.id === track.id;
              return (
                <div
                  key={track.id}
                  id={`track-item-${track.id}`}
                  onClick={() => onSelectTrack(track)}
                  className={`group flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer gap-3 ${
                    isTrackSelected
                      ? 'border-red-500/80 bg-zinc-900/90 shadow-md ring-1 ring-red-500/40'
                      : 'border-zinc-800/80 bg-zinc-900/20 hover:border-zinc-700 hover:bg-zinc-900/50'
                  }`}
                >
                  {/* Left: Artwork, Title, Artist */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono font-bold text-zinc-500 w-5 text-right">
                      {(idx + 1).toString().padStart(2, '0')}
                    </span>
                    <img
                      src={track.albumArt}
                      alt={track.title}
                      className="w-12 h-12 rounded-lg object-cover bg-zinc-800 flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-display font-bold text-sm text-zinc-100 truncate group-hover:text-red-400 transition">
                          {track.title}
                        </h4>
                        {track.youtubeVideoId && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                            <Play className="w-2.5 h-2.5 fill-current" /> YouTube Music
                          </span>
                        )}
                        {track.aiChart && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectTrack(track);
                              setIsAIModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition cursor-pointer"
                            title="Click to view or edit AI Chart"
                          >
                            <Sparkles className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                            AI Chart
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 truncate">
                        {track.artist} • <span className="text-zinc-500">{track.album}</span>
                      </p>
                    </div>
                  </div>

                  {/* Middle: Audio Metrics (BPM, Energy, Duration) */}
                  <div className="flex items-center gap-3 sm:gap-4 ml-8 sm:ml-0 flex-wrap">
                    <span
                      className={`px-2.5 py-1 rounded-md border font-mono text-xs font-bold inline-flex items-center gap-1 ${getTempoBadgeColor(
                        track.tempo
                      )}`}
                      title={
                        track.tempoSource === 'verified'
                          ? 'Real tempo, matched via GetSongBPM.com'
                          : 'Estimated tempo (no verified match found for this track)'
                      }
                    >
                      {track.tempo} BPM
                      {track.tempoSource === 'verified' ? (
                        <CheckCircle2 className="w-3 h-3 opacity-80" />
                      ) : track.tempoSource === 'estimated' ? (
                        <span className="opacity-60">~</span>
                      ) : null}
                    </span>

                    <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono" title="Energy Level">
                      <Flame className="w-3.5 h-3.5 text-red-500" />
                      <div className="w-14 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-500 rounded-full"
                          style={{ width: `${Math.round(track.energy * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-zinc-400">{Math.round(track.energy * 100)}%</span>
                    </div>

                    <span className="text-xs text-zinc-400 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      {formatDuration(track.durationMs)}
                    </span>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      id={`btn-track-leaderboard-${track.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenLeaderboardForTrack(track.id);
                      }}
                      className="p-2 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition"
                      title="View High Scores for this track"
                    >
                      <Trophy className="w-4 h-4" />
                    </button>

                    <button
                      id={`btn-play-track-${track.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTrack(track);
                        onStartGame();
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                        isTrackSelected
                          ? 'bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-600/30'
                          : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                      }`}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Play
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-center text-[10px] text-zinc-600 mt-4">
            Verified tempo &amp; key data via{' '}
            <a
              href="https://getsongbpm.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-zinc-400 underline"
            >
              GetSongBPM.com
            </a>
          </p>
        </div>
      )}

      {/* AI Chart Studio Modal */}
      {selectedTrack && (
        <AIChartModal
          isOpen={isAIModalOpen}
          onClose={() => setIsAIModalOpen(false)}
          track={selectedTrack}
          difficulty={difficulty}
          onApplyAIChart={(blueprint) => onApplyAIChart?.(blueprint)}
          onRemoveAIChart={() => onRemoveAIChart?.()}
          onStartWithAIChart={(blueprint) => {
            onApplyAIChart?.(blueprint);
            onStartGame();
          }}
        />
      )}
    </div>
  );
};
