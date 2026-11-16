export interface MusicTrack {
  id: string;
  title: string;
  titleAr: string;
  artist: string;
  genre: 'trending' | 'arabic' | 'chill' | 'upbeat' | 'pop' | 'acoustic';
  genreLabelAr: string;
  duration: number; // in seconds
  coverGradient: string;
  bpm: number;
  scaleType: 'oriental' | 'lofi' | 'pop' | 'acoustic' | 'ambient';
}

export const MUSIC_TRACKS: MusicTrack[] = [
  {
    id: 'track-1',
    title: 'نسمات الصباح',
    titleAr: 'نسمات الصباح',
    artist: 'أوتار الأندلس',
    genre: 'arabic',
    genreLabelAr: 'عربي أصيل',
    duration: 30,
    coverGradient: 'from-amber-500 via-rose-500 to-purple-600',
    bpm: 96,
    scaleType: 'oriental',
  },
  {
    id: 'track-2',
    title: 'Lofi Sunset Chill',
    titleAr: 'غروب هادئ (لو-فاي)',
    artist: 'Chillwave Beats',
    genre: 'chill',
    genreLabelAr: 'روقان & لو-فاي',
    duration: 25,
    coverGradient: 'from-indigo-600 via-purple-600 to-pink-500',
    bpm: 82,
    scaleType: 'lofi',
  },
  {
    id: 'track-3',
    title: 'Golden Hour Vibes',
    titleAr: 'الساعة الذهبية',
    artist: 'Soundwave Collective',
    genre: 'trending',
    genreLabelAr: 'الرائج الآن',
    duration: 30,
    coverGradient: 'from-amber-400 via-orange-500 to-red-500',
    bpm: 110,
    scaleType: 'pop',
  },
  {
    id: 'track-4',
    title: 'حكاية ليل',
    titleAr: 'حكاية ليل',
    artist: 'فيروزيات عصرية',
    genre: 'arabic',
    genreLabelAr: 'عربي طربي',
    duration: 28,
    coverGradient: 'from-teal-500 via-emerald-600 to-cyan-600',
    bpm: 88,
    scaleType: 'oriental',
  },
  {
    id: 'track-5',
    title: 'Upbeat Energy',
    titleAr: 'طاقة وحماس',
    artist: 'Dynamic Flow',
    genre: 'upbeat',
    genreLabelAr: 'حماسي',
    duration: 20,
    coverGradient: 'from-fuchsia-600 via-rose-500 to-amber-400',
    bpm: 124,
    scaleType: 'pop',
  },
  {
    id: 'track-6',
    title: 'Coffee & Books',
    titleAr: 'قهوة الصباح',
    artist: 'Acoustic Morning',
    genre: 'acoustic',
    genreLabelAr: 'أكوستيك هادئ',
    duration: 30,
    coverGradient: 'from-yellow-600 via-amber-700 to-stone-800',
    bpm: 78,
    scaleType: 'acoustic',
  },
  {
    id: 'track-7',
    title: 'Midnight City Lights',
    titleAr: 'أضواء المدينة',
    artist: 'Synthwave Dreams',
    genre: 'trending',
    genreLabelAr: 'الرائج الآن',
    duration: 26,
    coverGradient: 'from-blue-600 via-indigo-600 to-purple-800',
    bpm: 105,
    scaleType: 'ambient',
  },
  {
    id: 'track-8',
    title: 'نسائم البحر',
    titleAr: 'نسائم البحر',
    artist: 'شاطئ الأحلام',
    genre: 'chill',
    genreLabelAr: 'روقان',
    duration: 30,
    coverGradient: 'from-cyan-400 via-blue-500 to-indigo-600',
    bpm: 80,
    scaleType: 'ambient',
  },
];

/**
 * Synthesize gentle harmonious musical audio using standard Web Audio API.
 * Returns a stop callback.
 */
let activeAudioCtx: AudioContext | null = null;
let activeStopCallback: (() => void) | null = null;

