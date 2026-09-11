import { GameDifficulty, Note, Track } from '../types';

/**
 * Melodic Rhythm Game Chart Generator
 *
 * Rather than repetitive 4/4 drum loops, notes track the SONG'S MELODY:
 * lead vocals, iconic synthesizer hooks, saxophone solos, guitar riffs,
 * and brass drops.
 *
 * 4-Lane Pitch Orientation:
 * - Lane 0 (Red / Key D):    Low pitch / Root melody / Bass riffs / Low vocal register
 * - Lane 1 (Purple / Key F): Mid-low pitch / Vocal verse body / Chord anchors
 * - Lane 2 (Cyan / Key J):   Mid-high pitch / Chorus lead hooks / Expressive vocal leaps
 * - Lane 3 (Emerald / Key K): High pitch / Peak vocal notes / Soaring synth leads / Sax cries / Octave accents
 *
 * Movement across lanes follows melodic pitch contours:
 * - Ascending melodic lines: climb left-to-right (0 -> 1 -> 2 -> 3)
 * - Descending resolutions: flow right-to-left (3 -> 2 -> 1 -> 0)
 * - Arpeggio waves & leaps: bounce across lanes (0 -> 2 -> 3 or 1 -> 3 -> 2)
 * - Trills & vibratos: alternate between adjacent lanes (2 <-> 3)
 */

interface MelodicStep {
  beat: number; // 0.0 to 3.99 relative to measure start
  lane: number; // 0, 1, 2, 3
  accent?: boolean; // chord or peak accent
  difficultyMin?: GameDifficulty; // only for MEDIUM or HARD
}

type PhrasePattern = MelodicStep[];

// Helper to hash string to deterministic number
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

/**
 * Curated Song Melodic Phrasing Signatures
 * Each track has custom melodic motifs matching its actual iconic vocal, synth,
 * sax, or guitar hooks.
 */
