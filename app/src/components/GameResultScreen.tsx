import { rankPlayers } from "../game/rules";
import type { BestAnswer, Player } from "../game/types";

interface Props {
  players: Player[];
  bestAnswers: BestAnswer[];
  winnerId: number | null;
  winMoney: number;
  onRestart: () => void;
}

const fmt = (n: number) => `${Math.round(n / 10000)}万円`;
const MEDALS = ["🥇", "🥈", "🥉", "4位"];

export function GameResultScreen({ players, bestAnswers, winnerId, winMoney, onRestart }: Props) {
  const ranked = rankPlayers(players);
  const winner = winnerId !== null ? players.find((p) => p.id === winnerId) : ranked[0];
  return (
    <div className="overlay">
      <div className="panel">
        <h2>🎭 結果発表</h2>
        <p style={{ margin: "8px 0" }}>
          {winnerId !== null
            ? `${winner?.name} が${winMoney / 10000}万円達成で優勝！`
            : `規定周回終了！ 最多所持金の ${winner?.name} が優勝！`}
        </p>
        <ol className="rank-list">
          {ranked.map((p, i) => (
            <li key={p.id}>
              <span>{MEDALS[i] ?? `${i + 1}位`} {p.name}</span>
              <span>{fmt(p.money)} ／ 🏁×{p.arrivals}</span>
            </li>
          ))}
        </ol>
        {bestAnswers.length > 0 && (
          <div className="best-answers">
            <h3 style={{ marginBottom: 8 }}>✨ 今日のベスト回答</h3>
            {bestAnswers.map((b, i) => (
              <div className="item" key={i}>
                <div style={{ opacity: 0.7 }}>{b.topicPrompt}</div>
                <div style={{ fontWeight: 700, margin: "4px 0" }}>
                  {b.playerName}「{b.answer}」({b.score}点)
                </div>
                <div style={{ opacity: 0.8 }}>{b.comment}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <button className="primary" onClick={onRestart}>タイトルへ戻る</button>
        </div>
      </div>
    </div>
  );
}
