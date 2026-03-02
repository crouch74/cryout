type DeckSoundCue = 'press' | 'lift' | 'flip' | 'resolveCrisis' | 'resolveSystem' | 'settle';
type DeckSoundDeck = 'system' | 'resistance' | 'crisis';

let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === 'undefined') {
    return null;
  }

  const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextCtor();
  }

  return audioContext;
}

function getCueProfile(cue: DeckSoundCue, deckId: DeckSoundDeck) {
  const deckBase = {
    system: 126,
    resistance: 208,
    crisis: 164,
  }[deckId];

  switch (cue) {
    case 'press':
      return { frequency: deckBase, duration: 0.045, type: 'triangle' as OscillatorType, gain: 0.045 };
    case 'lift':
      return { frequency: deckBase * 1.12, duration: 0.06, type: 'sine' as OscillatorType, gain: 0.035 };
    case 'flip':
      return { frequency: deckBase * 1.48, duration: 0.08, type: 'triangle' as OscillatorType, gain: 0.03 };
    case 'resolveCrisis':
      return { frequency: 172, duration: 0.1, type: 'square' as OscillatorType, gain: 0.03 };
    case 'resolveSystem':
      return { frequency: 118, duration: 0.12, type: 'sawtooth' as OscillatorType, gain: 0.025 };
    case 'settle':
      return { frequency: deckBase * 0.86, duration: 0.07, type: 'sine' as OscillatorType, gain: 0.025 };
  }
}

export async function primeDeckAudio() {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  if (context.state === 'suspended') {
    try {
      await context.resume();
    } catch {
      // Ignore browser autoplay restrictions and fail silent.
    }
  }
}

export function playDeckCue(cue: DeckSoundCue, deckId: DeckSoundDeck, enabled: boolean) {
  if (!enabled) {
    return;
  }

  const context = getAudioContext();
  if (!context || context.state !== 'running') {
    return;
  }

  const profile = getCueProfile(cue, deckId);
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const now = context.currentTime;

  oscillator.type = profile.type;
  oscillator.frequency.setValueAtTime(profile.frequency, now);
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(profile.gain, now + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + profile.duration);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + profile.duration + 0.02);
}
