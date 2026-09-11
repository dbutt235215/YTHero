import React from 'react';
import { Music, Trophy, Settings, Volume2, VolumeX, Play, Flame } from 'lucide-react';
import { Track } from '../types';

interface NavbarProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  onOpenLeaderboard: () => void;
  onOpenSettings: () => void;
  onOpenPlaylistSelector: () => void;
  onStartGame: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTrack,
  isPlaying,
  onOpenLeaderboard,
  onOpenSettings,
  onOpenPlaylistSelector,
  onStartGame,
  isMuted,
  onToggleMute,
}) => {
  return (
    <header className="w-full border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={onOpenPlaylistSelector}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 via-red-600 to-rose-700 flex items-center justify-center shadow-lg shadow-red-600/30 text-white border border-red-500/30">
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-black tracking-tight text-lg text-white">
                YOUTUBE <span className="text-red-500">HERO</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/30">
                Music Arcade
              </span>
            </div>
            <p className="text-xs text-zinc-400 hidden sm:block">
              Rhythm arcade powered by YouTube Music
            </p>
          </div>
        </div>

        {/* Center: Current track indicator if chosen */}
        {currentTrack && !isPlaying && (
          <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 max-w-sm">
            <img
              src={currentTrack.albumArt}
              alt={currentTrack.title}
              className="w-7 h-7 rounded-full object-cover ring-1 ring-red-500/50"
            />
            <div className="truncate text-xs">
              <span className="font-semibold text-zinc-200 block truncate">{currentTrack.title}</span>
              <span className="text-zinc-400 block truncate">{currentTrack.artist}</span>
            </div>
            <div className="ml-auto pl-2 flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-mono text-[10px] font-bold">
                {currentTrack.tempo} BPM
              </span>
              <button
                id="btn-nav-play-track"
                onClick={onStartGame}
                className="px-2.5 py-1 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1 transition shadow-sm shadow-red-600/20"
              >
                <Play className="w-3 h-3 fill-current" /> Play
              </button>
            </div>
          </div>
        )}

        {/* Right side navigation buttons */}
        <div className="flex items-center gap-2">
          <button
            id="btn-nav-playlists"
            onClick={onOpenPlaylistSelector}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition"
            title="Choose or Import Song"
          >
            <Music className="w-4 h-4 text-red-400" />
            <span className="hidden sm:inline">Songs</span>
          </button>

          <button
            id="btn-nav-leaderboard"
            onClick={onOpenLeaderboard}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition"
            title="Global Leaderboard"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Leaderboard</span>
          </button>

          <button
            id="btn-nav-mute"
            onClick={onToggleMute}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            id="btn-nav-settings"
            onClick={onOpenSettings}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition"
            title="Game & Calibration Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
