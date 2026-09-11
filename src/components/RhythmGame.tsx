import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, ArrowLeft, Volume2, Flame, Heart, Zap, Tv, Sliders, Sparkles } from 'lucide-react';
import { GameDifficulty, GameSettings, HitJudgment, Note, ScoreState, Track } from '../types';
import { audioEngine } from '../utils/audioEngine';
import { youtubePlayer } from '../utils/youtubePlayer';
import { generateChart } from '../utils/chartGenerator';

interface RhythmGameProps {
  track: Track;
  difficulty: GameDifficulty;
  settings: GameSettings;
  onUpdateSettings?: (settings: GameSettings) => void;
  onFinishGame: (score: ScoreState) => void;
  onQuitGame: () => void;
}

interface VisualEffect {
  id: number;
  lane: number;
  judgment: HitJudgment;
  x: number;
  y: number;
  alpha: number;
  scale: number;
}

const LANE_COLORS = [
  { border: '#06b6d4', glow: 'rgba(6, 182, 212, 0.4)', bg: 'bg-cyan-500/20', text: 'text-cyan-400', keyColor: 'border-cyan-500/50', name: 'LOW', pitch: 'Root / Low Melody' },
  { border: '#10b981', glow: 'rgba(16, 185, 129, 0.4)', bg: 'bg-emerald-500/20', text: 'text-emerald-400', keyColor: 'border-emerald-500/50', name: 'MID', pitch: 'Vocal / Melody' },
  { border: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)', bg: 'bg-amber-500/20', text: 'text-amber-400', keyColor: 'border-amber-500/50', name: 'LEAD', pitch: 'Chorus Hook' },
  { border: '#f43f5e', glow: 'rgba(244, 63, 94, 0.4)', bg: 'bg-rose-500/20', text: 'text-rose-400', keyColor: 'border-rose-500/50', name: 'PEAK', pitch: 'High Octave / Lead' },
];

