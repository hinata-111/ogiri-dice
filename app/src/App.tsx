import { useReducer } from "react";
import { gameReducer, initialState } from "./game/state";
import { pickDestination } from "./game/destination";
import mapData from "./data/map.json";
import type { MapNode, PlayerConfig } from "./game/types";
import { TitleScreen } from "./components/TitleScreen";
import { SetupScreen } from "./components/SetupScreen";

const nodes = (mapData as { nodes: MapNode[] }).nodes;
const START_ID = "shinjuku";

// 暫定シェル: title/setupのみ動作。ターンループUIはV3/V4で実装。
export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const phase = state.phase;

  const startGame = (players: PlayerConfig[]) =>
    dispatch({
      type: "START_GAME",
      players,
      nodes,
      startId: START_ID,
      destinationId: pickDestination(nodes, [START_ID]),
    });

  return (
    <div className="stage">
      {phase.name === "title" && (
        <TitleScreen onStart={() => dispatch({ type: "SHOW_SETUP" })} />
      )}
      {phase.name === "setup" && <SetupScreen onSubmit={startGame} />}
      {phase.name !== "title" && phase.name !== "setup" && (
        <div className="overlay">
          <div className="panel">v2実装中(東京マップ・ターンループはV3/V4で実装)</div>
        </div>
      )}
    </div>
  );
}
