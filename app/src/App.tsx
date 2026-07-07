import { useReducer } from "react";
import { gameReducer, initialState } from "./game/state";
import boardData from "./data/board.json";
import type { BoardCell, PlayerConfig } from "./game/types";
import { TitleScreen } from "./components/TitleScreen";
import { SetupScreen } from "./components/SetupScreen";
import { BoardView } from "./components/BoardView";
import { Hud } from "./components/Hud";

const board = (boardData as { cells: BoardCell[] }).cells;

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  const startGame = (players: PlayerConfig[]) =>
    dispatch({ type: "START_GAME", players, board });

  const inGame = !["title", "setup"].includes(state.phase.name);
  const movingFrom = state.phase.name === "moving" ? state.phase.from : null;

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
      {state.phase.name === "title" && (
        <TitleScreen onStart={() => dispatch({ type: "SHOW_SETUP" })} />
      )}
      {state.phase.name === "setup" && <SetupScreen onSubmit={startGame} />}
    </div>
  );
}
