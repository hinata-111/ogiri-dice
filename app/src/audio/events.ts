import type { GameState } from '../game/state';

export type SoundCue = 'select' | 'confirm' | 'depart' | 'topic' | 'tick' | 'roll' | 'score' | 'gain' | 'loss' | 'step' | 'arrival' | 'victory';
export type MusicScene = 'menu' | 'board' | 'thinking' | 'results';
export interface AudioPreferences { music: number; effects: number; muted: boolean }
export const defaultPreferences: AudioPreferences = { music: .35, effects: .65, muted: false };
export function normalizePreferences(value: unknown): AudioPreferences {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const volume = (key: 'music' | 'effects') => typeof data[key] === 'number' && Number.isFinite(data[key]) ? Math.max(0, Math.min(1, data[key])) : defaultPreferences[key];
  return { music: volume('music'), effects: volume('effects'), muted: data.muted === true };
}

export function cuesForTransition(previous: GameState, next: GameState): SoundCue[] {
  const phase = next.phase;
  const changed = previous.phase.name !== phase.name;
  if (changed && phase.name === 'arrival') return ['arrival'];
  if (changed && phase.name === 'gameResult') return ['victory'];
  const cues: SoundCue[] = [];
  if (previous.players.some(p => next.players.some(n => n.id === p.id && n.position !== p.position))) cues.push('step');
  if (changed) {
    if (phase.name === 'turnStart') cues.push('depart');
    if (phase.name === 'awaitingAnswer') cues.push('topic');
    if (phase.name === 'showingResult') cues.push('roll');
    if (phase.name === 'challengeIntro') cues.push(phase.cellKind === 'blue' ? 'gain' : 'loss');
  }
  return cues;
}
