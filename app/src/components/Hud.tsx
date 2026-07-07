import type { Player } from "../game/types";

interface Props {
  players: Player[];
  currentPlayerIndex: number;
}

const fmt = (n: number) => `${(n / 10000).toLocaleString()}万円`;

export function Hud({ players, currentPlayerIndex }: Props) {
  return (
    <div className="hud">
      {players.map((p, i) => (
        <span key={p.id} className={`hud-player${i === currentPlayerIndex ? " current" : ""}`}>
          {p.kind === "cpu" ? "🤖" : "😀"} {p.name}: {fmt(p.money)}
          {p.goalOrder !== null && " 🏁"}
        </span>
      ))}
    </div>
  );
}