export const RhythmGame: React.FC<RhythmGameProps> = ({
  track,
  difficulty,
  settings,
  onUpdateSettings,
  onFinishGame,
  onQuitGame,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Game state
  const [isPaused, setIsPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [health, setHealth] = useState(100);
  const [lastJudgment, setLastJudgment] = useState<{ text: HitJudgment; key: number } | null>(null);
  const [songProgress, setSongProgress] = useState(0);

  // Active key pressed states for visual feedback
  const [pressedLanes, setPressedLanes] = useState<boolean[]>([false, false, false, false]);
  const [isVideoVisible, setIsVideoVisible] = useState(true);

  // Sync with player internal visibility changes (e.g. user clicked close button on player)
  useEffect(() => {
    const handleVis = (vis: boolean) => {
      setIsVideoVisible(vis);
    };
    youtubePlayer.addVisibilityListener(handleVis);
    return () => {
      youtubePlayer.removeVisibilityListener(handleVis);
    };
  }, []);

  const toggleVideo = () => {
    const next = !isVideoVisible;
    setIsVideoVisible(next);
    youtubePlayer.setVisible(next);
  };

  // Live Audio Beat Sync Nudge (for immediate latency calibration during gameplay/pause)
  const handleNudgeOffset = (deltaMs: number) => {
    const current = settings.audioOffsetMs || 0;
    const nextVal = Math.max(-250, Math.min(300, current + deltaMs));
    audioEngine.setAudioOffset(nextVal);
    onUpdateSettings?.({ ...settings, audioOffsetMs: nextVal });
  };

  const handleResetOffset = () => {
    audioEngine.setAudioOffset(0);
    onUpdateSettings?.({ ...settings, audioOffsetMs: 0 });
  };

  const handleSfxVolumeChange = (vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    audioEngine.setVolumes(settings.musicVolume, clamped);
    onUpdateSettings?.({ ...settings, sfxVolume: clamped });
    audioEngine.playHitSound('PERFECT');
  };

  // Internal mutable refs for 60-120fps canvas loop
  const notesRef = useRef<Note[]>([]);
  const scoreRef = useRef<ScoreState>({
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfects: 0,
    greats: 0,
    goods: 0,
    misses: 0,
    accuracy: 100,
    health: 100,
    grade: 'SSS',
  });
  const effectsRef = useRef<VisualEffect[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const isFinishedRef = useRef(false);

  // Total song length cap for game balance
  const songDurationSeconds = Math.min(Math.max(track.durationMs / 1000, 30), 180);
  const scrollTravelTime = 1.8 / settings.scrollSpeed; // Time in seconds note travels from top to hit line

  // Keybindings map
  const laneKeyCodes = [
    settings.keyBindings.lane0,
    settings.keyBindings.lane1,
    settings.keyBindings.lane2,
    settings.keyBindings.lane3,
  ];

  // Helper to calculate Grade
  const calculateGrade = (acc: number): ScoreState['grade'] => {
    if (acc >= 98) return 'SSS';
    if (acc >= 95) return 'SS';
    if (acc >= 90) return 'S';
    if (acc >= 80) return 'A';
    if (acc >= 70) return 'B';
    if (acc >= 60) return 'C';
    return 'F';
  };

  // Register judgment
  const applyJudgment = useCallback(
    (judgment: HitJudgment, lane: number) => {
      audioEngine.playHitSound(judgment, lane);

      const s = scoreRef.current;
      let scoreAdd = 0;
      let multiplier = 1.0;
      if (s.combo >= 50) multiplier = 3.0;
      else if (s.combo >= 25) multiplier = 2.0;
      else if (s.combo >= 10) multiplier = 1.5;

      if (judgment === 'PERFECT') {
        s.perfects++;
        s.combo++;
        scoreAdd = Math.round(100 * multiplier);
        s.health = Math.min(100, s.health + 3);
      } else if (judgment === 'GREAT') {
        s.greats++;
        s.combo++;
        scoreAdd = Math.round(70 * multiplier);
        s.health = Math.min(100, s.health + 1.5);
      } else if (judgment === 'GOOD') {
        s.goods++;
        // Maintain combo
        scoreAdd = Math.round(40 * multiplier);
        s.health = Math.min(100, s.health + 0.5);
      } else {
        // MISS
        s.misses++;
        s.combo = 0;
        s.health = Math.max(0, s.health - 8);
      }

      s.score += scoreAdd;
      s.maxCombo = Math.max(s.maxCombo, s.combo);

      // Accuracy formula
      const totalJudged = s.perfects + s.greats + s.goods + s.misses;
      if (totalJudged > 0) {
        const acc = ((s.perfects * 100 + s.greats * 70 + s.goods * 40) / (totalJudged * 100)) * 100;
        s.accuracy = parseFloat(acc.toFixed(1));
      }
      s.grade = calculateGrade(s.accuracy);

      setScore(s.score);
      setCombo(s.combo);
      setMaxCombo(s.maxCombo);
      setHealth(s.health);
      setLastJudgment({ text: judgment, key: Date.now() });

      // Spawn visual effect
      effectsRef.current.push({
        id: Math.random(),
        lane,
        judgment,
        x: 0,
        y: 0,
        alpha: 1.0,
        scale: 1.0,
      });
    },
    []
  );

  // Lane input press handler
  const handleLaneHit = useCallback(
    (lane: number) => {
      if (isPaused || isFinishedRef.current) return;
      const currentTime = audioEngine.getCurrentTime();

      // Find nearest unhit note in this lane
      let candidate: Note | null = null;
      let minDelta = Infinity;

      for (const note of notesRef.current) {
        if (note.lane === lane && !note.hit && !note.missed) {
          const delta = Math.abs(currentTime - note.time);
          if (delta < minDelta && delta < 0.22) {
            minDelta = delta;
            candidate = note;
          }
        }
      }

      if (candidate) {
        candidate.hit = true;
        if (minDelta <= 0.055) {
          candidate.judgment = 'PERFECT';
          applyJudgment('PERFECT', lane);
        } else if (minDelta <= 0.115) {
          candidate.judgment = 'GREAT';
          applyJudgment('GREAT', lane);
        } else if (minDelta <= 0.19) {
          candidate.judgment = 'GOOD';
          applyJudgment('GOOD', lane);
        } else {
          candidate.judgment = 'MISS';
          candidate.missed = true;
          applyJudgment('MISS', lane);
        }
      }
    },
    [isPaused, applyJudgment]
  );

  // Initialize and start track
  useEffect(() => {
    isFinishedRef.current = false;
    audioEngine.setVolumes(settings.musicVolume, settings.sfxVolume);
    audioEngine.setAudioOffset(settings.audioOffsetMs);

    // Generate chart
    const generatedNotes = generateChart(track, difficulty);
    notesRef.current = generatedNotes;

    // Reset score
    scoreRef.current = {
      score: 0,
      combo: 0,
      maxCombo: 0,
      perfects: 0,
      greats: 0,
      goods: 0,
      misses: 0,
      accuracy: 100,
      health: 100,
      grade: 'SSS',
    };
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setHealth(100);

    // Start playback
    audioEngine.startTrack(track);

    return () => {
      audioEngine.stopTrack();
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [track, difficulty, settings]);

  // Keyboard Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'Space') {
        e.preventDefault();
        togglePause();
        return;
      }

      const laneIndex = laneKeyCodes.indexOf(e.code);
      if (laneIndex !== -1 && !e.repeat) {
        e.preventDefault();
        setPressedLanes((prev) => {
          const next = [...prev];
          next[laneIndex] = true;
          return next;
        });
        handleLaneHit(laneIndex);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const laneIndex = laneKeyCodes.indexOf(e.code);
      if (laneIndex !== -1) {
        setPressedLanes((prev) => {
          const next = [...prev];
          next[laneIndex] = false;
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [laneKeyCodes, handleLaneHit]);

  // Pause / Resume
  const togglePause = () => {
    if (isPaused) {
      audioEngine.resumeTrack(track);
      setIsPaused(false);
    } else {
      audioEngine.pauseTrack();
      setIsPaused(true);
    }
  };

  const handleRestart = () => {
    audioEngine.stopTrack();
    setIsPaused(false);
    isFinishedRef.current = false;
    const generatedNotes = generateChart(track, difficulty);
    notesRef.current = generatedNotes;
    scoreRef.current = {
      score: 0,
      combo: 0,
      maxCombo: 0,
      perfects: 0,
      greats: 0,
      goods: 0,
      misses: 0,
      accuracy: 100,
      health: 100,
      grade: 'SSS',
    };
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setHealth(100);
    effectsRef.current = [];
    audioEngine.startTrack(track);
  };

  // High-performance Canvas Render Loop (60-120 FPS)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastTime = performance.now();

    const render = () => {
      if (!canvas || !ctx) return;

      // Handle canvas resolution
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, width, height);

      const currentTime = audioEngine.getCurrentTime();
      setSongProgress(Math.min(100, (currentTime / songDurationSeconds) * 100));

      // Check if song finished
      if (!isFinishedRef.current && currentTime >= songDurationSeconds) {
        isFinishedRef.current = true;
        onFinishGame({ ...scoreRef.current });
        return;
      }

      // Check for passed notes that were missed
      for (const note of notesRef.current) {
        if (!note.hit && !note.missed && currentTime - note.time > 0.18) {
          note.missed = true;
          note.judgment = 'MISS';
          applyJudgment('MISS', note.lane);
        }
      }

      // Highway geometry
      const highwayWidth = Math.min(width * 0.75, 480);
      const highwayLeft = (width - highwayWidth) / 2;
      const laneWidth = highwayWidth / 4;
      const hitLineY = height * 0.82; // 82% down

      // Get real-time audio visualizer & beat pulse
      const { frequencies, beatPulse } = audioEngine.getVisualizerData();

      // 1. Draw Highway Background & Grid
      ctx.save();
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, 'rgba(15, 15, 18, 0.4)');
      bgGrad.addColorStop(1, 'rgba(9, 9, 11, 0.95)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(highwayLeft, 0, highwayWidth, height);

      // Highway borders
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.15 + beatPulse * 0.25})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(highwayLeft, 0);
      ctx.lineTo(highwayLeft, height);
      ctx.moveTo(highwayLeft + highwayWidth, 0);
      ctx.lineTo(highwayLeft + highwayWidth, height);
      ctx.stroke();

      // Lane dividers
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      for (let l = 1; l < 4; l++) {
        const x = highwayLeft + l * laneWidth;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Scrolling Beat Grid Lines (Measure Bars & Quarter Beats)
      const bpm = track.tempo > 40 && track.tempo < 240 ? track.tempo : 120;
      const beatSec = 60 / bpm;
      const baseBeatOffset = track.beatOffset ?? 0.18;
      const minVisibleTime = currentTime - 0.1;
      const maxVisibleTime = currentTime + scrollTravelTime;
      const startBeatIdx = Math.max(0, Math.floor((minVisibleTime - baseBeatOffset) / beatSec));
      const endBeatIdx = Math.ceil((maxVisibleTime - baseBeatOffset) / beatSec);

      for (let b = startBeatIdx; b <= endBeatIdx; b++) {
        const beatTime = baseBeatOffset + b * beatSec;
        const timeDiff = beatTime - currentTime;
        if (timeDiff >= -0.1 && timeDiff <= scrollTravelTime) {
          const progress = 1 - timeDiff / scrollTravelTime;
          const lineY = progress * hitLineY;
          const isMeasureLine = b % 4 === 0;

          ctx.beginPath();
          ctx.moveTo(highwayLeft, lineY);
          ctx.lineTo(highwayLeft + highwayWidth, lineY);
          if (isMeasureLine) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
            ctx.lineWidth = 2;
          } else {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
            ctx.lineWidth = 1;
          }
          ctx.stroke();
        }
      }

      // 2. Active Lane Highlights (when player holds down key or touch)
      pressedLanes.forEach((pressed, l) => {
        if (pressed) {
          const laneX = highwayLeft + l * laneWidth;
          const laneGrad = ctx.createLinearGradient(0, hitLineY, 0, 0);
          laneGrad.addColorStop(0, LANE_COLORS[l].glow);
          laneGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = laneGrad;
          ctx.fillRect(laneX, 0, laneWidth, hitLineY);
        }
      });

      // 3. Hit Target Line with dynamic BPM Beat Pulse
      const strikePulse = Math.max(1, beatPulse * 4);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 + beatPulse * 0.5})`;
      ctx.lineWidth = 3 + strikePulse;
      ctx.beginPath();
      ctx.moveTo(highwayLeft, hitLineY);
      ctx.lineTo(highwayLeft + highwayWidth, hitLineY);
      ctx.stroke();

      // Target hit circles in each lane
      for (let l = 0; l < 4; l++) {
        const laneCenterX = highwayLeft + l * laneWidth + laneWidth / 2;
        const color = LANE_COLORS[l];

        ctx.strokeStyle = color.border;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(laneCenterX, hitLineY, 20, 0, Math.PI * 2);
        ctx.stroke();

        if (pressedLanes[l]) {
          ctx.fillStyle = color.border;
          ctx.beginPath();
          ctx.arc(laneCenterX, hitLineY, 16, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 4. Draw Falling Notes
      const noteHeight = 16;
      for (const note of notesRef.current) {
        if (note.hit || note.missed) continue;

        const timeDiff = note.time - currentTime;
        // Visible window: from top to slightly below hitline
        if (timeDiff <= scrollTravelTime && timeDiff >= -0.2) {
          // progress: 0 at top (0y), 1.0 at hitLineY
          const progress = 1 - timeDiff / scrollTravelTime;
          const noteY = progress * hitLineY;

          if (noteY >= -20 && noteY <= height) {
            const laneX = highwayLeft + note.lane * laneWidth + 6;
            const curNoteWidth = laneWidth - 12;
            const color = LANE_COLORS[note.lane];

            // Glow around note
            ctx.shadowColor = color.border;
            ctx.shadowBlur = 12;

            // Note body
            ctx.fillStyle = color.border;
            ctx.beginPath();
            ctx.roundRect(laneX, noteY - noteHeight / 2, curNoteWidth, noteHeight, 6);
            ctx.fill();

            // Inner gloss
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.roundRect(laneX + 4, noteY - noteHeight / 2 + 3, curNoteWidth - 8, noteHeight / 3, 3);
            ctx.fill();
          }
        }
      }

      // 5. Draw Visual Effects / Judgment Splashes
      effectsRef.current = effectsRef.current.filter((eff) => {
        const laneCenterX = highwayLeft + eff.lane * laneWidth + laneWidth / 2;
        eff.alpha -= 0.04;
        eff.scale += 0.05;

        if (eff.alpha <= 0) return false;

        ctx.save();
        ctx.globalAlpha = eff.alpha;
        const color = LANE_COLORS[eff.lane];

        // Ring explosion
        ctx.strokeStyle = color.border;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(laneCenterX, hitLineY, 20 * eff.scale, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
        return true;
      });

      // 6. Draw Audio Spectrum Visualizer Bars on the Highway Flanks
      if (frequencies.length > 0) {
        const barCount = 16;
        const barHeight = height / barCount;
        for (let i = 0; i < barCount; i++) {
          const val = frequencies[i] || 0;
          const barWidth = (val / 255) * ((width - highwayWidth) / 2 - 20);

          // Left side
          ctx.fillStyle = `rgba(16, 185, 129, ${0.15 + (val / 255) * 0.4})`;
          ctx.fillRect(highwayLeft - 10 - barWidth, height - (i + 1) * barHeight, barWidth, barHeight - 2);

          // Right side
          ctx.fillStyle = `rgba(6, 182, 212, ${0.15 + (val / 255) * 0.4})`;
          ctx.fillRect(highwayLeft + highwayWidth + 10, height - (i + 1) * barHeight, barWidth, barHeight - 2);
        }
      }

      ctx.restore();

      if (!isPaused) {
        animFrameRef.current = requestAnimationFrame(render);
      }
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPaused, scrollTravelTime, songDurationSeconds, onFinishGame, applyJudgment, pressedLanes]);

  // Judgment color helper
  const getJudgmentBadge = (text: HitJudgment) => {
    switch (text) {
      case 'PERFECT':
        return 'text-amber-400 border-amber-400/40 bg-amber-500/10 shadow-amber-500/20';
      case 'GREAT':
        return 'text-emerald-400 border-emerald-400/40 bg-emerald-500/10 shadow-emerald-500/20';
      case 'GOOD':
        return 'text-cyan-400 border-cyan-400/40 bg-cyan-500/10 shadow-cyan-500/20';
      case 'MISS':
        return 'text-rose-400 border-rose-400/40 bg-rose-500/10 shadow-rose-500/20';
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[calc(100vh-4rem)] bg-zinc-950 flex flex-col justify-between overflow-hidden select-none"
    >
      {/* Top HUD: Song info, Score, Combo, Health Bar */}
      <div className="absolute top-0 inset-x-0 z-20 p-4 sm:p-6 bg-gradient-to-b from-zinc-950/90 via-zinc-950/60 to-transparent flex flex-col gap-3 pointer-events-none">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between gap-4">
          {/* Left: Track & Quit Button */}
          <div className="flex items-center gap-3 pointer-events-auto">
            <button
              id="btn-quit-game"
              onClick={onQuitGame}
              className="p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition"
              title="Quit to Song Selector"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h2 className="font-display font-bold text-sm sm:text-base text-zinc-100 truncate">
                {track.title}
              </h2>
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="font-mono text-emerald-400 font-bold">{track.tempo} BPM</span>
                <span>•</span>
                <span className="uppercase text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 font-bold text-zinc-300">
                  {difficulty}
                </span>
                {track.aiChart && (
                  <>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 uppercase text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-300 font-black tracking-wide">
                      <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                      AI: {track.aiChart.styleName}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Center: Score & Combo Counter */}
          <div className="text-center">
            <div className="font-display font-black text-2xl sm:text-4xl tracking-tight text-white drop-shadow-md">
              {score.toLocaleString()}
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-xs text-zinc-400">
                ACC <span className="text-zinc-200 font-bold">{scoreRef.current.accuracy}%</span>
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-zinc-800 text-emerald-400 border border-zinc-700 font-mono">
                {scoreRef.current.grade}
              </span>
            </div>
          </div>

          {/* Right: Audio source, Video toggle & Pause */}
          <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto">
            {track.youtubeVideoId && (
              <>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold">
                  <Play className="w-3 h-3 fill-current" /> YT Audio
                </span>
                <button
                  id="btn-toggle-video"
                  onClick={toggleVideo}
                  className={`p-2 rounded-xl border transition text-xs font-bold flex items-center gap-1 ${
                    isVideoVisible
                      ? 'bg-zinc-800 border-zinc-700 text-emerald-400 shadow-sm'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                  title={isVideoVisible ? 'Hide video window (drag handle or snap corner anytime)' : 'Show video window'}
                >
                  <Tv className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              id="btn-pause-game"
              onClick={togglePause}
              className="p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition"
              title="Pause Game (Esc)"
            >
              {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Health & Song Progress Bars */}
        <div className="max-w-4xl mx-auto w-full space-y-1.5">
          {/* Groove / Health Gauge */}
          <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800 flex">
            <div
              className={`h-full transition-all duration-150 rounded-full ${
                health > 50 ? 'bg-emerald-400' : health > 20 ? 'bg-amber-400' : 'bg-rose-500'
              }`}
              style={{ width: `${health}%` }}
            />
          </div>

          {/* Song Timeline */}
          <div className="w-full h-1 bg-zinc-900/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-400/60 transition-all duration-100"
              style={{ width: `${songProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Center Combo & Judgment Floating HUD */}
      <div className="absolute top-1/3 inset-x-0 z-20 flex flex-col items-center justify-center pointer-events-none">
        {combo > 3 && (
          <div className="flex flex-col items-center animate-bounce">
            <span className="font-display font-black text-4xl sm:text-6xl tracking-tight text-white drop-shadow-[0_0_20px_rgba(16,185,129,0.5)]">
              {combo}
            </span>
            <span className="font-display font-bold text-xs uppercase tracking-widest text-emerald-400 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 fill-current" /> COMBO
            </span>
          </div>
        )}

        {lastJudgment && (
          <div
            key={lastJudgment.key}
            className={`mt-2 px-3 py-1 rounded-full border text-xs sm:text-sm font-black tracking-wider uppercase animate-scale-up ${getJudgmentBadge(
              lastJudgment.text
            )}`}
          >
            {lastJudgment.text}
          </div>
        )}
      </div>

      {/* Main Canvas Highway */}
      <canvas
        ref={canvasRef}
        className={`w-full flex-1 touch-none ${settings.perspective3D ? 'perspective-tilt' : ''}`}
      />

      {/* Bottom Lane Controls for Touch & Visual Key Feedback */}
      <div className="w-full max-w-lg mx-auto px-4 pb-4 z-20 grid grid-cols-4 gap-2 sm:gap-3">
        {LANE_COLORS.map((col, idx) => {
          const isPressed = pressedLanes[idx];
          const keyLabel = settings.keyBindings.laneLabels[idx] || ['D', 'F', 'J', 'K'][idx];

          return (
            <button
              key={idx}
              id={`lane-btn-${idx}`}
              onPointerDown={(e) => {
                e.preventDefault();
                setPressedLanes((prev) => {
                  const next = [...prev];
                  next[idx] = true;
                  return next;
                });
                handleLaneHit(idx);
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                setPressedLanes((prev) => {
                  const next = [...prev];
                  next[idx] = false;
                  return next;
                });
              }}
              onPointerLeave={() => {
                setPressedLanes((prev) => {
                  const next = [...prev];
                  next[idx] = false;
                  return next;
                });
              }}
              className={`h-16 sm:h-20 rounded-2xl border-2 flex flex-col items-center justify-center transition-all duration-75 select-none active:scale-95 ${
                isPressed
                  ? `${col.bg} border-white shadow-lg shadow-white/20 translate-y-1`
                  : `bg-zinc-900/80 ${col.keyColor} hover:bg-zinc-800/80`
              }`}
            >
              <span className="font-display font-black text-lg sm:text-xl text-white">
                {keyLabel}
              </span>
              <div className="flex items-center gap-1">
                <span className={`text-[10px] font-black tracking-wider ${col.text}`}>{col.name}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Pause Modal Overlay */}
      {isPaused && (
        <div className="absolute inset-0 z-50 bg-zinc-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 max-w-sm w-full text-center space-y-5 shadow-2xl">
            <div className="space-y-1">
              <span className="text-xs font-mono text-red-400 uppercase font-bold tracking-widest">
                Game Paused
              </span>
              <h3 className="font-display text-2xl font-bold text-white">Take a Breather</h3>
              <p className="text-xs text-zinc-400">{track.title} • {track.artist}</p>
            </div>

            {/* In-Game Live Audio Beat Sync Tuner */}
            <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3 text-left space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-300 font-semibold flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-red-400" /> Beat Sync Offset
                </span>
                <span className="font-mono font-bold text-red-400">
                  {settings.audioOffsetMs > 0 ? `+${settings.audioOffsetMs}` : settings.audioOffsetMs} ms
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleNudgeOffset(-10)}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-mono font-bold text-zinc-200 transition"
                  title="Nudge audio -10ms (earlier)"
                >
                  -10ms
                </button>
                <button
                  type="button"
                  onClick={handleResetOffset}
                  className="py-1.5 px-2.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-xs font-mono text-zinc-400 hover:text-zinc-200 transition"
                  title="Reset offset to 0ms"
                >
                  0ms
                </button>
                <button
                  type="button"
                  onClick={() => handleNudgeOffset(10)}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-mono font-bold text-zinc-200 transition"
                  title="Nudge audio +10ms (later / Bluetooth)"
                >
                  +10ms
                </button>
              </div>
              <p className="text-[10px] text-zinc-500 leading-tight">
                Use if notes feel slightly early or late on your audio device.
              </p>
            </div>

            {/* In-Game Live Hit Sound Volume Control */}
            <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3 text-left space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-300 font-semibold flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" /> Hit Sound Volume
                </span>
                <span className="font-mono font-bold text-amber-400">
                  {Math.round(settings.sfxVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.sfxVolume}
                onChange={(e) => handleSfxVolumeChange(parseFloat(e.target.value))}
                className="w-full accent-red-500 cursor-pointer"
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSfxVolumeChange(0)}
                  className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-bold transition ${
                    settings.sfxVolume === 0
                      ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Mute
                </button>
                <button
                  type="button"
                  onClick={() => handleSfxVolumeChange(0.15)}
                  className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-bold transition ${
                    Math.abs(settings.sfxVolume - 0.15) < 0.05
                      ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Quiet (15%)
                </button>
                <button
                  type="button"
                  onClick={() => handleSfxVolumeChange(0.25)}
                  className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-bold transition ${
                    Math.abs(settings.sfxVolume - 0.25) < 0.05
                      ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Subtle (25%)
                </button>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                id="btn-resume-game"
                onClick={togglePause}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-red-600/20 active:scale-[0.98]"
              >
                <Play className="w-4 h-4 fill-current" /> Resume Game
              </button>

              <button
                id="btn-restart-game"
                onClick={handleRestart}
                className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-sm flex items-center justify-center gap-2 transition"
              >
                <RotateCcw className="w-4 h-4" /> Restart Track
              </button>

              <button
                id="btn-exit-to-playlists"
                onClick={onQuitGame}
                className="w-full py-2.5 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-zinc-800/50 font-medium text-xs transition"
              >
                Exit to Playlist Selection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
