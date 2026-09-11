import React, { useEffect, useState } from 'react';
import { Trophy, X, Medal, Filter, Flame, RefreshCw, Music } from 'lucide-react';
import { GameDifficulty, LeaderboardEntry, Track } from '../types';

interface LeaderboardModalProps {
  currentTrack: Track | null;
  onClose: () => void;
  onPlayTrack?: (trackId: string) => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  currentTrack,
  onClose,
}) => {
  const [filterScope, setFilterScope] = useState<'ALL' | 'TRACK'>('ALL');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('ALL');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<{ totalPlays: number; topScore: number; topPlayer: string } | null>(null);

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterScope === 'TRACK' && currentTrack) {
        params.set('trackId', currentTrack.id);
      }
      if (difficultyFilter !== 'ALL') {
        params.set('difficulty', difficultyFilter);
      }

      const [listRes, statsRes] = await Promise.all([
        fetch(`/api/leaderboard?${params.toString()}`),
        fetch('/api/leaderboard/stats'),
      ]);

      if (listRes.ok) {
        const data = await listRes.json();
        setEntries(data);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [filterScope, difficultyFilter, currentTrack]);

  const getRankBadge = (index: number) => {
    if (index === 0) {
      return (
        <span className="w-7 h-7 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/50 flex items-center justify-center font-bold text-xs shadow-sm">
          <Medal className="w-4 h-4 fill-current" />
        </span>
      );
    }
    if (index === 1) {
      return (
        <span className="w-7 h-7 rounded-lg bg-zinc-300/20 text-zinc-200 border border-zinc-300/50 flex items-center justify-center font-bold text-xs shadow-sm">
          <Medal className="w-4 h-4 fill-current" />
        </span>
      );
    }
    if (index === 2) {
      return (
        <span className="w-7 h-7 rounded-lg bg-amber-700/20 text-amber-500 border border-amber-700/50 flex items-center justify-center font-bold text-xs shadow-sm">
          <Medal className="w-4 h-4 fill-current" />
        </span>
      );
    }
    return (
      <span className="w-7 h-7 rounded-lg bg-zinc-800/80 text-zinc-400 flex items-center justify-center font-mono font-bold text-xs">
        {index + 1}
      </span>
    );
  };

  const getGradePill = (grade: string) => {
    const styles: Record<string, string> = {
      SSS: 'bg-amber-400/10 text-amber-300 border-amber-400/30',
      SS: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30',
      S: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30',
      A: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/30',
      B: 'bg-blue-400/10 text-blue-300 border-blue-400/30',
      C: 'bg-amber-400/10 text-amber-400 border-amber-400/30',
      F: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-black border font-mono ${styles[grade] || ''}`}>
        {grade}
      </span>
    );
  };

  const formatTimeAgo = (iso: string) => {
    const ms = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center shadow-md">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-black text-xl text-white">
                Global Rhythm Leaderboard
              </h2>
              <p className="text-xs text-zinc-400">
                Live rankings across all YouTube Hero tracks & rhythm difficulties
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLeaderboard}
              disabled={isLoading}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              title="Refresh Leaderboard"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              id="btn-close-leaderboard"
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Summary Stats Bar */}
        {stats && (
          <div className="grid grid-cols-3 gap-3 px-6 py-3 bg-zinc-950/60 border-b border-zinc-800/80 text-center">
            <div>
              <span className="text-[10px] uppercase font-mono text-zinc-500 font-bold">Total Matches</span>
              <p className="font-display font-black text-base text-zinc-200">{stats.totalPlays}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono text-zinc-500 font-bold">High Score</span>
              <p className="font-display font-black text-base text-amber-400">{stats.topScore.toLocaleString()}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono text-zinc-500 font-bold">Current #1</span>
              <p className="font-display font-black text-base text-emerald-400 truncate">{stats.topPlayer}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="px-6 py-3 border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 bg-zinc-900/50">
          {/* Scope filter */}
          <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            <button
              id="btn-filter-all-tracks"
              onClick={() => setFilterScope('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                filterScope === 'ALL'
                  ? 'bg-emerald-500 text-zinc-950 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              All Tracks
            </button>
            {currentTrack && (
              <button
                id="btn-filter-current-track"
                onClick={() => setFilterScope('TRACK')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition truncate max-w-[200px] ${
                  filterScope === 'TRACK'
                    ? 'bg-emerald-500 text-zinc-950 shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Current: {currentTrack.title}
              </button>
            )}
          </div>

          {/* Difficulty filter */}
          <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            {['ALL', 'EASY', 'MEDIUM', 'HARD'].map((diff) => (
              <button
                key={diff}
                onClick={() => setDifficultyFilter(diff)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  difficultyFilter === diff
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {diff}
              </button>
            ))}
          </div>
        </div>

        {/* Scores Table */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="py-20 text-center text-zinc-500 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-400" />
              <p className="text-xs">Fetching verified global scores...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="py-20 text-center text-zinc-500 space-y-2">
              <Trophy className="w-8 h-8 mx-auto text-zinc-600" />
              <p className="text-sm font-semibold text-zinc-400">No high scores found for this filter.</p>
              <p className="text-xs text-zinc-500">Be the first to set a new record!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry, idx) => (
                <div
                  key={entry.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border transition gap-3 ${
                    idx === 0
                      ? 'border-amber-400/40 bg-amber-500/5'
                      : idx === 1
                      ? 'border-zinc-500/40 bg-zinc-800/20'
                      : idx === 2
                      ? 'border-amber-700/40 bg-amber-900/10'
                      : 'border-zinc-800/80 bg-zinc-950/40 hover:bg-zinc-900/60'
                  }`}
                >
                  {/* Rank & Player & Song */}
                  <div className="flex items-center gap-3 min-w-0">
                    {getRankBadge(idx)}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-sm text-zinc-100 truncate">
                          {entry.playerName}
                        </span>
                        <span className="text-[10px] uppercase font-mono font-bold px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">
                          {entry.difficulty}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400 truncate flex items-center gap-1.5">
                        <Music className="w-3 h-3 text-zinc-500" />
                        <span>{entry.trackTitle}</span>
                        <span className="text-zinc-600">•</span>
                        <span className="text-zinc-500">{entry.artist}</span>
                      </div>
                    </div>
                  </div>

                  {/* Score, Combo, Accuracy & Grade */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 ml-10 sm:ml-0">
                    <div className="text-right">
                      <div className="font-display font-black text-base sm:text-lg text-white font-mono">
                        {entry.score.toLocaleString()}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
                        <span className="text-emerald-400 font-bold">{entry.accuracy}%</span>
                        <span className="text-zinc-600">•</span>
                        <span className="text-amber-400 flex items-center gap-0.5">
                          <Flame className="w-2.5 h-2.5 fill-current" /> {entry.maxCombo}x
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {getGradePill(entry.grade)}
                      <span className="text-[10px] text-zinc-500 font-mono hidden md:inline w-14 text-right">
                        {formatTimeAgo(entry.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
