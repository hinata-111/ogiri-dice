import { createContext, useContext } from 'react';
import { defaultPreferences, type AudioPreferences, type MusicScene, type SoundCue } from './events';

export const AudioContext = createContext({
  play: (_cue: SoundCue, _score?: number) => {},
  setScene: (_scene: MusicScene) => {},
  unlock: () => {},
  preferences: defaultPreferences,
  updatePreferences: (_patch: Partial<AudioPreferences>) => {},
});
export const useAudio = () => useContext(AudioContext);
