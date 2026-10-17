import { GameView } from './components/GameView';
import { AudioProvider } from './audio/AudioProvider';
import { OnlineGame } from "./online/OnlineGame";
import { useEffect, useMemo, useReducer, useState } from "react";
import { currentPlayer, gameReducer, initialState } from "./game/state";
import { pickRandomTopic } from "./game/topics";
import { pickDestination } from "./game/destination";
import { buildNodeMap, nextStepToward } from "./game/graph";
import { ANSWER_TIME_LIMIT_MS, ONLINE_ROUND_ANSWER_MS, ONLINE_RESULT_MS } from "./game/rules";
import mapData from "./data/map.json";
import topicsData from "./data/topics.json";
import type { MapNode, PlayerConfig, Topic } from "./game/types";
import { createEvaluator } from "./ai";
import { useCountdown } from "./hooks/useCountdown";
import { useLocalRound } from './hooks/useLocalRound';
import {
  ARRIVAL_MS, CAMERA_SETTLE_MS, CHALLENGE_INTRO_MS, CPU_SUBMIT_DELAY_MS, MOVE_STEP_MS,
} from "./ui/constants";
const nodes = (mapData as { nodes: MapNode[] }).nodes;
const topics = (topicsData as { topics: Topic[] }).topics;
const START_ID = "shinjuku";

function LocalGame({ onOnline }: { onOnline: () => void }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const evaluator = useMemo(() => createEvaluator(), []);
  const nodeMap = useMemo(() => buildNodeMap(nodes), []);
  const [cpuAnswer, setCpuAnswer] = useState<string | null>(null);
  const phase = state.phase;
  const player = state.players.length > 0 ? currentPlayer(state) : null;
  const isCpuTurn = player?.kind === "cpu";
  useLocalRound(state, evaluator, dispatch);
  // turnStart: カメラ移動を待ってお題
  useEffect(() => {
    if (phase.name !== "turnStart" || state.players.some(p => p.kind === 'human')) return;
    const t = setTimeout(() => {
      dispatch({ type: "BEGIN_ROUND", topic: pickRandomTopic(topics, state.usedTopicIds) });
    }, CAMERA_SETTLE_MS);
    return () => clearTimeout(t);
  }, [phase, state.usedTopicIds, state.players]);

  // challengeIntro: 告知後にチャレンジお題(赤は目標値1〜4)
  useEffect(() => {
    if (phase.name !== "challengeIntro" || !isCpuTurn) return;
    const t = setTimeout(() => {
      dispatch({
        type: "BEGIN_CHALLENGE",
        topic: pickRandomTopic(topics, state.usedTopicIds),
        target: phase.cellKind === "red" ? 1 + Math.floor(Math.random() * 4) : undefined,
      });
    }, CHALLENGE_INTRO_MS);
    return () => clearTimeout(t);
  }, [phase, state.usedTopicIds, isCpuTurn]);

  // CPU回答(メイン/チャレンジ共通)
  useEffect(() => {
    if (phase.name !== "awaitingAnswer" || !isCpuTurn || !player) return;
    let cancelled = false;
    let t: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      const answer = await evaluator.cpuAnswer(phase.topic.prompt, player.personality ?? "safe");
      if (cancelled) return;
      setCpuAnswer(answer);
      t = setTimeout(() => {
        setCpuAnswer(null);
        dispatch({ type: "SUBMIT_ANSWER", answer });
      }, CPU_SUBMIT_DELAY_MS);
    })();
    return () => { cancelled = true; if (t) clearTimeout(t); };
  }, [phase, isCpuTurn, player, evaluator]);

  // 採点
  useEffect(() => {
    if (phase.name !== "evaluating") return;
    let cancelled = false;
    evaluator.evaluate(phase.topic.prompt, phase.answer).then((result) => {
      if (!cancelled) dispatch({ type: "EVALUATED", result });
    });
    return () => { cancelled = true; };
  }, [phase, evaluator]);

  // CPU自動移動
  useEffect(() => {
    if (phase.name !== "moving" || !isCpuTurn || !player || !state.destinationId) return;
    const t = setTimeout(() => {
      dispatch({
        type: "STEP_TO",
        nodeId: nextStepToward(nodeMap, player.position, phase.cameFrom, state.destinationId!),
      });
    }, MOVE_STEP_MS * 1.5);
    return () => clearTimeout(t);
  }, [phase, isCpuTurn, player, state.destinationId, nodeMap]);

  // 到着演出→次目的地
  useEffect(() => {
    if (phase.name !== "arrival" || !isCpuTurn) return;
    const t = setTimeout(() => {
      dispatch({
        type: "ARRIVAL_DONE",
        nextDestinationId: pickDestination(nodes, [phase.nodeId]),
      });
    }, ARRIVAL_MS);
    return () => clearTimeout(t);
  }, [phase, isCpuTurn]);

  useEffect(() => {
    if (phase.name !== 'showingResult' || !isCpuTurn) return;
    const timer = setTimeout(() => dispatch({ type: 'PROCEED' }), ONLINE_RESULT_MS);
    return () => clearTimeout(timer);
  }, [phase, isCpuTurn]);

  const timerActive = phase.name === "awaitingAnswer" || phase.name === 'roundAnswering';
  const remaining = useCountdown(timerActive, phase.name === 'roundAnswering' ? ONLINE_ROUND_ANSWER_MS : ANSWER_TIME_LIMIT_MS, () =>
    dispatch({ type: phase.name === 'roundAnswering' ? 'CLOSE_ROUND' : 'TIME_UP' }),
  );

  const startGame = (players: PlayerConfig[]) =>
    dispatch({
      type: "START_GAME",
      simultaneous: true,
      players,
      nodes,
      startId: START_ID,
      destinationId: pickDestination(nodes, [START_ID]),
    });

  return <GameView state={state} dispatch={dispatch} remaining={remaining} cpuAnswer={cpuAnswer} startGame={startGame} onOnline={onOnline} canAct={phase.name === 'roundAnswering' || !isCpuTurn}/>;
}

function GameRouter() {
  const initialCode = new URLSearchParams(window.location.search).get('room') ?? '';
  const [online, setOnline] = useState(!!initialCode);
  return online ? <OnlineGame initialCode={initialCode} onExit={() => {
    const url = new URL(window.location.href); url.searchParams.delete('room');
    window.history.replaceState({}, '', url); setOnline(false);
  }} /> : <LocalGame onOnline={() => setOnline(true)} />;
}

export default function App() { return <AudioProvider><GameRouter/></AudioProvider>; }
import './presentation/presentation.css';
