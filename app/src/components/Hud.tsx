import type { MapNode, Player } from "../game/types";

interface Props {
  players: Player[];
  currentPlayerIndex: number;
  destination: MapNode | null;
  round: number;
  maxRounds: number;
}

const fmt = (n: number) => `${Math.round(n / 10000)}万円`;

export function Hud({ players, currentPlayerIndex, destination, round, maxRounds }: Props) {
  return (
    <div className="hud">
      {players.map((p, i) => (
        <span key={p.id} className={`hud-player${i === currentPlayerIndex ? " current" : ""}`}>
          {p.kind === "cpu" ? "🤖" : "😀"} {p.name}: {fmt(p.money)}
          {p.arrivals > 0 && ` 🏁×${p.arrivals}`}
        </span>
      ))}
      <span className="hud-player" style={{ marginLeft: "auto" }}>
        🚩 {destination?.name ?? "?"} ／ {round}/{maxRounds}周
      </span>
    </div>
  );
}