function getCuratedMelodicPattern(
  trackId: string,
  sectionType: 'INTRO' | 'VERSE' | 'BUILD' | 'CHORUS' | 'SOLO',
  phraseMeasure: number // 0, 1, 2, 3 in a 4-bar phrase
): PhrasePattern | null {
  // 1. THE MIDNIGHT - SUNSET (Iconic 80s Saxophone & Neon Synth Lead)
  if (trackId === 'track-synth-1' || /sunset/i.test(trackId)) {
    if (sectionType === 'CHORUS') {
      // The World-Famous Saxophone Melody Hook
      if (phraseMeasure === 0) {
        // High soaring sax cry: leap to Lane 3 with sustained hook and stepdown
        return [
          { beat: 0.0, lane: 1 },
          { beat: 0.75, lane: 2 },
          { beat: 1.0, lane: 3, accent: true }, // Sax peak cry!
          { beat: 2.0, lane: 3 },
          { beat: 2.75, lane: 2 },
          { beat: 3.5, lane: 1 },
        ];
      } else if (phraseMeasure === 1) {
        // Answering melodic sweep
        return [
          { beat: 0.0, lane: 0 },
          { beat: 0.75, lane: 1 },
          { beat: 1.5, lane: 2 },
          { beat: 2.25, lane: 3, accent: true },
          { beat: 3.0, lane: 2 },
        ];
      } else if (phraseMeasure === 2) {
        // Expressive saxophone trill / vibrato pattern
        return [
          { beat: 0.0, lane: 2 },
          { beat: 0.5, lane: 3, accent: true },
          { beat: 1.0, lane: 2 },
          { beat: 1.5, lane: 3 },
          { beat: 2.0, lane: 2 },
          { beat: 2.75, lane: 3, accent: true },
          { beat: 3.5, lane: 2 },
        ];
      } else {
        // Big phrase resolution cascade
        return [
          { beat: 0.0, lane: 3, accent: true },
          { beat: 0.5, lane: 2 },
          { beat: 1.0, lane: 1 },
          { beat: 1.5, lane: 0 },
          { beat: 2.5, lane: 1 },
          { beat: 3.25, lane: 2 },
        ];
      }
    } else if (sectionType === 'BUILD') {
      // Ascending staircase build-up
      return [
        { beat: 0.0, lane: 0 },
        { beat: 1.0, lane: 1 },
        { beat: 2.0, lane: 2 },
        { beat: 2.5, lane: 2 },
        { beat: 3.0, lane: 3, accent: true },
        { beat: 3.5, lane: 3 },
      ];
    } else if (sectionType === 'SOLO') {
      // Sax solo fast sweeps
      return [
        { beat: 0.0, lane: 1 },
        { beat: 0.5, lane: 2 },
        { beat: 1.0, lane: 3, accent: true },
        { beat: 1.5, lane: 2 },
        { beat: 2.0, lane: 1 },
        { beat: 2.5, lane: 2 },
        { beat: 3.0, lane: 3, accent: true },
        { beat: 3.5, lane: 2 },
      ];
    } else {
      // Verse: Dreamy synth arpeggio pulse
      return phraseMeasure % 2 === 0
        ? [
            { beat: 0.0, lane: 1 },
            { beat: 0.75, lane: 2 },
            { beat: 1.5, lane: 1 },
            { beat: 2.5, lane: 0 },
            { beat: 3.25, lane: 1 },
          ]
        : [
            { beat: 0.0, lane: 1 },
            { beat: 1.0, lane: 2 },
            { beat: 2.0, lane: 3, accent: true },
            { beat: 3.0, lane: 2 },
          ];
    }
  }

  // 2. AVICII - THE NIGHTS (Folk-Pop Vocal Cadence into Bouncy Brass Anthem Drop)
  if (trackId === 'track-edm-1' || /the nights/i.test(trackId)) {
    if (sectionType === 'CHORUS') {
      // Iconic Brass Anthem Hook ("Da-da-da-dum, da-da-da-dum")
      if (phraseMeasure === 0 || phraseMeasure === 2) {
        return [
          { beat: 0.0, lane: 1 },
          { beat: 0.5, lane: 2 },
          { beat: 1.0, lane: 3, accent: true }, // Jump to peak brass stab
          { beat: 2.0, lane: 3 },
          { beat: 2.5, lane: 2 },
          { beat: 3.0, lane: 1 },
        ];
      } else if (phraseMeasure === 1) {
        return [
          { beat: 0.0, lane: 1 },
          { beat: 0.5, lane: 2 },
          { beat: 1.0, lane: 3, accent: true },
          { beat: 1.75, lane: 3 },
          { beat: 2.5, lane: 2 },
          { beat: 3.25, lane: 3, accent: true },
        ];
      } else {
        // Resolving flourish
        return [
          { beat: 0.0, lane: 2 },
          { beat: 0.5, lane: 3, accent: true },
          { beat: 1.0, lane: 2 },
          { beat: 1.5, lane: 1 },
          { beat: 2.25, lane: 0 },
          { beat: 3.0, lane: 2, accent: true },
        ];
      }
    } else if (sectionType === 'BUILD') {
      // "When you get older your wild heart will live for younger days..."
      return [
        { beat: 0.0, lane: 0 },
        { beat: 0.75, lane: 1 },
        { beat: 1.5, lane: 2 },
        { beat: 2.25, lane: 3, accent: true },
        { beat: 2.75, lane: 2 },
        { beat: 3.25, lane: 3, accent: true },
      ];
    } else {
      // Verse: Vocal syllables ("Once upon a younger year...")
      return phraseMeasure % 2 === 0
        ? [
            { beat: 0.0, lane: 1 },
            { beat: 0.5, lane: 1 },
            { beat: 1.0, lane: 2 },
            { beat: 1.75, lane: 2 },
            { beat: 2.5, lane: 1 },
            { beat: 3.25, lane: 0 },
          ]
        : [
            { beat: 0.0, lane: 1 },
            { beat: 0.75, lane: 2 },
            { beat: 1.5, lane: 3, accent: true },
            { beat: 2.25, lane: 2 },
            { beat: 3.0, lane: 1 },
          ];
    }
  }

  // 3. KAVINSKY - NIGHTCALL (Dark French Electro Vocoder & Piano)
  if (trackId === 'track-synth-2' || /nightcall/i.test(trackId)) {
    if (sectionType === 'CHORUS') {
      // Soaring female vocal ("There's something inside you, it's hard to explain...")
      return phraseMeasure % 2 === 0
        ? [
            { beat: 0.0, lane: 2 },
            { beat: 1.0, lane: 3, accent: true },
            { beat: 2.0, lane: 3 },
            { beat: 2.75, lane: 2 },
            { beat: 3.5, lane: 1 },
          ]
        : [
            { beat: 0.0, lane: 1 },
            { beat: 0.75, lane: 2 },
            { beat: 1.5, lane: 3, accent: true },
            { beat: 2.5, lane: 2 },
            { beat: 3.25, lane: 1 },
          ];
    } else if (sectionType === 'SOLO' || sectionType === 'BUILD') {
      // Hypnotic French Electro 8th-note Synth Arpeggio
      return [
        { beat: 0.0, lane: 0 },
        { beat: 0.5, lane: 1 },
        { beat: 1.0, lane: 2 },
        { beat: 1.5, lane: 3, accent: true },
        { beat: 2.0, lane: 2 },
        { beat: 2.5, lane: 1 },
        { beat: 3.0, lane: 0 },
        { beat: 3.5, lane: 1 },
      ];
    } else {
      // Verse: Robotic Vocoder Staccato Steps ("I'm giving you a nightcall...")
      return [
        { beat: 0.0, lane: 0 },
        { beat: 1.0, lane: 0 },
        { beat: 2.0, lane: 1 },
        { beat: 2.75, lane: 2, accent: true },
        { beat: 3.5, lane: 1 },
      ];
    }
  }

  // 4. MARTIN GARRIX - ANIMALS (Minimal Syncopated Pluck Drop & Rising Pitch Build)
  if (trackId === 'track-edm-2' || /animals/i.test(trackId)) {
    if (sectionType === 'CHORUS') {
      // The World-Famous Animals Syncopated Pluck Drop!
      if (phraseMeasure === 0 || phraseMeasure === 2) {
        return [
          { beat: 0.0, lane: 1 },
          { beat: 0.5, lane: 1 },
          { beat: 1.0, lane: 2, accent: true },
          // Rest on beat 1.5
          { beat: 2.0, lane: 2 },
          { beat: 2.5, lane: 1 },
          { beat: 3.25, lane: 0 },
        ];
      } else if (phraseMeasure === 1) {
        return [
          { beat: 0.0, lane: 1 },
          { beat: 0.5, lane: 1 },
          { beat: 1.0, lane: 2, accent: true },
          { beat: 2.0, lane: 3, accent: true },
          { beat: 2.5, lane: 2 },
          { beat: 3.25, lane: 1 },
        ];
      } else {
        // 4th-bar melodic cascade fill
        return [
          { beat: 0.0, lane: 0 },
          { beat: 0.5, lane: 1 },
          { beat: 1.0, lane: 2 },
          { beat: 1.5, lane: 3, accent: true },
          { beat: 2.25, lane: 2 },
          { beat: 3.0, lane: 1 },
        ];
      }
    } else if (sectionType === 'BUILD') {
      // Accelerating pitch riser
      return [
        { beat: 0.0, lane: 0 },
        { beat: 0.5, lane: 0 },
        { beat: 1.0, lane: 1 },
        { beat: 1.5, lane: 1 },
        { beat: 2.0, lane: 2 },
        { beat: 2.5, lane: 2 },
        { beat: 3.0, lane: 3, accent: true },
        { beat: 3.5, lane: 3, accent: true },
      ];
    } else {
      // Melodic intro / breakdown
      return [
        { beat: 0.0, lane: 1 },
        { beat: 1.5, lane: 2 },
        { beat: 2.5, lane: 1 },
        { beat: 3.25, lane: 0 },
      ];
    }
  }

  // 5. FISHER - LOSING IT (Tech House Sliding Horn Siren & Bouncing Bass)
  if (trackId === 'track-edm-3' || /losing it/i.test(trackId)) {
    if (sectionType === 'CHORUS') {
      // Siren horn sweep and bouncing tech house motif
      if (phraseMeasure === 0 || phraseMeasure === 2) {
        return [
          { beat: 0.0, lane: 0 },
          { beat: 0.5, lane: 1 },
          { beat: 1.0, lane: 2 },
          { beat: 1.5, lane: 3, accent: true }, // Siren horn peak!
          { beat: 2.5, lane: 0 },
          { beat: 3.25, lane: 1 },
        ];
      } else {
        return [
          { beat: 0.0, lane: 1 },
          { beat: 0.75, lane: 2 },
          { beat: 1.5, lane: 3, accent: true },
          { beat: 2.25, lane: 2 },
          { beat: 3.0, lane: 0 },
        ];
      }
    } else {
      return [
        { beat: 0.0, lane: 0 },
        { beat: 1.0, lane: 1 },
        { beat: 2.0, lane: 0 },
        { beat: 2.75, lane: 2 },
        { beat: 3.5, lane: 1 },
      ];
    }
  }

  // 6. SCANDROID - NEO-TOKYO (Cyberpunk Guitar Shredding & Synth Riffs)
  if (trackId === 'track-synth-3' || /neo-tokyo/i.test(trackId)) {
    if (sectionType === 'CHORUS') {
      // Guitar shredding lead riffs
      if (phraseMeasure === 0) {
        return [
          { beat: 0.0, lane: 0 },
          { beat: 0.5, lane: 2 },
          { beat: 1.0, lane: 3, accent: true },
          { beat: 1.75, lane: 2 },
          { beat: 2.5, lane: 1 },
          { beat: 3.25, lane: 0 },
        ];
      } else if (phraseMeasure === 1) {
        return [
          { beat: 0.0, lane: 0 },
          { beat: 0.5, lane: 1 },
          { beat: 1.0, lane: 2 },
          { beat: 1.5, lane: 3, accent: true },
          { beat: 2.25, lane: 2 },
          { beat: 3.0, lane: 3, accent: true },
        ];
      } else if (phraseMeasure === 2) {
        // Fast 16th guitar shred cascade
        return [
          { beat: 0.0, lane: 2 },
          { beat: 0.5, lane: 3, accent: true },
          { beat: 1.0, lane: 2 },
          { beat: 1.5, lane: 1 },
          { beat: 2.0, lane: 2 },
          { beat: 2.5, lane: 3, accent: true },
          { beat: 3.25, lane: 2 },
        ];
      } else {
        // Power chord accents
        return [
          { beat: 0.0, lane: 0 },
          { beat: 0.5, lane: 2, accent: true },
          { beat: 1.5, lane: 1 },
          { beat: 2.0, lane: 3, accent: true },
          { beat: 3.0, lane: 2 },
        ];
      }
    } else {
      return [
        { beat: 0.0, lane: 0 },
        { beat: 0.75, lane: 1 },
        { beat: 1.5, lane: 2 },
        { beat: 2.5, lane: 1 },
        { beat: 3.25, lane: 0 },
      ];
    }
  }

  // 7. LO-FI TRACKS (Coffee Morning, Rainy Night In Tokyo, Snowman)
  if (
    trackId.startsWith('track-lofi') ||
    /lofi|coffee morning|rainy night|snowman/i.test(trackId)
  ) {
    if (phraseMeasure === 0) {
      // Warm Rhodes piano chord entrance
      return [
        { beat: 0.0, lane: 0 },
        { beat: 0.75, lane: 1 },
        { beat: 1.75, lane: 2 },
        { beat: 3.0, lane: 1 },
      ];
    } else if (phraseMeasure === 1) {
      // Gentle pentatonic melody flourish with relaxed breathing pause
      return [
        { beat: 0.0, lane: 1 },
        { beat: 0.75, lane: 2 },
        { beat: 1.5, lane: 3, accent: true },
        { beat: 2.5, lane: 2 },
      ];
    } else if (phraseMeasure === 2) {
      // Counter-melody phrasing
      return [
        { beat: 0.5, lane: 1 },
        { beat: 1.25, lane: 2 },
        { beat: 2.25, lane: 1 },
        { beat: 3.25, lane: 0 },
      ];
    } else {
      // Gentle resolving turnaround
      return [
        { beat: 0.0, lane: 2 },
        { beat: 1.0, lane: 1 },
        { beat: 2.0, lane: 0 },
        { beat: 3.0, lane: 1 },
      ];
    }
  }

  // 8. DRUM & BASS TRACKS (Witchcraft, Solar System, Watercolour)
  if (
    trackId.startsWith('track-dnb') ||
    /witchcraft|solar system|watercolour/i.test(trackId)
  ) {
    if (sectionType === 'CHORUS') {
      // Rapid sweeping synth lead arpeggios
      if (phraseMeasure === 0 || phraseMeasure === 2) {
        return [
          { beat: 0.0, lane: 1 },
          { beat: 0.5, lane: 2 },
          { beat: 1.0, lane: 3, accent: true },
          { beat: 1.5, lane: 2 },
          { beat: 2.0, lane: 1 },
          { beat: 2.5, lane: 0 },
          { beat: 3.0, lane: 1 },
          { beat: 3.5, lane: 2 },
        ];
      } else {
        return [
          { beat: 0.0, lane: 2 },
          { beat: 0.5, lane: 3, accent: true },
          { beat: 1.25, lane: 2 },
          { beat: 2.0, lane: 1 },
          { beat: 2.5, lane: 2 },
          { beat: 3.0, lane: 3, accent: true },
        ];
      }
    } else {
      return [
        { beat: 0.0, lane: 0 },
        { beat: 1.0, lane: 1 },
        { beat: 1.75, lane: 2 },
        { beat: 2.5, lane: 1 },
        { beat: 3.25, lane: 0 },
      ];
    }
  }

  return null;
}

