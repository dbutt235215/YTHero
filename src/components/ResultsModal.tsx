import React, { useState } from 'react';
import {
  Trophy,
  RotateCcw,
  ArrowRight,
  Share2,
  Check,
  Send,
  Flame,
  Sparkles,
  Music,
  Zap,
  Disc,
  Loader2,
} from 'lucide-react';
import { AIChartBlueprint, GameDifficulty, ScoreState, Track } from '../types';

interface ResultsModalProps {
  track: Track;
  difficulty: GameDifficulty;
  score: ScoreState;
  onPlayAgain: () => void;
  onBackToTracks: () => void;
  onViewLeaderboard: () => void;
  onSwitchAIChartStyle?: (blueprint: AIChartBlueprint) => void;
}

const AI_STYLES = [
  {
    id: 'MELODY' as const,
    name: 'Melodic Virtuoso',
    subtitle: 'Lead Vocals & Saxophone Hooks',
    desc: 'Tracks lead vocals, saxophone solos, and melodic hooks across higher lanes.',
    icon: Music,
    iconColor: 'text-emerald-400',
  },
  {
    id: 'RIFFS' as const,
    name: 'Syncopated Riffs',
    subtitle: 'Guitar Chops & Funk Accents',
    desc: 'Focuses on rhythm guitar riffs, synth arpeggios, and off-beat accents.',
    icon: Zap,
    iconColor: 'text-amber-400',
  },
  {
    id: 'SOLO' as const,
    name: 'Technical Shred',
    subtitle: 'Fast Runs & Trills',
    desc: 'High-density scalar sweeps across 4 lanes with rapid trills between lanes 2 and 3.',
    icon: Flame,
    iconColor: 'text-rose-400',
  },
  {
    id: 'BASS_DROP' as const,
    name: 'Sub-Bass & Impact Drop',
    subtitle: 'Deep Basslines & Chorus Drops',
    desc: 'Deep Lane 0 bass grooves with explosive dual-lane chorus accents.',
    icon: Disc,
    iconColor: 'text-cyan-400',
  },
];

