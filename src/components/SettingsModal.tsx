import React, { useState } from 'react';
import { Settings, X, Volume2, Sliders, Keyboard, Gauge, Check, Play, RotateCcw } from 'lucide-react';
import { GameSettings, KeyBindings } from '../types';
import { audioEngine } from '../utils/audioEngine';

interface SettingsModalProps {
  settings: GameSettings;
  onUpdateSettings: (newSettings: GameSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdateSettings,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'GAMEPLAY' | 'AUDIO' | 'KEYS'>('GAMEPLAY');
  const [listeningLane, setListeningLane] = useState<number | null>(null);

  // Calibration tool state
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationTaps, setCalibrationTaps] = useState<number[]>([]);
  const [calibrationFeedback, setCalibrationFeedback] = useState<string | null>(null);

  const handleScrollSpeedChange = (val: number) => {
    onUpdateSettings({ ...settings, scrollSpeed: val });
  };

  const handleAudioOffsetChange = (val: number) => {
    onUpdateSettings({ ...settings, audioOffsetMs: val });
    audioEngine.setAudioOffset(val);
  };

  const handleMusicVolumeChange = (val: number) => {
    onUpdateSettings({ ...settings, musicVolume: val });
    audioEngine.setVolumes(val, settings.sfxVolume);
  };

  const handleSfxVolumeChange = (val: number) => {
    onUpdateSettings({ ...settings, sfxVolume: val });
    audioEngine.setVolumes(settings.musicVolume, val);
    audioEngine.playHitSound('PERFECT');
  };

  // Remap keys
  const startKeyRemap = (laneIndex: number) => {
    setListeningLane(laneIndex);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (listeningLane === null) return;
    e.preventDefault();
    e.stopPropagation();

    const code = e.code;
    const label = e.key.toUpperCase();

    const newKeyBindings: KeyBindings = { ...settings.keyBindings };
    const newLabels: [string, string, string, string] = [...newKeyBindings.laneLabels];

    if (listeningLane === 0) newKeyBindings.lane0 = code;
    if (listeningLane === 1) newKeyBindings.lane1 = code;
    if (listeningLane === 2) newKeyBindings.lane2 = code;
    if (listeningLane === 3) newKeyBindings.lane3 = code;

    newLabels[listeningLane] = label.length === 1 ? label : code.replace('Key', '').slice(0, 4);
    newKeyBindings.laneLabels = newLabels;

    onUpdateSettings({ ...settings, keyBindings: newKeyBindings });
    setListeningLane(null);
  };

  const setPresetKeys = (preset: 'DFJK' | 'ASKL' | 'ARROWS') => {
    let keyBindings: KeyBindings;
    if (preset === 'DFJK') {
      keyBindings = {
        lane0: 'KeyD',
        lane1: 'KeyF',
        lane2: 'KeyJ',
        lane3: 'KeyK',
        laneLabels: ['D', 'F', 'J', 'K'],
      };
    } else if (preset === 'ASKL') {
      keyBindings = {
        lane0: 'KeyA',
        lane1: 'KeyS',
        lane2: 'KeyK',
        lane3: 'KeyL',
        laneLabels: ['A', 'S', 'K', 'L'],
      };
    } else {
      keyBindings = {
        lane0: 'ArrowLeft',
        lane1: 'ArrowDown',
        lane2: 'ArrowUp',
        lane3: 'ArrowRight',
        laneLabels: ['←', '↓', '↑', '→'],
      };
    }
    onUpdateSettings({ ...settings, keyBindings });
  };

  // Interactive Audio Calibration Tap Metronome
  const startCalibration = () => {
    setIsCalibrating(true);
    setCalibrationTaps([]);
    setCalibrationFeedback('Tap SPACE or Click the Tap button right on the beat!');
  };

