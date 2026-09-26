import { useEffect, useRef, useState } from 'react';
import { GameView } from '../components/GameView';
import type { GameAction } from '../game/state';
import type { Seat } from './protocol';
import { loadSeat, roomRequest, seatKey, useRoom } from './useRoom';
import './online.css';
import { OnlineEntry, RoomLobby } from './RoomLobby';
import { useAudio } from '../audio/context';

export function OnlineGame({ initialCode, onExit }: { initialCode: string; onExit: () => void }) {
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [name, setName] = useState('');
  const [seat, setSeat] = useState<Seat | null>(() => loadSeat(initialCode.toUpperCase()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const session = useRoom(seat);
  const room = session.room;
  const { setScene, play } = useAudio();
  const previousRoom = useRef<typeof room>(null);
  const previouslyConnected = useRef(false);
  useEffect(() => { if (!room || room.game.phase.name === 'setup') setScene('menu'); }, [room, setScene]);
  const connected = session.status === 'connected';
  useEffect(() => {
    const previous = previousRoom.current;
    if (connected && previouslyConnected.current && previous && room) {
      if (previous.game.phase.name === 'setup' && room.game.phase.name !== 'setup') play('depart');
      else if (room.game.phase.name === 'setup' && room.members.some(m => !previous.members.some(p => p.id === m.id))) play('confirm');
    }
    previousRoom.current = room; previouslyConnected.current = connected;
  }, [room,connected,play]);
  const me = room?.members.find(m => m.id === seat?.memberId);
  const myTurn = !!me && me.playerId !== null && me.playerId === room?.game.players[room.game.currentPlayerIndex]?.id;
  const sharedAnswering = room?.game.phase.name === 'roundAnswering';
  const myEntry = room?.game.sharedRound?.entries.find(e => e.playerId === me?.playerId);
  const canAct = connected && !session.pending && (sharedAnswering ? !!myEntry && !myEntry.submitted : myTurn);

  const enter = async (create: boolean) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const next = await roomRequest(create ? '' : `/${code.trim().toUpperCase()}/join`, { name: name.trim() }) as Seat;
      try { localStorage.setItem(seatKey(next.code), JSON.stringify(next)); } catch { /* Play is possible without persistent storage. */ }
      const url = new URL(window.location.href); url.searchParams.set('room', next.code);
      window.history.replaceState({}, '', url); setCode(next.code); setSeat(next);
    } catch (e) { setError(e instanceof Error ? e.message : '部屋に接続できませんでした'); }
    finally { setBusy(false); }
  };
  const leave = async () => {
    if (seat) {
      // Exit locally even if the network is unavailable; the server has a grace deadline.
      try { await roomRequest(`/${seat.code}/leave`, { token: seat.token }); } catch { /* Server deadlines handle disconnect. */ }
      try { localStorage.removeItem(seatKey(seat.code)); } catch { /* Storage unavailable. */ }
    }
    setSeat(null); onExit();
  };
  const dispatch = (action: GameAction) => {
    if (!room || !canAct) return;
    if (action.type === 'SUBMIT_ROUND_ANSWER') session.send({ type: 'answer', answer: action.answer, round: action.round, revision: room.revision });
    if (action.type === 'SUBMIT_ANSWER') session.send({ type: 'answer', answer: action.answer, revision: room.revision });
    if (action.type === 'STEP_TO') session.send({ type: 'step', nodeId: action.nodeId, revision: room.revision });
  };
  const invite = new URL(window.location.href); invite.searchParams.set('room', seat?.code ?? code);
  const notice = {
    connecting: '接続中…', connected: '接続済み', disconnected: '通信が切れました。再接続しています…',
    replaced: '別の画面で接続されました', expired: '部屋の有効期限が切れました', rejected: '参加情報が無効です。部屋に入り直してください',
  }[session.status];

  if (!seat) return <OnlineEntry name={name} code={code} busy={busy} error={error} setName={setName} setCode={setCode} enter={enter} onExit={onExit}/>;

  return <div className="online-shell">
    <header className="online-status">
      <span>部屋 <strong>{seat.code}</strong> · {me?.name ?? '参加者'}</span>
      <span role="status">{notice}</span>
      <button className="ghost" onClick={leave}>退出</button>
    </header>
    {(error || session.error) && <p className="online-error" role="alert">{error || session.error}</p>}
    {!connected && <div className="online-connection"><p>{notice}</p>
      {!['expired', 'rejected'].includes(session.status) && <button className="primary" onClick={session.reconnect}>再接続する</button>}
      <button className="ghost" onClick={leave}>タイトルへ戻る</button>
    </div>}
    {room?.game.phase.name === 'setup' ? <RoomLobby room={room} memberId={seat.memberId} inviteUrl={invite.href} copied={copied} connected={connected} pending={session.pending}
      onCopy={async () => { try { await navigator.clipboard.writeText(invite.href); setCopied(true); } catch { setError('招待URLを選択してコピーしてください'); } }}
      onStart={() => session.send({ type: 'start', revision: room.revision })}/> : room && <div className="online-board">
      <div className="online-turn">{sharedAnswering ? `第${room.game.round}問 · 全員で回答` : room.game.phase.name === 'roundEvaluating' ? '全員の回答を採点中' : room.game.phase.name === 'roundResults' ? '今回の結果' : myTurn ? 'あなたの手番' : `${room.game.players[room.game.currentPlayerIndex]?.name ?? ''} の手番`}{room.deadline && ` · あと${Math.ceil(session.remaining / 1000)}秒`}{session.pending && ' · 送信中'}</div>
      <GameView state={room.game} dispatch={dispatch} remaining={session.remaining} cpuAnswer={null} online canAct={canAct} isMyTurn={myTurn} playerId={me?.playerId ?? null} onExit={leave} connected={connected}/>
    </div>}
  </div>;
}