/**
 * Procedural Melodic Engine for Any Custom / Searched Track
 * Deterministically constructs musical themes with motif variation,
 * human vocal breath pauses, and song section dynamics.
 */
function generateProceduralMelodicPattern(
  track: Track,
  sectionType: 'INTRO' | 'VERSE' | 'BUILD' | 'CHORUS' | 'SOLO',
  phraseMeasure: number // 0, 1, 2, 3
): PhrasePattern {
  const seed = hashString(`${track.artist}_${track.title}_${track.id || ''}`);

  // Determine scale feel from genre & key
  const isMajor =
    !track.key ||
    track.key.endsWith('M') ||
    track.key.includes('maj') ||
    track.key === 'C' ||
    track.key === 'G' ||
    track.key === 'D' ||
    track.key === 'F';

  // Seed-based melodic motif choices
  const motifChoice = (seed + phraseMeasure) % 4;

  if (sectionType === 'CHORUS') {
    // High-Energy Melodic Hook with Call-and-Response
    if (phraseMeasure === 0) {
      // Call: Catchy Hook Opening
      return isMajor
        ? [
            { beat: 0.0, lane: 1 },
            { beat: 0.75, lane: 2 },
            { beat: 1.5, lane: 3, accent: true }, // Peak hook!
            { beat: 2.5, lane: 2 },
            { beat: 3.25, lane: 1 },
          ]
        : [
            { beat: 0.0, lane: 0 },
            { beat: 0.5, lane: 2 },
            { beat: 1.0, lane: 3, accent: true },
            { beat: 2.0, lane: 2 },
            { beat: 2.75, lane: 1 },
            { beat: 3.5, lane: 0 },
          ];
    } else if (phraseMeasure === 1) {
      // Repeat: Reinforces familiar hook
      return [
        { beat: 0.0, lane: 1 },
        { beat: 0.75, lane: 2 },
        { beat: 1.5, lane: 3, accent: true },
        { beat: 2.25, lane: 3 },
        { beat: 3.0, lane: 2 },
      ];
    } else if (phraseMeasure === 2) {
      // Development: Melodic expansion / high jump
      return [
        { beat: 0.0, lane: 2 },
        { beat: 0.5, lane: 3, accent: true },
        { beat: 1.25, lane: 2 },
        { beat: 2.0, lane: 1 },
        { beat: 2.75, lane: 2 },
        { beat: 3.5, lane: 3, accent: true },
      ];
    } else {
      // Turnaround / Cadence: Resolution cascade into next phrase
      return [
        { beat: 0.0, lane: 3, accent: true },
        { beat: 0.5, lane: 2 },
        { beat: 1.0, lane: 1 },
        { beat: 1.5, lane: 0 },
        { beat: 2.25, lane: 1 },
        { beat: 3.0, lane: 2 },
      ];
    }
  } else if (sectionType === 'BUILD') {
    // Rising Staircase Tension Build
    return [
      { beat: 0.0, lane: 0 },
      { beat: 0.75, lane: 1 },
      { beat: 1.5, lane: 2 },
      { beat: 2.25, lane: 3, accent: true },
      { beat: 2.75, lane: 2 },
      { beat: 3.25, lane: 3, accent: true },
    ];
  } else if (sectionType === 'SOLO') {
    // Flowing Arpeggio Waves
    return [
      { beat: 0.0, lane: 0 },
      { beat: 0.5, lane: 1 },
      { beat: 1.0, lane: 2 },
      { beat: 1.5, lane: 3, accent: true },
      { beat: 2.0, lane: 2 },
      { beat: 2.5, lane: 1 },
      { beat: 3.0, lane: 2 },
      { beat: 3.5, lane: 3, accent: true },
    ];
  } else {
    // Verse / Intro: Conversational Vocal Pacing with Natural Pauses
    if (motifChoice === 0) {
      return [
        { beat: 0.0, lane: 1 },
        { beat: 0.75, lane: 1 },
        { beat: 1.5, lane: 2 },
        { beat: 2.5, lane: 1 },
      ];
    } else if (motifChoice === 1) {
      return [
        { beat: 0.0, lane: 0 },
        { beat: 0.75, lane: 1 },
        { beat: 1.75, lane: 2 },
        { beat: 3.0, lane: 1 },
      ];
    } else if (motifChoice === 2) {
      return [
        { beat: 0.5, lane: 1 },
        { beat: 1.25, lane: 2 },
        { beat: 2.0, lane: 3, accent: true },
        { beat: 3.0, lane: 2 },
      ];
    } else {
      return [
        { beat: 0.0, lane: 2 },
        { beat: 0.75, lane: 1 },
        { beat: 1.5, lane: 0 },
        { beat: 2.5, lane: 1 },
      ];
    }
  }
}

