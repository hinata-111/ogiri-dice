import { useReducer } from "react";
import { gameReducer, initialState } from "./game/state";
import boardData from "./data/board.json";
import type { BoardCell, PlayerConfig } from "./game/types";
import { TitleScreen } from "./components/TitleScreen";
import { SetupScreen } from "./components/SetupScreen";

const board = (boardData as { cells: BoardCell[] }).cells;

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  const startGame = (players: PlayerConfig[]) =>
    dispatch({ type: "START_GAME", players, board });

  return (
    <div className="stage">
      {state.phase.name === "title" && (
        <TitleScreen onStart={() => dispatch({ type: "SHOW_SETUP" })} />
      )}
      {state.phase.name === "setup" && <SetupScreen onSubmit={startGame} />}
      {state.phase.name === "turnStart" && (
        <div className="overlay">
          <div className="panel">ゲーム開始(盤面はTask 8で実装)</div>
        </div>
      )}
    </div>
  );
}
