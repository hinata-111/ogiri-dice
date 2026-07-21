import { ARRIVAL_PRIZE } from "../game/rules";

interface Props {
  name: string; // 到着した拠点名
}

export function ArrivalOverlay({ name }: Props) {
  return (
    <div className="overlay">
      <div className="score-big">🎉 {name} 到着！</div>
      <div className="comment-bubble">到着ボーナス +{ARRIVAL_PRIZE / 10000}万円！</div>
      <div style={{ opacity: 0.85 }}>次の目的地を抽選中…</div>
    </div>
  );
}