  const handleCalibrationTap = () => {
    audioEngine.playHitSound('PERFECT');
    const now = performance.now();
    setCalibrationTaps((prev) => {
      const next = [...prev, now];
      if (next.length >= 6) {
        // Calculate intervals
        const intervals: number[] = [];
        for (let i = 1; i < next.length; i++) {
          intervals.push(next[i] - next[i - 1]);
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        // Assume target ~500ms (120 BPM)
        const diff = Math.round(avgInterval - 500);
        const calibrated = Math.max(-100, Math.min(100, diff));
        handleAudioOffsetChange(calibrated);
        setIsCalibrating(false);
        setCalibrationFeedback(`Auto-calibrated offset to ${calibrated > 0 ? '+' : ''}${calibrated}ms!`);
        return [];
      }
      return next;
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-950/85 backdrop-blur-md flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-black text-xl text-white">
                Game Settings
              </h3>
              <p className="text-xs text-zinc-400">
                Speed, audio calibration & custom keybinds
              </p>
            </div>
          </div>
          <button
            id="btn-close-settings"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Pills */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-zinc-950 rounded-xl border border-zinc-800 text-xs font-bold">
          <button
            onClick={() => setActiveTab('GAMEPLAY')}
            className={`py-2 rounded-lg transition ${
              activeTab === 'GAMEPLAY' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Gameplay
          </button>
          <button
            onClick={() => setActiveTab('AUDIO')}
            className={`py-2 rounded-lg transition ${
              activeTab === 'AUDIO' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Audio & Offset
          </button>
          <button
            onClick={() => setActiveTab('KEYS')}
            className={`py-2 rounded-lg transition ${
              activeTab === 'KEYS' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Controls
          </button>
        </div>

        {/* Tab 1: Gameplay */}
        {activeTab === 'GAMEPLAY' && (
          <div className="space-y-5">
            {/* Scroll Speed Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-zinc-300 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                  Note Scroll Speed
                </label>
                <span className="font-mono text-emerald-400 font-bold bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                  {settings.scrollSpeed.toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min="1.0"
                max="3.0"
                step="0.2"
                value={settings.scrollSpeed}
                onChange={(e) => handleScrollSpeedChange(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                <span>1.0x (Relaxed)</span>
                <span>2.0x (Standard)</span>
                <span>3.0x (Hyper)</span>
              </div>
            </div>

            {/* Highway perspective toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
              <div>
                <span className="font-bold text-xs text-zinc-200 block">3D Highway Perspective</span>
                <span className="text-[11px] text-zinc-500 block">
                  Tilt the note highway backward for arcade depth
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.perspective3D}
                onChange={(e) => onUpdateSettings({ ...settings, perspective3D: e.target.checked })}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Tab 2: Audio & Calibration */}
        {activeTab === 'AUDIO' && (
          <div className="space-y-5">
            {/* Music Volume */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-zinc-300 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                  Music Volume
                </label>
                <span className="font-mono text-zinc-300 font-bold">
                  {Math.round(settings.musicVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.musicVolume}
                onChange={(e) => handleMusicVolumeChange(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            {/* Hit Sound Effects Volume */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-zinc-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  Hit Sound Effects (SFX)
                </label>
                <span className="font-mono text-zinc-300 font-bold">
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
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Audio Latency Offset */}
            <div className="space-y-2 pt-2 border-t border-zinc-800">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-zinc-300">
                  Audio Latency Offset (Calibration)
                </label>
                <span className="font-mono text-emerald-400 font-bold bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                  {settings.audioOffsetMs > 0 ? `+${settings.audioOffsetMs}` : settings.audioOffsetMs} ms
                </span>
              </div>
              <input
                type="range"
                min="-150"
                max="150"
                step="5"
                value={settings.audioOffsetMs}
                onChange={(e) => handleAudioOffsetChange(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <p className="text-[11px] text-zinc-500">
                Adjust if notes feel early or late due to Bluetooth or browser audio latency.
              </p>

              {/* Tap calibration widget */}
              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 space-y-2">
                {!isCalibrating ? (
                  <button
                    onClick={startCalibration}
                    className="w-full py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200 flex items-center justify-center gap-1.5 transition"
                  >
                    <Play className="w-3 h-3 fill-current" /> Tap Calibration Metronome
                  </button>
                ) : (
                  <div className="text-center space-y-2">
                    <p className="text-xs text-amber-400 font-bold">
                      Tap {6 - calibrationTaps.length} more times to lock in rhythm!
                    </p>
                    <button
                      onClick={handleCalibrationTap}
                      className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-sm rounded-lg active:scale-95 transition shadow-md"
                    >
                      TAP HERE
                    </button>
                  </div>
                )}
                {calibrationFeedback && (
                  <p className="text-[11px] text-emerald-400 text-center font-medium">
                    {calibrationFeedback}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Controls & Keybinds */}
        {activeTab === 'KEYS' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-300">Presets:</span>
              <div className="flex items-center gap-1.5">
                {(['DFJK', 'ASKL', 'ARROWS'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPresetKeys(p)}
                    className="px-2.5 py-1 rounded bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-[10px] font-mono font-bold text-zinc-300 transition"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              {[0, 1, 2, 3].map((l) => {
                const label = settings.keyBindings.laneLabels[l];
                const isListening = listeningLane === l;
                const laneRole = ['LOW (Root)', 'MID (Vocal)', 'LEAD (Hook)', 'PEAK (High)'][l];
                return (
                  <div
                    key={l}
                    onClick={() => startKeyRemap(l)}
                    className={`p-3 rounded-xl border cursor-pointer transition flex flex-col items-center justify-center gap-1 ${
                      isListening
                        ? 'border-emerald-400 bg-emerald-500/20 animate-pulse'
                        : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
                    }`}
                  >
                    <span className="text-[9px] font-mono font-bold text-zinc-400">{laneRole}</span>
                    <span className="font-display font-black text-lg text-white">
                      {isListening ? '...' : label}
                    </span>
                    <span className="text-[9px] text-zinc-500">
                      {isListening ? 'Press key' : 'Click to remap'}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Mobile and touchscreen devices also feature 4 large tap zones right beneath the gameplay highway.
            </p>
          </div>
        )}

        {/* Done Button */}
        <button
          id="btn-done-settings"
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm flex items-center justify-center gap-1.5 transition shadow-lg shadow-emerald-500/10"
        >
          <Check className="w-4 h-4" /> Done
        </button>
      </div>
    </div>
  );
};
