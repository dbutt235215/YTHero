import React, { useState } from 'react';
import { Sparkles, Bot, Zap, Music, Play, RotateCcw, X, Check, ArrowRight, Sliders, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Track, GameDifficulty, AIChartBlueprint } from '../types';

interface AIChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track;
  difficulty: GameDifficulty;
  onApplyAIChart: (blueprint: AIChartBlueprint) => void;
  onRemoveAIChart: () => void;
  onStartWithAIChart: (blueprint: AIChartBlueprint) => void;
}

const AI_STYLES = [
  {
    id: 'MELODY',
    name: 'Melodic Virtuoso',
    icon: Music,
    description: 'Tracks vocal hooks, saxophone solos, and lead synths with soaring lane climbs.',
    accent: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/40',
  },
  {
    id: 'RIFFS',
    name: 'Syncopated Riffs',
    icon: Zap,
    description: 'Focuses on rhythm guitar chops, syncopated drum breaks, and funky offbeat taps.',
    accent: 'from-cyan-500/20 to-blue-500/20 text-cyan-400 border-cyan-500/40',
  },
  {
    id: 'SOLO',
    name: 'Technical Shred',
    icon: Flame,
    description: 'High-density scalar runs, rapid trills between lanes 2 & 3, and arpeggio sweeps.',
    accent: 'from-purple-500/20 to-pink-500/20 text-purple-400 border-purple-500/40',
  },
  {
    id: 'BASS_DROP',
    name: 'Sub-Bass & Impact Drop',
    icon: Bot,
    description: 'Heavy Lane 0 root hits and build-ups leading into explosive dual-note drops.',
    accent: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/40',
  },
];

export const AIChartModal: React.FC<AIChartModalProps> = ({
  isOpen,
  onClose,
  track,
  difficulty,
  onApplyAIChart,
  onRemoveAIChart,
  onStartWithAIChart,
}) => {
  const [selectedStyle, setSelectedStyle] = useState<string>('MELODY');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [generatedBlueprint, setGeneratedBlueprint] = useState<AIChartBlueprint | null>(
    track.aiChart || null
  );

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setGenerationStep('Analyzing track rhythm structure & tempo...');

    try {
      const stepTimer1 = setTimeout(() => {
        setGenerationStep('Mapping melodic pitch contours to 4-lane highway...');
      }, 900);

      const stepTimer2 = setTimeout(() => {
        setGenerationStep('Synthesizing section motifs with Gemini 3.8 Flash...');
      }, 1800);

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
          focusStyle: selectedStyle,
          customPrompt: customPrompt.trim() || undefined,
        }),
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      if (!res.ok) {
        throw new Error('Failed to generate AI chart.');
      }

      const data = await res.json();
      if (data.blueprint) {
        setGeneratedBlueprint(data.blueprint);
        onApplyAIChart(data.blueprint);
      } else {
        throw new Error('Invalid AI chart response.');
      }
    } catch (err: any) {
      console.error('AI Chart generation error:', err);
      setError('AI generation had an unexpected issue. Please try again.');
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  const handleReset = () => {
    onRemoveAIChart();
    setGeneratedBlueprint(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-zinc-900 border border-zinc-700/80 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-red-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-zinc-100">AI Chart Studio</h2>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-red-600/20 text-red-400 border border-red-500/30">
                  Gemini 3.8 Flash
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Compose custom rhythm game note charts tailored to this track's melody and rhythm.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Target Track Info */}
          <div className="flex items-center gap-4 p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800">
            <img
              src={track.albumArt}
              alt={track.title}
              className="w-12 h-12 rounded-lg object-cover border border-zinc-800"
            />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-zinc-100 truncate">{track.title}</h3>
              <p className="text-xs text-zinc-400 truncate">{track.artist}</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="px-2 py-1 rounded bg-zinc-800 font-mono text-zinc-300">
                {track.tempo} BPM
              </span>
              <span className="px-2 py-1 rounded bg-red-950/50 text-red-400 font-semibold border border-red-500/20">
                {difficulty}
              </span>
            </div>
          </div>

          {/* Style Selection */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-zinc-500" />
              Choose AI Charting Focus
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {AI_STYLES.map((style) => {
                const Icon = style.icon;
                const isSelected = selectedStyle === style.id;
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setSelectedStyle(style.id)}
                    className={`p-3 rounded-xl border text-left transition flex items-start gap-3 ${
                      isSelected
                        ? `bg-gradient-to-br ${style.accent} border-amber-500/60 shadow-md`
                        : 'bg-zinc-800/40 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                    }`}
                  >
                    <div className={`p-2 rounded-lg bg-zinc-900/80 mt-0.5 ${isSelected ? 'text-amber-400' : 'text-zinc-400'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                        {style.name}
                        {isSelected && <Check className="w-3 h-3 text-amber-400" />}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
                        {style.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Custom Directives */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Custom Directives (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Heavy trills on the chorus drop, rapid stairs on the guitar solo..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-zinc-950/80 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-red-500 transition"
            />
          </div>

          {/* Error notice */}
          {error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Generated Result Preview */}
          {generatedBlueprint && !isGenerating && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 via-zinc-900 to-red-500/10 border border-amber-500/30 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-black text-amber-400 uppercase tracking-wide">
                    Active AI Chart Blueprint
                  </span>
                </div>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {generatedBlueprint.suggestedDensity} Density
                </span>
              </div>

              <div>
                <h4 className="text-sm font-black text-zinc-100">
                  {generatedBlueprint.styleName}
                </h4>
                <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                  {generatedBlueprint.musicalSummary}
                </p>
              </div>

              {/* Section Motifs Breakdown Pills */}
              <div className="pt-1 flex flex-wrap gap-1.5">
                {generatedBlueprint.sectionMotifs.map((motif) => (
                  <span
                    key={motif.section}
                    className="px-2 py-0.5 text-[10px] font-mono rounded bg-zinc-800 text-zinc-300 border border-zinc-700"
                  >
                    {motif.section}: {motif.measures.flat().length} notes/phrase
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* Generating Indicator */}
          {isGenerating && (
            <div className="p-6 rounded-xl bg-zinc-950/80 border border-amber-500/30 flex flex-col items-center justify-center text-center space-y-3">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin" />
                <Sparkles className="w-5 h-5 text-amber-400 absolute inset-0 m-auto" />
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-200">Composing AI Chart...</p>
                <p className="text-xs text-amber-400/90 mt-1 font-mono">{generationStep}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/90 flex items-center justify-between gap-3">
          {generatedBlueprint ? (
            <button
              type="button"
              onClick={handleReset}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-red-400 hover:bg-zinc-800/80 transition flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to Standard Chart
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-zinc-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition active:scale-95 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {generatedBlueprint ? 'Regenerate AI Chart' : 'Generate AI Chart'}
            </button>

            {generatedBlueprint && (
              <button
                type="button"
                onClick={() => {
                  onStartWithAIChart(generatedBlueprint);
                  onClose();
                }}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-red-600/25 transition active:scale-95"
              >
                <Play className="w-4 h-4 fill-white" />
                Play AI Chart
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
