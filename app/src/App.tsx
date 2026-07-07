import { useEffect, useMemo, useReducer, useState } from "react";
import { currentPlayer, gameReducer, initialState } from "./game/state";
import { pickRandomTopic } from "./game/topics";
import { ANSWER_TIME_LIMIT_MS } from "./game/rules";
import boardData from "./data/board.json";
import topicsData from "./data/topics.json";
import type { BoardCell, PlayerConfig, Topic } from "./game/types";
import { createEvaluator } from "./ai";
import { useCountdown } from "./hooks/useCountdown";
import {
  CAMERA_SETTLE_MS, CELL_EFFECT_MS, CPU_SUBMIT_DELAY_MS, MOVE_STEP_MS,
} from "./ui/constants";
import { TitleScreen } from "./components/TitleScreen";
import { SetupScreen } from "./components/SetupScreen";
import { BoardView } from "./components/BoardView";
import { Hud } from "./components/Hud";
import { TopicCard } from "./components/TopicCard";
import { AnswerInput } from "./components/AnswerInput";
import { ResultOverlay } from "./components/ResultOverlay";
import { CellEffectPopup } from "./components/CellEffectPopup";

const board = (boardData as { cells: BoardCell[] }).cells;
const topics = (topicsData as { topics: Topic[] }).topics;

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const evaluator = useMemo(() => createEvaluator(), []);
  const [cpuAnswer, setCpuAnswer] = useState<string | null>(null);
  const phase = state.phase;
  const player = state.players.length > 0 ? currentPlayer(state) : null;
  const isCpuTurn = player?.kind === "cpu";

  // 注: 各フェーズ副作用は素のuseEffect+クリーンアップで書く。
  // reducerが不正遷移のアクションを無視するため、StrictModeの二重実行や
  // 遅延タイマーの余剰発火があっても状態は壊れない。

  // turnStart: カメラ移動を待ってお題を引く
  useEffect(() => {
    if (phase.name !== "turnStart") return;
    const t = setTimeout(() => {
      dispatch({ type: "BEGIN_TURN", topic: pickRandomTopic(topics, state.usedTopicIds) });
    }, CAMERA_SETTLE_MS);
    return () => clearTimeout(t);
  }, [phase, state.usedTopicIds]);

  // awaitingAnswer(CPU): 回答生成→表示→自動送信
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
    return () => {
      cancelled = true;
      if (t) clearTimeout(t);
    };
  }, [phase, isCpuTurn, player, evaluator]);

  // evaluating: 採点実行
  useEffect(() => {
    if (phase.name !== "evaluating") return;
    let cancelled = false;
    evaluator.evaluate(phase.topic.prompt, phase.answer).then((result) => {
      if (!cancelled) dispatch({ type: "EVALUATED", result });
    });
    return () => { cancelled = true; };
  }, [phase, evaluator]);

  // moving: 歩数分の時間の後にMOVE_DONE
  useEffect(() => {
    if (phase.name !== "moving") return;
    const steps = phase.to - phase.from;
    const t = setTimeout(
      () => dispatch({ type: "MOVE_DONE" }),
      steps * MOVE_STEP_MS + 400,
    );
    return () => clearTimeout(t);
  }, [phase]);

  // cellEffect: ポップアップ表示後EFFECT_DONE
  useEffect(() => {
    if (phase.name !== "cellEffect") return;
    const t = setTimeout(() => dispatch({ type: "EFFECT_DONE" }), CELL_EFFECT_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // 人間の手番のみタイマー作動
  const timerActive = phase.name === "awaitingAnswer" && !isCpuTurn;
  const remaining = useCountdown(timerActive, ANSWER_TIME_LIMIT_MS, () =>
    dispatch({ type: "TIME_UP" }),
  );

  const startGame = (players: PlayerConfig[]) =>
    dispatch({ type: "START_GAME", players, board });

  const inGame = !["title", "setup"].includes(phase.name);
  const movingFrom = phase.name === "moving" ? phase.from : null;

  return (
    <div className="stage">
      {inGame && (
        <>
          <BoardView
            board={state.board}
            players={state.players}
            currentPlayerIndex={state.currentPlayerIndex}
            movingFrom={movingFrom}
          />
          <Hud players={state.players} currentPlayerIndex={state.currentPlayerIndex} />
        </>
      )}

      {phase.name === "title" && (
        <TitleScreen onStart={() => dispatch({ type: "SHOW_SETUP" })} />
      )}
      {phase.name === "setup" && <SetupScreen onSubmit={startGame} />}

      {(phase.name === "awaitingAnswer" || phase.name === "evaluating") && (
        <>
          <div className="overlay transparent" style={{ justifyContent: "flex-start", paddingTop: "18vh" }}>
            <TopicCard topic={phase.topic} judging={phase.name === "evaluating"} />
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

      {phase.name === "showingResult" && player && (
        <ResultOverlay
          result={phase.result}
          answer={phase.answer}
          playerName={player.name}
          onProceed={() => dispatch({ type: "PROCEED" })}
          onRetry={() => dispatch({ type: "RE_EVALUATE" })}
        />
      )}

      {phase.name === "cellEffect" && <CellEffectPopup delta={phase.delta} />}

      {phase.name === "gameResult" && (
        <div className="overlay">
          <div className="panel">全員ゴール！(リザルトはTask 10で実装)</div>
        </div>
      )}
    </div>
  );
}