/**
 * Main Chart Generator Entry Point
 * Generates an engaging, melody-following rhythm game note chart.
 */
export function generateChart(
  track: Track,
  difficulty: GameDifficulty,
  customIntroDelay?: number
): Note[] {
  const bpm = track.tempo > 40 && track.tempo < 240 ? track.tempo : 120;
  const beatDuration = 60 / bpm; // duration of one quarter note beat (seconds)
  const measureDuration = beatDuration * 4; // duration of one 4/4 measure (seconds)
  const baseOffset = track.beatOffset ?? 0.18; // phase alignment to track downbeat

  // Total song length cap for game balance (30s to 180s)
  const totalSeconds = Math.min(Math.max(track.durationMs / 1000, 30), 180);

  // Runway before first note reaches hit line (typically 1.5s to 2.0s)
  const minIntroDelay = customIntroDelay !== undefined ? customIntroDelay : 1.6;
  const startMeasure = Math.max(1, Math.ceil(minIntroDelay / measureDuration));
  const totalMeasures = Math.floor((totalSeconds - 0.5) / measureDuration);

  const notes: Note[] = [];
  let noteId = 1;

  const addNote = (lane: number, time: number) => {
    if (time >= totalSeconds || time < 0.2) return;
    notes.push({
      id: noteId++,
      lane,
      time: parseFloat(time.toFixed(3)),
    });
  };

  for (let measure = startMeasure; measure < totalMeasures; measure++) {
    const measureStartTime = baseOffset + measure * measureDuration;
    const phraseMeasure = measure % 4; // 0: Call, 1: Repeat, 2: Development, 3: Turnaround
    const songProgress = measure / totalMeasures;

    // Musical Song Sections:
    // 0.00 - 0.15: Intro
    // 0.15 - 0.38: Verse 1
    // 0.38 - 0.48: Pre-Chorus / Build
    // 0.48 - 0.72: Chorus 1 (Main Hook)
    // 0.72 - 0.82: Bridge / Solo
    // 0.82 - 1.00: Final Chorus / Climax
    let sectionType: 'INTRO' | 'VERSE' | 'BUILD' | 'CHORUS' | 'SOLO';
    if (songProgress < 0.15) {
      sectionType = 'INTRO';
    } else if (songProgress < 0.38) {
      sectionType = 'VERSE';
    } else if (songProgress < 0.48) {
      sectionType = 'BUILD';
    } else if (songProgress < 0.72) {
      sectionType = 'CHORUS';
    } else if (songProgress < 0.82) {
      sectionType = 'SOLO';
    } else {
      sectionType = 'CHORUS';
    }

    // 0. Check for AI-Generated Chart Blueprint
    let phrase: PhrasePattern | null = null;
    if (track.aiChart && track.aiChart.sectionMotifs && Array.isArray(track.aiChart.sectionMotifs)) {
      const aiSection = track.aiChart.sectionMotifs.find((m) => m.section === sectionType);
      if (aiSection && Array.isArray(aiSection.measures) && aiSection.measures.length > 0) {
        const mIdx = phraseMeasure % aiSection.measures.length;
        const aiMeasure = aiSection.measures[mIdx];
        if (Array.isArray(aiMeasure) && aiMeasure.length > 0) {
          phrase = aiMeasure.map((s) => ({
            beat: Math.max(0, Math.min(3.9, Number(s.beat) || 0)),
            lane: Math.max(0, Math.min(3, Math.floor(Number(s.lane) || 0))),
            accent: Boolean(s.accent),
          }));
        }
      }
    }

    // 1. Check for curated handcrafted melodic patterns
    if (!phrase) {
      phrase = getCuratedMelodicPattern(track.id, sectionType, phraseMeasure);
    }

    // 2. If not a curated track, generate procedural melodic phrasing from song DNA
    if (!phrase) {
      phrase = generateProceduralMelodicPattern(track, sectionType, phraseMeasure);
    }

    // 3. Render Notes based on selected Game Difficulty
    for (let i = 0; i < phrase.length; i++) {
      const step = phrase[i];
      const noteTime = measureStartTime + step.beat * beatDuration;

      if (difficulty === 'EASY') {
        // In EASY mode: Focus on primary melodic downbeats and accents (skip rapid passing notes)
        const isAnchorBeat = step.beat % 1.0 === 0;
        if (isAnchorBeat || step.accent || i === 0) {
          addNote(step.lane, noteTime);
        }
      } else if (difficulty === 'MEDIUM') {
        // In MEDIUM mode: Play full melodic phrasing with syncopations
        addNote(step.lane, noteTime);
      } else {
        // In HARD mode: Full melody plus occasional octave or harmonized chord hits on accents
        addNote(step.lane, noteTime);

        // On climactic chorus accents, add a harmonized 2nd lane note (dual note hit!)
        if (step.accent && (sectionType === 'CHORUS' || sectionType === 'SOLO')) {
          const harmonizedLane = (step.lane + 2) % 4;
          // Only add chord on clean quarter beat positions
          if (step.beat % 1.0 === 0) {
            addNote(harmonizedLane, noteTime);
          }
        }
      }
    }
  }

  // Deduplicate any notes with identical lane & time (within 35ms)
  const uniqueNotes: Note[] = [];
  notes.sort((a, b) => a.time - b.time);

  for (const n of notes) {
    const isDuplicate = uniqueNotes.some(
      (existing) => existing.lane === n.lane && Math.abs(existing.time - n.time) < 0.035
    );
    if (!isDuplicate) {
      uniqueNotes.push(n);
    }
  }

  return uniqueNotes;
}
