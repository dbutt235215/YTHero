import { HitJudgment, Track } from '../types';
import { youtubePlayer } from './youtubePlayer';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  // Track playback state
  private isPlaying = false;
  private startTime = 0;
  private pauseTime = 0;
  private audioOffsetSeconds = 0; // calibration offset
  private scheduledEvents: number[] = [];
  private audioElement: HTMLAudioElement | null = null;
  private audioSourceNode: MediaElementAudioSourceNode | null = null;
  private currentYouTubeVideoId: string | null = null;

  // Beat tracking for real-time visualizer
  private prevBassEnergy = 0;
  private beatFlash = 0;
  private simVisualizerTimer: number | null = null;

  constructor() {
    // Lazy AudioContext initialization on first user interaction
  }

  public init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();

      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.8;

      this.musicGain.connect(this.analyser);
      this.sfxGain.connect(this.masterGain);
      this.analyser.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolumes(musicVol: number, sfxVol: number) {
    if (this.musicGain) this.musicGain.gain.value = Math.max(0, Math.min(1, musicVol));
    if (this.sfxGain) this.sfxGain.gain.value = Math.max(0, Math.min(1, sfxVol));
    youtubePlayer.setVolume(musicVol);
  }

  public setAudioOffset(offsetMs: number) {
    this.audioOffsetSeconds = offsetMs / 1000;
  }

  public async startTrack(track: Track, startTimeOffset = 0) {
    this.init();
    if (!this.ctx) return;

    this.stopTrack();
    this.isPlaying = true;

    // 1. Check if YouTube video audio stream is available
    if (track.youtubeVideoId) {
      this.currentYouTubeVideoId = track.youtubeVideoId;
      this.startTime = this.ctx.currentTime - startTimeOffset;
      youtubePlayer.mountPlayer(track.youtubeVideoId);
      youtubePlayer.setVolume(this.musicGain?.gain.value ?? 0.85);
      youtubePlayer.setVisible(true);

      // Listen for errors (e.g. video blocked or offline) to fall back to procedural synth
      const errorHandler = (err: any) => {
        console.warn('YouTube audio error, activating backup synthesizer:', err);
        youtubePlayer.removeErrorListener(errorHandler);
        if (this.isPlaying && this.currentYouTubeVideoId === track.youtubeVideoId) {
          this.scheduleProceduralMusic(track, this.getCurrentTime());
        }
      };
      youtubePlayer.addErrorListener(errorHandler);

      // Start BPM-synced simulated visualizer waves for YouTube audio
      const bpm = track.tempo > 40 && track.tempo < 240 ? track.tempo : 120;
      const intervalMs = (60 / bpm) * 1000;
      this.simVisualizerTimer = window.setInterval(() => {
        if (this.isPlaying) {
          this.beatFlash = 1.0;
        }
      }, intervalMs);
      return;
    }

    youtubePlayer.setVisible(false);

    // 2. Check if real preview URL is available
    if (track.previewUrl) {
      try {
        this.audioElement = new Audio(track.previewUrl);
        this.audioElement.crossOrigin = 'anonymous';
        this.audioElement.currentTime = startTimeOffset;

        if (!this.audioSourceNode && this.audioElement) {
          this.audioSourceNode = this.ctx.createMediaElementSource(this.audioElement);
          this.audioSourceNode.connect(this.musicGain!);
        }

        await this.audioElement.play();
        this.startTime = this.ctx.currentTime - startTimeOffset;
        return;
      } catch (e) {
        console.warn('Preview audio playback failed or CORS blocked, falling back to procedural synthesizer:', e);
      }
    }

    // 3. Procedural Synth Music Engine matching track tempo and vibe
    this.startTime = this.ctx.currentTime - startTimeOffset;
    this.scheduleProceduralMusic(track, startTimeOffset);
  }

  public pauseTrack() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this.currentYouTubeVideoId) {
      youtubePlayer.pause();
    }
    if (this.audioElement) {
      this.audioElement.pause();
    }
    this.clearScheduledEvents();
    if (this.ctx) {
      this.pauseTime = this.ctx.currentTime - this.startTime;
    }
  }

  public resumeTrack(track: Track) {
    if (this.isPlaying) return;
    if (this.currentYouTubeVideoId) {
      this.isPlaying = true;
      youtubePlayer.play();
      return;
    }
    this.startTrack(track, this.pauseTime);
  }

  public stopTrack() {
    this.isPlaying = false;
    this.pauseTime = 0;
    if (this.currentYouTubeVideoId) {
      youtubePlayer.stop();
      this.currentYouTubeVideoId = null;
    }
    if (this.simVisualizerTimer) {
      clearInterval(this.simVisualizerTimer);
      this.simVisualizerTimer = null;
    }
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      this.audioElement = null;
    }
    this.clearScheduledEvents();
  }

  public getCurrentTime(): number {
    if (!this.isPlaying) return this.pauseTime;
    if (this.currentYouTubeVideoId) {
      const ytTime = youtubePlayer.getCurrentTime();
      if (ytTime > 0) {
        return Math.max(0, ytTime + this.audioOffsetSeconds);
      }
      // If YouTube is buffering or initializing, use AudioContext clock as smooth fallback
      if (this.ctx) {
        return Math.max(0, this.ctx.currentTime - this.startTime + this.audioOffsetSeconds);
      }
      return 0;
    }
    if (!this.ctx) return this.pauseTime;
    return Math.max(0, this.ctx.currentTime - this.startTime + this.audioOffsetSeconds);
  }

  public isTrackPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * Procedural synth music: kicks, snares, hats, bassline, and arpeggios
   * calibrated strictly to track tempo (BPM).
   */
  private scheduleProceduralMusic(track: Track, startOffset: number) {
    if (!this.ctx || !this.musicGain) return;

    const bpm = track.tempo > 40 && track.tempo < 240 ? track.tempo : 120;
    const beatSec = 60 / bpm;
    const totalDuration = Math.min(Math.max(track.durationMs / 1000, 30), 180);
    const scheduleWindowSec = 4.0; // schedule in rolling batches

    // Base root frequencies for key notes (C, D, E, F, G, A, B)
    const roots: Record<string, number> = {
      C: 130.81,
      D: 146.83,
      E: 164.81,
      F: 174.61,
      G: 196.00,
      A: 220.00,
      B: 246.94,
    };
    const keyLetter = (track.key && roots[track.key.toUpperCase()[0]]) ? track.key.toUpperCase()[0] : 'F';
    const rootFreq = roots[keyLetter] || 174.61;

    let nextBeatIndex = Math.floor(startOffset / beatSec);

    const scheduler = () => {
      if (!this.isPlaying || !this.ctx) return;

      const currentAudioTime = this.ctx.currentTime;
      const songElapsed = currentAudioTime - this.startTime;

      if (songElapsed >= totalDuration) {
        this.stopTrack();
        return;
      }

      while (nextBeatIndex * beatSec < songElapsed + scheduleWindowSec) {
        const beatTime = this.startTime + (nextBeatIndex * beatSec);
        const beatInMeasure = nextBeatIndex % 4; // 0, 1, 2, 3

        if (beatTime >= currentAudioTime) {
          // 1. Kick drum on beats 0 and 2 (or four on floor if energetic)
          const fourOnFloor = track.energy > 0.65;
          if (beatInMeasure === 0 || beatInMeasure === 2 || (fourOnFloor && (beatInMeasure === 1 || beatInMeasure === 3))) {
            this.playKick(beatTime);
          }

          // 2. Snare / Clap on beats 1 and 3
          if (beatInMeasure === 1 || beatInMeasure === 3) {
            this.playSnare(beatTime);
          }

          // 3. Hi-Hat on off-beats
          this.playHiHat(beatTime + beatSec * 0.5);
          if (track.energy > 0.5) {
            this.playHiHat(beatTime);
          }

          // 4. Bassline
          const bassFreq = rootFreq / 2;
          const bassStep = nextBeatIndex % 8;
          const pitchMultiplier = [1, 1, 1.2, 1.2, 1.33, 1.33, 0.89, 1][bassStep] || 1;
          this.playBass(beatTime, bassFreq * pitchMultiplier, beatSec * 0.7);

          // 5. Synth arpeggio note
          const arpPitches = [1, 1.25, 1.5, 1.75, 2.0, 1.5, 1.25, 1];
          const arpFreq = rootFreq * (arpPitches[nextBeatIndex % 8] || 1);
          this.playSynthLead(beatTime, arpFreq, beatSec * 0.35);
        }

        nextBeatIndex++;
      }

      const timerId = window.setTimeout(scheduler, 500);
      this.scheduledEvents.push(timerId);
    };

    scheduler();
  }

  private playKick(time: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.12);

    gain.gain.setValueAtTime(0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + 0.18);
  }

  private playSnare(time: number) {
    if (!this.ctx || !this.musicGain) return;
    // Tone body
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, time);
    osc.frequency.exponentialRampToValueAtTime(100, time + 0.08);
    oscGain.gain.setValueAtTime(0.4, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    osc.connect(oscGain);
    oscGain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.12);

    // Noise burst
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1200, time);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.musicGain);

    noise.start(time);
    noise.stop(time + 0.15);
  }

  private playHiHat(time: number) {
    if (!this.ctx || !this.musicGain) return;
    const bufferSize = this.ctx.sampleRate * 0.04;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(6500, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    noise.start(time);
    noise.stop(time + 0.04);
  }

  private playBass(time: number, freq: number, duration: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, time);
    filter.frequency.exponentialRampToValueAtTime(180, time + duration);

    gain.gain.setValueAtTime(0.32, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + duration);
  }

  private playSynthLead(time: number, freq: number, duration: number) {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + duration);
  }

  private clearScheduledEvents() {
    this.scheduledEvents.forEach((id) => clearTimeout(id));
    this.scheduledEvents = [];
  }

  /**
   * Sound effect for user keystroke/lane hit.
   * Calibrated to be subtle, soft, and unobtrusive so it provides clean tactile
   * feedback without drowning out the song audio or drum groove.
   */
  public playHitSound(judgment: HitJudgment, lane: number = 1) {
    this.init();
    if (!this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Subtle pitch scaling by lane (low to high across the 4 lanes)
    const lanePitches = [0.85, 1.0, 1.25, 1.5];
    const pitchScale = lanePitches[lane] ?? 1.0;

    switch (judgment) {
      case 'PERFECT': {
        // Soft, crisp subtle acoustic tap with musical chime tuned to lane
        osc.type = 'sine';
        const baseFreq = 680 * pitchScale;
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, now + 0.035);
        gain.gain.setValueAtTime(0.065, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.04);
        break;
      }
      case 'GREAT': {
        // Gentle warm subtle tap
        osc.type = 'triangle';
        const baseFreq = 520 * pitchScale;
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, now + 0.03);
        gain.gain.setValueAtTime(0.045, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.035);
        break;
      }
      case 'GOOD': {
        // Soft low tap
        osc.type = 'triangle';
        const baseFreq = 360 * pitchScale;
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, now + 0.025);
        gain.gain.setValueAtTime(0.03, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.03);
        break;
      }
      case 'MISS': {
        // Unobtrusive muffled low thud
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.04);
        gain.gain.setValueAtTime(0.035, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.05);
        break;
      }
    }
  }

  /**
   * Returns frequency data and normalized beat pulse intensity (0 to 1)
   */
  public getVisualizerData(): { frequencies: Uint8Array; beatPulse: number } {
    if (!this.analyser) {
      return { frequencies: new Uint8Array(32), beatPulse: 0 };
    }

    const buffer = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(buffer);

    // Sum the lowest 4 frequency bins (kick / sub-bass 20Hz-200Hz)
    let bassSum = 0;
    for (let i = 0; i < 4; i++) {
      bassSum += buffer[i] || 0;
    }
    const currentBassEnergy = bassSum / (4 * 255);

    // Peak threshold detection
    if (currentBassEnergy > this.prevBassEnergy + 0.15 && currentBassEnergy > 0.4) {
      this.beatFlash = 1.0;
    } else {
      this.beatFlash = Math.max(0, this.beatFlash - 0.08);
    }
    this.prevBassEnergy = currentBassEnergy;

    return {
      frequencies: buffer.slice(0, 32),
      beatPulse: this.beatFlash,
    };
  }
}

// Export singleton audio engine
export const audioEngine = new AudioEngine();