export const ResultsModal: React.FC<ResultsModalProps> = ({
  track,
  difficulty,
  score,
  onPlayAgain,
  onBackToTracks,
  onViewLeaderboard,
  onSwitchAIChartStyle,
}) => {
  const [playerName, setPlayerName] = useState(() => {
    return localStorage.getItem('rhythm_player_name') || 'BeatStriker';
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRank, setSubmittedRank] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // AI Chart Regeneration state
  const [currentStyle, setCurrentStyle] = useState<string>(
    track.aiChart?.focusStyle || 'MELODY'
  );
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regeneratingStyle, setRegeneratingStyle] = useState<string | null>(null);
  const [regenerateSuccess, setRegenerateSuccess] = useState<string | null>(null);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

  const handleRegenerateStyle = async (styleId: string) => {
    if (isRegenerating) return;

    setIsRegenerating(true);
    setRegeneratingStyle(styleId);
    setRegenerateError(null);
    setRegenerateSuccess(null);

    const targetStyleObj = AI_STYLES.find((s) => s.id === styleId);

    try {
      const res = await fetch('/api/chart/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackTitle: track.title,
          artist: track.artist,
          genre: track.genre || 'Electronic',
          tempo: track.tempo,
          key: track.key || 'C',
          difficulty,
          focusStyle: styleId,
        }),
      });

      if (!res.ok) throw new Error('AI regeneration request failed');

      const data = await res.json();
      if (data.success && data.blueprint) {
        setCurrentStyle(styleId);
        onSwitchAIChartStyle?.(data.blueprint);
        setRegenerateSuccess(
          `Chart regenerated with ${targetStyleObj?.name || styleId}! Replay to test the new phrasing.`
        );
      } else {
        throw new Error('Could not generate chart blueprint');
      }
    } catch (err: any) {
      console.error('Chart regeneration error:', err);
      setRegenerateError('Could not regenerate chart with AI. Please try again.');
    } finally {
      setIsRegenerating(false);
      setRegeneratingStyle(null);
    }
  };

  const handleSubmitScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      localStorage.setItem('rhythm_player_name', playerName.trim());

      const res = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerName: playerName.trim(),
          trackId: track.id,
          trackTitle: track.title,
          artist: track.artist,
          playlistName: track.album || 'YouTube Music Playlist',
          difficulty,
          score: score.score,
          maxCombo: score.maxCombo,
          accuracy: score.accuracy,
        }),
      });

      if (!res.ok) throw new Error('Submission failed');

      const data = await res.json();
      if (data.success) {
        setSubmittedRank(data.rank);
      }
    } catch (err: any) {
      setErrorMsg('Could not submit score to global leaderboard. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getGradeStyle = (grade: ScoreState['grade']) => {
    switch (grade) {
      case 'SSS':
        return 'text-amber-300 border-amber-300/40 bg-amber-500/10 shadow-amber-500/30';
      case 'SS':
      case 'S':
        return 'text-emerald-400 border-emerald-400/40 bg-emerald-500/10 shadow-emerald-500/30';
      case 'A':
        return 'text-cyan-400 border-cyan-400/40 bg-cyan-500/10 shadow-cyan-500/30';
      case 'B':
        return 'text-blue-400 border-blue-400/40 bg-blue-500/10 shadow-blue-500/30';
      case 'C':
        return 'text-amber-500 border-amber-500/40 bg-amber-500/10 shadow-amber-500/30';
      case 'F':
        return 'text-rose-500 border-rose-500/40 bg-rose-500/10 shadow-rose-500/30';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl relative my-8">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
            <Sparkles className="w-3.5 h-3.5" /> Stage Cleared
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-black text-white mt-1">
            Performance Summary
          </h2>
          <p className="text-xs text-zinc-400">
            {track.title} • {track.artist} ({difficulty})
          </p>
        </div>

        {/* Grade & Main Score Banner */}
        <div className="flex items-center justify-center gap-6 py-4 bg-zinc-950/60 rounded-2xl border border-zinc-800/80">
          <div
            className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 flex items-center justify-center shadow-lg font-display font-black text-4xl sm:text-5xl ${getGradeStyle(
              score.grade
            )}`}
          >
            {score.grade}
          </div>

          <div className="space-y-1">
            <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-500">
              Total Score
            </span>
            <div className="font-display font-black text-3xl sm:text-4xl text-white tracking-tight">
              {score.score.toLocaleString()}
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-emerald-400 font-bold">{score.accuracy}% ACC</span>
              <span className="text-zinc-600">•</span>
              <span className="text-amber-400 flex items-center gap-1 font-bold">
                <Flame className="w-3 h-3 fill-current" /> {score.maxCombo} MAX
              </span>
            </div>
          </div>
        </div>

        {/* Breakdown Stats Grid */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/60">
            <span className="block text-[10px] font-bold text-amber-400 uppercase">PERFECT</span>
            <span className="font-mono text-lg font-black text-zinc-100">{score.perfects}</span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/60">
            <span className="block text-[10px] font-bold text-emerald-400 uppercase">GREAT</span>
            <span className="font-mono text-lg font-black text-zinc-100">{score.greats}</span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/60">
            <span className="block text-[10px] font-bold text-cyan-400 uppercase">GOOD</span>
            <span className="font-mono text-lg font-black text-zinc-100">{score.goods}</span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/60">
            <span className="block text-[10px] font-bold text-rose-400 uppercase">MISS</span>
            <span className="font-mono text-lg font-black text-zinc-100">{score.misses}</span>
          </div>
        </div>

        {/* AI Chart Style Regeneration Menu */}
        <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  Chart didn't feel right?
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                    Try Another Style
                  </span>
                </h4>
                <p className="text-[11px] text-zinc-400">
                  Select a different musical AI personality to re-architect note patterns:
                </p>
              </div>
            </div>
            {currentStyle && (
              <span className="text-[10px] font-mono text-zinc-400 hidden sm:inline-block">
                Active: <strong className="text-amber-300">{AI_STYLES.find(s => s.id === currentStyle)?.name || currentStyle}</strong>
              </span>
            )}
          </div>

          {/* 4 Chart Styles Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {AI_STYLES.map((style) => {
              const Icon = style.icon;
              const isCurrent = currentStyle === style.id;
              const isThisRegenerating = isRegenerating && regeneratingStyle === style.id;

              return (
                <button
                  key={style.id}
                  id={`btn-regenerate-style-${style.id.toLowerCase()}`}
                  onClick={() => handleRegenerateStyle(style.id)}
                  disabled={isRegenerating}
                  className={`p-2.5 rounded-xl border text-left transition relative flex flex-col justify-between ${
                    isCurrent
                      ? 'border-amber-500/60 bg-amber-500/10 text-white shadow-sm'
                      : 'border-zinc-800 bg-zinc-900/70 hover:bg-zinc-800/80 text-zinc-300 hover:border-zinc-700'
                  } ${isRegenerating ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <Icon className={`w-3.5 h-3.5 ${style.iconColor}`} />
                      <span className={isCurrent ? 'text-amber-300' : 'text-zinc-200'}>
                        {style.name}
                      </span>
                    </div>
                    {isCurrent && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        CURRENT
                      </span>
                    )}
                    {isThisRegenerating && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-snug">{style.desc}</p>
                </button>
              );
            })}
          </div>

          {regenerateSuccess && (
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                {regenerateSuccess}
              </span>
              <button
                id="btn-quick-replay-new-style"
                onClick={onPlayAgain}
                className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-[11px] rounded-lg transition shrink-0 ml-2"
              >
                Play Now
              </button>
            </div>
          )}

          {regenerateError && (
            <p className="text-[11px] text-rose-400 font-medium">{regenerateError}</p>
          )}
        </div>

        {/* Global Leaderboard Submission Form */}
        <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              Global Leaderboard
            </h4>
            {submittedRank && (
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Rank #{submittedRank} Achieved!
              </span>
            )}
          </div>

          {!submittedRank ? (
            <form onSubmit={handleSubmitScore} className="flex gap-2">
              <input
                id="input-player-name"
                type="text"
                placeholder="Enter your player handle..."
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={20}
                className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                id="btn-submit-score"
                type="submit"
                disabled={isSubmitting || !playerName.trim()}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-sm"
              >
                <Send className="w-3 h-3" />
                {isSubmitting ? 'Posting...' : 'Submit Score'}
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-zinc-400">
                Score saved as <strong className="text-white">{playerName}</strong>
              </p>
              <button
                id="btn-view-board-after-submit"
                onClick={onViewLeaderboard}
                className="text-xs font-bold text-amber-400 hover:underline flex items-center gap-1"
              >
                View High Scores <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {errorMsg && <p className="text-xs text-rose-400">{errorMsg}</p>}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            id="btn-play-again"
            onClick={onPlayAgain}
            className="w-full sm:flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/15"
          >
            <RotateCcw className="w-4 h-4" />
            {regenerateSuccess ? 'Replay With New Chart' : 'Play Again'}
          </button>

          <button
            id="btn-back-to-tracks"
            onClick={onBackToTracks}
            className="w-full sm:flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold text-sm flex items-center justify-center gap-2 transition"
          >
            Track Select <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
