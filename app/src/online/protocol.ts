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
  | { type: 'beginRound'; revision: number }
  | { type: 'answer'; revision: number; answer: string; round?: number }
  | { type: 'step'; revision: number; nodeId: string };

/** Host starts the shared round; the first connected member can stand in while the host is away. */
export function roundStarter(room: Pick<RoomSnapshot, 'hostId' | 'members'>) {
  return room.members.find(m => m.id === room.hostId && m.connected)
    ?? room.members.find(m => m.connected);
}

export interface Seat { code: string; token: string; memberId: string }
export type ServerMessage =
  | { type: 'snapshot'; room: RoomSnapshot }
  | { type: 'error'; message: string }
  | { type: 'replaced' }
  | { type: 'expired' };