export function stopAnyActiveMusicPreview(): void {
  if (activeStopCallback) {
    try {
      activeStopCallback();
    } catch {
      // ignore
    }
    activeStopCallback = null;
  }
}

export function playMusicPreview(track: MusicTrack, onEnd?: () => void): () => void {
  stopAnyActiveMusicPreview();

  if (typeof window === 'undefined') {
    return () => {};
  }

  const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtxClass) {
    return () => {};
  }

  try {
    const ctx = new AudioCtxClass();
    activeAudioCtx = ctx;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.2, ctx.currentTime);
    masterGain.connect(ctx.destination);

    // Chords / notes frequency tables
    const scales: Record<string, number[][]> = {
      oriental: [
        [220, 261.63, 311.13, 392], // D minor Hijaz vibe
        [196, 246.94, 293.66, 392],
        [174.61, 220, 261.63, 349.23],
        [220, 277.18, 329.63, 440],
      ],
      lofi: [
        [261.63, 329.63, 392, 493.88], // Cmaj7
        [220, 261.63, 329.63, 392], // Am7
        [174.61, 220, 261.63, 329.63], // Fmaj7
        [196, 246.94, 293.66, 349.23], // G7
      ],
      pop: [
        [261.63, 329.63, 392, 523.25], // C
        [196, 246.94, 293.66, 392], // G
        [220, 261.63, 329.63, 440], // Am
        [174.61, 220, 261.63, 349.23], // F
      ],
      acoustic: [
        [196, 246.94, 293.66, 392], // G
        [164.81, 220, 261.63, 329.63], // Em
        [174.61, 220, 261.63, 349.23], // F
        [146.83, 220, 293.66, 440], // Dm
      ],
      ambient: [
        [220, 329.63, 440, 659.25],
        [174.61, 261.63, 349.23, 523.25],
        [196, 293.66, 392, 587.33],
        [146.83, 220, 293.66, 440],
      ],
    };

    const chordProgression = scales[track.scaleType] || scales.lofi;
    const beatInterval = 60 / track.bpm;
    const totalBars = 4;
    let isStopped = false;
    const oscillators: OscillatorNode[] = [];

    let startTime = ctx.currentTime + 0.05;

    // Schedule 4 bars of soothing chords
    chordProgression.forEach((chord, barIndex) => {
      const barStartTime = startTime + barIndex * (beatInterval * 4);

      chord.forEach((freq, noteIndex) => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();

        osc.type = track.scaleType === 'oriental' ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, barStartTime);

        // Gentle envelope
        const noteStart = barStartTime + (noteIndex * 0.04);
        noteGain.gain.setValueAtTime(0, noteStart);
        noteGain.gain.linearRampToValueAtTime(0.08, noteStart + 0.15);
        noteGain.gain.exponentialRampToValueAtTime(0.001, barStartTime + (beatInterval * 3.8));

        osc.connect(noteGain);
        noteGain.connect(masterGain);

        osc.start(noteStart);
        osc.stop(barStartTime + (beatInterval * 4));
        oscillators.push(osc);
      });
    });

    const stopAudio = () => {
      if (isStopped) return;
      isStopped = true;
      try {
        oscillators.forEach((osc) => {
          try {
            osc.stop();
          } catch {
            // ignore
          }
        });
        masterGain.gain.setValueAtTime(0, ctx.currentTime);
        ctx.close().catch(() => {});
      } catch {
        // ignore
      }
      if (activeAudioCtx === ctx) activeAudioCtx = null;
      if (activeStopCallback === stopAudio) activeStopCallback = null;
    };

    activeStopCallback = stopAudio;

    const timer = setTimeout(() => {
      stopAudio();
      onEnd?.();
    }, (totalBars * 4 * beatInterval + 0.5) * 1000);

    return () => {
      clearTimeout(timer);
      stopAudio();
    };
  } catch (err) {
    console.warn('Audio preview notice:', err);
    return () => {};
  }
}
