import { useLayoutEffect, useMemo, useRef } from 'react';
import { currentPlayer, type GameState, type GameAction } from '../game/state';
import { buildNodeMap } from '../game/graph';
import { ANSWER_TIME_LIMIT_MS, ONLINE_ROUND_ANSWER_MS, WIN_MONEY } from '../game/rules';
import { pickRandomTopic } from '../game/topics';
import { pickDestination } from '../game/destination';
import topicsData from '../data/topics.json';
import type { PlayerConfig, Topic } from '../game/types';
import { useViewportHeight } from '../hooks/useViewportHeight';
import { TokyoBoard } from './map/TokyoBoard';
import { TitleScreen } from './TitleScreen';
import { SetupScreen } from './SetupScreen';
import { TopicCard } from './TopicCard';
import { AnswerInput } from './AnswerInput';
import { ResultOverlay } from './ResultOverlay';
import { ChallengeIntro } from './ChallengeIntro';
import { ArrivalOverlay } from './ArrivalOverlay';
import { GameResultScreen } from './GameResultScreen';
import { GameAudio } from '../audio/GameAudio';
import { PlayerToken } from '../presentation/StageArt';
import { playerColors } from '../presentation/palette';
interface Props {
  state: GameState; dispatch: (action: GameAction) => void;
  remaining: number; cpuAnswer: string | null;
  startGame?: (players: PlayerConfig[]) => void; onOnline?: () => void;
  online?: boolean; canAct?: boolean; isMyTurn?: boolean; onExit?: () => void; connected?: boolean;
  playerId?: number | null;
}
export function GameView({ state, dispatch, remaining, cpuAnswer, startGame, onOnline, online = false, canAct = true, isMyTurn = canAct, onExit, connected = true, playerId = null }: Props) {
  useViewportHeight();
  const stage = useRef<HTMLDivElement>(null);
  const phase = state.phase;
  const shared = state.sharedRound;
  const answerEntries = shared?.entries.filter(e => online ? e.playerId === playerId : state.players.find(p => p.id === e.playerId)?.kind === 'human') ?? [];
  const nodes = state.nodes;
  const topics = topicsData.topics as Topic[];
  const player = state.players.length ? currentPlayer(state) : null;
  const isCpuTurn = player?.kind === 'cpu';
  const nodeMap = useMemo(() => buildNodeMap(nodes), [nodes]);
  const timerActive = phase.name === 'awaitingAnswer' && (!isCpuTurn || online);
  useLayoutEffect(() => {
    const target = ['.answer-form input:not([readonly]):not(:disabled)', '.overlay .primary:not(:disabled)', '.setup-footer .primary', '.title-screen .primary', '.result-body', '.answer-window', '.tokyo-cell-move']
      .map(selector => stage.current?.querySelector<HTMLElement>(selector)).find(Boolean);
    target?.focus({ preventScroll: true });
  }, [phase.name, state.currentPlayerIndex, player?.position, canAct]);
  const inGame = !["title", "setup"].includes(phase.name);
  const destination = state.destinationId ? (nodeMap.get(state.destinationId) ?? null) : null;
  const stateClass =
    phase.name === "evaluating" || phase.name === 'roundEvaluating' ? " state-evaluating"
    : phase.name === "showingResult" || phase.name === 'roundResults' ? " state-result"
    : "";

  return (
    <div className={`stage${stateClass} ${online?'is-online':'is-local'}`} data-phase={phase.name} ref={stage}>
      <GameAudio state={state} remaining={remaining} connected={connected}/>
      <div className="game-layer">
      {inGame&&!online&&<div className="journey-topbar" aria-hidden="true"><strong>大喜利ダイス</strong><span>東京の劇場をめぐる</span></div>}
      {inGame && (
        <div inert={phase.name!=='moving'}>
          <TokyoBoard state={state} canAct={canAct} onStep={(nodeId) => dispatch({ type: "STEP_TO", nodeId })} />
        </div>
      )}

      {phase.name === "title" && (
        <TitleScreen onStart={() => dispatch({ type: "SHOW_SETUP" })} onOnline={onOnline} />
      )}
      {phase.name === "setup" && startGame && <SetupScreen onSubmit={startGame} />}

      {phase.name === "turnStart" && <div className="overlay turn-overlay"><section className="panel turn-panel" key={`${state.round}:${player?.id}`}><span className="turn-ticket">第{state.round}周{!state.simultaneous && ` · ${(player?.id??0)+1}番`}</span><PlayerToken color={playerColors[(player?.id??0)%4]} number={state.simultaneous ? undefined : (player?.id??0)+1}/><p className="eyebrow">さあ、ひとボケいこう！</p><h2>{state.simultaneous ? 'みんなで同じお題に挑戦！' : `${player?.name}の番！`}</h2><p>目指すは <b>{destination?.name}</b>。次の出番を目指そう。</p>{!online&&state.players.some(p => p.kind === 'human') ? <button className="primary" onClick={()=>dispatch({type:state.simultaneous ? 'BEGIN_ROUND' : 'BEGIN_TURN',topic:pickRandomTopic(topics,state.usedTopicIds)})}>お題を見る</button> : <p className="event-note">まもなくお題を発表します</p>}</section></div>}

      {shared && (phase.name === 'roundAnswering' || phase.name === 'roundEvaluating' || phase.name === 'roundResults') && (
        <section className={`answer-window shared-round-window ${phase.name === 'roundResults' ? 'shared-result-window' : ''}`} tabIndex={-1} aria-label="全員共通のお題">
          <div className="answer-heading"><span>第{state.round}問 · {phase.name === 'roundResults' ? 'みんなの回答発表' : 'みんなで回答'}</span>{phase.name === 'roundAnswering' && <strong className={remaining <= 5000 ? 'urgent' : ''}>あと {Math.ceil(remaining / 1000)} 秒</strong>}</div>
          <div className="answer-topic"><TopicCard topic={shared.topic} judging={phase.name === 'roundEvaluating'} context={{ kind: 'main' }}/></div>
          {phase.name === 'roundAnswering' && <>
            <div className="timer-bar"><div className="fill" style={{ width: `${Math.max(0, Math.min(100, remaining / ONLINE_ROUND_ANSWER_MS * 100))}%` }}/></div>
            <p className="shared-round-status" role="status">{shared.entries.filter(e => e.submitted).length} / {state.players.length}人が提出済み</p>
            <div className="shared-answer-inputs">{answerEntries.map(myEntry => <section key={myEntry.playerId} aria-label={`${state.players.find(p => p.id === myEntry.playerId)?.name}の回答欄`}>
            {!online && answerEntries.length > 1 && <strong>{state.players.find(p => p.id === myEntry.playerId)?.name}</strong>}
            {myEntry.submitted ? <p>回答を提出しました。みんなの回答を待っています。</p> : <AnswerInput
              key={`round:${state.round}:${myEntry.playerId}`} preserveDraft maxLength={120} cpuAnswer={null} disabled={!canAct || remaining <= 0}
              onSubmit={answer => dispatch({ type: 'SUBMIT_ROUND_ANSWER', round: state.round, playerId: myEntry.playerId, answer })}/>}</section>)}</div></>}
          {phase.name === 'roundEvaluating' && <p role="status">みんなの回答を採点しています…</p>}
          {phase.name === 'roundResults' && <>
            <ol className="shared-round-results" aria-label="全員の回答と歩数">{shared.entries.map(e => <li key={e.playerId}>
              <div><strong>P{e.playerId + 1} · {state.players.find(p => p.id === e.playerId)?.name}</strong><b>{e.result?.score}点 <span> / {e.result?.score}マス</span></b></div>
              <p>{e.submitted ? e.answer : '未回答'}</p><small>放送作家　{e.result?.comment}{e.result?.fallback && '（代替スコア）'}</small>
            </li>)}</ol><p>プレイヤー1から順に移動します。まもなく自動で進みます。</p>
          </>}
        </section>
      )}

      {(phase.name === "awaitingAnswer" || phase.name === "evaluating") && (
        <section className="answer-window" tabIndex={-1} aria-label="お題と回答">
          <div className="answer-heading"><span>{player?.name}のお題</span>{timerActive&&<strong className={remaining<=5000?'urgent':''}>あと {Math.ceil(remaining/1000)} 秒</strong>}</div>
          <div className="answer-topic"><TopicCard
              topic={phase.topic}
              judging={phase.name === "evaluating"}
              context={phase.context}
            /></div>
          {timerActive && (
            <div className="timer-bar">
              <div className="fill" style={{ width: `${(remaining / ANSWER_TIME_LIMIT_MS) * 100}%` }} />
            </div>
          )}
          {phase.name==='awaitingAnswer' && (!online || isMyTurn) && <AnswerInput
            key={`${state.round}:${state.currentPlayerIndex}:${phase.topic.id}:${phase.context.kind}`}
            preserveDraft={online}
            maxLength={online ? 120 : 100}
            disabled={!canAct}
            cpuAnswer={phase.name === "awaitingAnswer" && isCpuTurn ? (cpuAnswer ?? "…") : null}
            onSubmit={(answer) => dispatch({ type: "SUBMIT_ANSWER", answer })}
          />}
          {phase.name==='awaitingAnswer' && online && !isMyTurn && <p>{player?.name} が回答中です</p>}
          {phase.name==='evaluating'&&<p className="submitted-answer">{phase.answer}</p>}
        </section>
      )}

      {phase.name === "challengeIntro" && <ChallengeIntro cellKind={phase.cellKind} onBegin={online || isCpuTurn ? undefined : ()=>dispatch({type:'BEGIN_CHALLENGE',topic:pickRandomTopic(topics,state.usedTopicIds),target:1+Math.floor(Math.random()*4)})} />}

      {phase.name === "showingResult" && player && (
        <ResultOverlay
          topicPrompt={phase.topic.prompt}
          result={phase.result}
          answer={phase.answer}
          playerName={player.name}
          playerId={player.id}
          context={phase.context}
          moneyDelta={phase.moneyDelta}
              money={player.money}
          onProceed={online ? undefined : () => dispatch({ type: "PROCEED" })}
          onRetry={online ? undefined : () => dispatch({ type: "RE_EVALUATE" })}
        />
      )}

      {phase.name === "arrival" && destination && (
        <ArrivalOverlay name={nodeMap.get(phase.nodeId)?.name ?? ""} television={nodeMap.get(phase.nodeId)?.kind === 'tv'} money={player!.money} onContinue={online || isCpuTurn ? undefined : ()=>dispatch({type:'ARRIVAL_DONE',nextDestinationId:pickDestination(nodes,[phase.nodeId])})} />
      )}

      {phase.name === "gameResult" && (
        <GameResultScreen
          players={state.players}
          bestAnswers={state.bestAnswers}
          winnerId={state.winnerId}
          winMoney={WIN_MONEY}
          onRestart={online ? onExit ?? (() => {}) : () => dispatch({ type: "RESTART" })}
        />
      )}
      </div>
    </div>
  );
}
