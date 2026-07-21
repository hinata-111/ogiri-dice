import { useEffect, useMemo, useReducer, useState } from "react";
import { currentPlayer, gameReducer, initialState } from "./game/state";
import { pickRandomTopic } from "./game/topics";
import { pickDestination } from "./game/destination";
import { buildNodeMap, moveOptions, nextStepToward } from "./game/graph";
import { ANSWER_TIME_LIMIT_MS, MAX_ROUNDS, WIN_MONEY } from "./game/rules";
import mapData from "./data/map.json";
import topicsData from "./data/topics.json";
import type { MapNode, PlayerConfig, Topic } from "./game/types";
import { createEvaluator } from "./ai";
import { useCountdown } from "./hooks/useCountdown";
import {
  ARRIVAL_MS, CAMERA_SETTLE_MS, CHALLENGE_INTRO_MS, CPU_SUBMIT_DELAY_MS, MOVE_STEP_MS,
} from "./ui/constants";
import { TitleScreen } from "./components/TitleScreen";
import { SetupScreen } from "./components/SetupScreen";
import { IsoMapView } from "./components/IsoMapView";
import { Hud } from "./components/Hud";
import { TopicCard } from "./components/TopicCard";
import { AnswerInput } from "./components/AnswerInput";
import { MoveControls } from "./components/MoveControls";
import { ResultOverlay } from "./components/ResultOverlay";
import { ChallengeIntro } from "./components/ChallengeIntro";
import { ArrivalOverlay } from "./components/ArrivalOverlay";
import { GameResultScreen } from "./components/GameResultScreen";

const nodes = (mapData as { nodes: MapNode[] }).nodes;
const topics = (topicsData as { topics: Topic[] }).topics;
const START_ID = "shinjuku";

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const evaluator = useMemo(() => createEvaluator(), []);
  const nodeMap = useMemo(() => buildNodeMap(nodes), []);
  const [cpuAnswer, setCpuAnswer] = useState<string | null>(null);
  const phase = state.phase;
  const player = state.players.length > 0 ? currentPlayer(state) : null;
  const isCpuTurn = player?.kind === "cpu";

  // turnStart: カメラ移動を待ってお題
  useEffect(() => {
    if (phase.name !== "turnStart") return;
    const t = setTimeout(() => {
      dispatch({ type: "BEGIN_TURN", topic: pickRandomTopic(topics, state.usedTopicIds) });
    }, CAMERA_SETTLE_MS);
    return () => clearTimeout(t);
  }, [phase, state.usedTopicIds]);

  // challengeIntro: 告知後にチャレンジお題(赤は目標値1〜4)
  useEffect(() => {
    if (phase.name !== "challengeIntro") return;
    const t = setTimeout(() => {
      dispatch({
        type: "BEGIN_CHALLENGE",
        topic: pickRandomTopic(topics, state.usedTopicIds),
        target: phase.cellKind === "red" ? 1 + Math.floor(Math.random() * 4) : undefined,
      });
    }, CHALLENGE_INTRO_MS);
    return () => clearTimeout(t);
  }, [phase, state.usedTopicIds]);

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
    if (phase.name !== "arrival") return;
    const t = setTimeout(() => {
      dispatch({
        type: "ARRIVAL_DONE",
        nextDestinationId: pickDestination(nodes, [phase.nodeId]),
      });
    }, ARRIVAL_MS);
    return () => clearTimeout(t);
  }, [phase]);

  const timerActive = phase.name === "awaitingAnswer" && !isCpuTurn;
  const remaining = useCountdown(timerActive, ANSWER_TIME_LIMIT_MS, () =>
    dispatch({ type: "TIME_UP" }),
  );

  const startGame = (players: PlayerConfig[]) =>
    dispatch({
      type: "START_GAME",
      players,
      nodes,
      startId: START_ID,
      destinationId: pickDestination(nodes, [START_ID]),
    });

  const inGame = !["title", "setup"].includes(phase.name);
  const destination = state.destinationId ? (nodeMap.get(state.destinationId) ?? null) : null;

  const stateClass =
    phase.name === "evaluating" ? " state-evaluating"
    : phase.name === "showingResult" ? " state-result"
    : "";

  return (
    <div className={`stage${stateClass}`}>
      {inGame && (
        <>
          <IsoMapView
            nodes={state.nodes}
            players={state.players}
            currentPlayerIndex={state.currentPlayerIndex}
            destinationId={state.destinationId}
          />
          <Hud
            players={state.players}
            currentPlayerIndex={state.currentPlayerIndex}
            destination={destination}
            round={state.round}
            maxRounds={MAX_ROUNDS}
          />
        </>
      )}

      {phase.name === "title" && (
        <TitleScreen onStart={() => dispatch({ type: "SHOW_SETUP" })} />
      )}
      {phase.name === "setup" && <SetupScreen onSubmit={startGame} />}

      {(phase.name === "awaitingAnswer" || phase.name === "evaluating") && (
        <>
          <div className="overlay transparent" style={{ justifyContent: "flex-start", paddingTop: "16vh" }}>
            <TopicCard
              topic={phase.topic}
              judging={phase.name === "evaluating"}
              context={phase.context}
            />
          </div>
          {timerActive && (
            <div className="timer-bar">
              <div className="fill" style={{ width: `${(remaining / ANSWER_TIME_LIMIT_MS) * 100}%` }} />
            </div>
          )}
          <AnswerInput
            disabled={phase.name === "evaluating"}
            cpuAnswer={phase.name === "awaitingAnswer" && isCpuTurn ? (cpuAnswer ?? "…") : null}
            onSubmit={(answer) => dispatch({ type: "SUBMIT_ANSWER", answer })}
          />
        </>
      )}

      {phase.name === "moving" && player && !isCpuTurn && (
        <MoveControls
          options={moveOptions(nodeMap, player.position, phase.cameFrom)}
          nodes={nodeMap}
          currentId={player.position}
          remaining={phase.remaining}
          onStep={(nodeId) => dispatch({ type: "STEP_TO", nodeId })}
        />
      )}

      {phase.name === "challengeIntro" && <ChallengeIntro cellKind={phase.cellKind} />}

      {phase.name === "showingResult" && player && (
        <ResultOverlay
          result={phase.result}
          answer={phase.answer}
          playerName={player.name}
          context={phase.context}
          moneyDelta={phase.moneyDelta}
          onProceed={() => dispatch({ type: "PROCEED" })}
          onRetry={() => dispatch({ type: "RE_EVALUATE" })}
        />
      )}

      {phase.name === "arrival" && destination && (
        <ArrivalOverlay name={nodeMap.get(phase.nodeId)?.name ?? ""} />
      )}

      {phase.name === "gameResult" && (
        <GameResultScreen
          players={state.players}
          bestAnswers={state.bestAnswers}
          winnerId={state.winnerId}
          winMoney={WIN_MONEY}
          onRestart={() => dispatch({ type: "RESTART" })}
        />
      )}
    </div>
  );
}
