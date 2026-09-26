import { rankPlayers } from "../game/rules";
import type { BestAnswer, Player } from "../game/types";
import { Confetti, WinnerSeal } from '../presentation/StageArt';

interface Props {
  players: Player[];
  bestAnswers: BestAnswer[];
  winnerId: number | null;
  winMoney: number;
  onRestart: () => void;
}

const fmt = (n: number) => `${Math.round(n / 10000)}万円`;

export function GameResultScreen({ players, bestAnswers, winnerId, winMoney, onRestart }: Props) {
  const ranked = rankPlayers(players);
  const winner = winnerId !== null ? players.find((p) => p.id === winnerId) : ranked[0];
  return (
    <div className="overlay finale-overlay">
      <Confetti/>
      <section className="panel final-panel">
        <header className="winner-summary">
        <WinnerSeal/>
        <p className="eyebrow">東京の劇場をめぐる・結果発表</p>
        <h2 aria-label={`${winner?.name}、優勝！`}><span className="winner-name">{winner?.name}</span><span className="winner-title">優勝！</span></h2>
        <p className="winner-caption">
          {winnerId !== null
            ? `${winner?.name} が${winMoney / 10000}万円達成で優勝！`
            : `規定周回終了！ 最多所持金の ${winner?.name} が優勝！`}
        </p>
        </header>
        <ol className="rank-list">
          {ranked.map((p, i) => (
            <li key={p.id}>
              <span className="rank-number">{i+1}<small>位</small></span><span className="rank-name">{p.name}</span>
              <span className="rank-money">{fmt(p.money)}<small>目的地に{p.arrivals}回到着</small></span>
            </li>
          ))}
        </ol>
        {bestAnswers.length > 0 && (
          <details className="best-answers" open>
            <summary>今日のベスト回答を振り返る（{bestAnswers.length}件）</summary>
            {bestAnswers.map((b, i) => (
              <div className="item" key={i}>
                <div style={{ opacity: 0.7 }}>{b.topicPrompt}</div>
                <div style={{ fontWeight: 700, margin: "4px 0" }}>
                  {b.playerName}「{b.answer}」({b.score}点)
                </div>
                <div style={{ opacity: 0.8 }}>{b.comment}</div>
              </div>
            ))}
          </details>
        )}
        <div className="final-actions">
          <button className="primary" onClick={onRestart}>タイトルへ戻る</button>
        </div>
      </section>
    </div>
  );
}
