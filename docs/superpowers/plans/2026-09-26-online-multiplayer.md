# Online Multiplayer Implementation Plan

> Execute with executing-plans and test-driven-development, in the approved current workspace. Do not commit or publish without authorization.

**Goal:** 離れた2〜4人が各自のスマホで部屋に入り、同じ対戦を最後まで遊べる。

**Architecture:** Durable Object per room; existing gameReducer remains the only game-state writer. Persist room metadata and absolute deadlines, broadcast authoritative snapshots over authenticated WebSockets. React renders snapshots and emits only allowed commands.

**Tech Stack:** React, TypeScript, Vitest, Cloudflare Workers/Durable Objects.

## Task 1: Room domain (RED → GREEN)

- Create `worker/src/roomModel.test.ts`, then `worker/src/roomModel.ts`.
- Create shared wire types in `app/src/online/protocol.ts`; constants in `app/src/game/rules.ts`.
- Test create/join/capacity/start authorization; active-player actions; stale/duplicate revisions; server deadlines; disconnection and host transfer; expiration; late evaluations; final results.
- Command: `cd worker; npm test -- src/roomModel.test.ts`. Observe missing implementation failure, implement, require green.
- Inject clock and randomness through arguments; never import React in game logic.

## Task 2: Worker transport and evaluation (RED → GREEN)

- Add Worker evaluator tests and implementation using existing Evaluator interface and prompts.
- Add `worker/src/room.ts`, route `/api/rooms` and `/api/rooms/:code/*` in `worker/src/index.ts`.
- Add DO SQLite binding/migration to `worker/wrangler.toml` and JSON support to tsconfig.
- Persist before broadcasting; serialize async mutations; authenticate sockets before snapshots. Reject old sockets after reconnect. Enforce payload size and command rate bounds.
- Integration tests use real workerd via Miniflare to create a room, connect two clients, play, reject unauthorized actions, reconnect and exercise alarms/storage.
- Commands: `cd worker; npm test`, `npm run typecheck`, `npx wrangler deploy --dry-run`.

## Task 3: Smartphone UI (RED → GREEN)

- Extract existing rendering into `app/src/components/GameView.tsx` without changing local effects.
- Add `app/src/online/OnlineGame.tsx`, session hook/client, styles and tests.
- Add title entry, invite URL parsing, room code input, waiting room, clipboard fallback, connection status, leave/reconnect, spectator controls and server-time countdown.
- Test title entry, lobby, active versus spectator control, disconnected input lock, stale snapshot handling and IME submission.
- Commands: `cd app; npm test`, `npm run build`, `npm run lint`.

## Task 4: End-to-end verification and delivery

- Start Vite and Wrangler with explicit mock evaluation on loopback; exercise separate browser sessions at mobile viewport sizes.
- Check shared topic/results/positions, active player input, 15-second timeout, disconnect/reconnect and room exit. Check a complete game using the same authoritative model plus real transport tests.
- Document exact public deployment configuration, secret handling, mock setup and outstanding public-device validation in `docs/online-multiplayer.md`.
- Independently inspect final diff and preserve pre-existing untracked documents. Public URL and cross-network phone verification are separate from local proof.
