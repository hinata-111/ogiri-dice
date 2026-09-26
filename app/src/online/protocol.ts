import type { GameState } from '../game/state';

export interface RoomSnapshot {
  code: string;
  revision: number;
  gameRevision: number;
  hostId: string;
  members: { id: string; name: string; connected: boolean; playerId: number | null }[];
  game: GameState;
  deadline: number | null;
  expiresAt: number;
  serverNow: number;
  expired: boolean;
}

export type RoomCommand =
  | { type: 'start'; revision: number }
  | { type: 'answer'; revision: number; answer: string; round?: number }
  | { type: 'step'; revision: number; nodeId: string };

export interface Seat { code: string; token: string; memberId: string }
export type ServerMessage =
  | { type: 'snapshot'; room: RoomSnapshot }
  | { type: 'error'; message: string }
  | { type: 'replaced' }
  | { type: 'expired' };
