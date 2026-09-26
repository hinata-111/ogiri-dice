import { CHALLENGE_UNIT, ANSWER_TIME_LIMIT_MS } from '../game/rules';
interface Props {
  cellKind: "blue" | "red";
  onBegin?: () => void;
}

export function ChallengeIntro({ cellKind, onBegin }: Props) {
  const blue = cellKind === "blue";
  return (
    <div className="overlay transparent">
      <section className={`panel event-panel ${blue ? "gain" : "loss"}`}>
        <p className="eyebrow">{blue ? '青マス' : '赤マス'}</p>
        <h2>{blue ? "もうひとボケで、賞金！" : "ピンチ！ お題で切り抜けよう"}</h2>
        <strong className="event-value">{blue ? `1点につき ＋${CHALLENGE_UNIT/10000}万円` : '目標点以上で減額を回避'}</strong>
        <p>{blue ? `次のお題も${ANSWER_TIME_LIMIT_MS/1000}秒。点数がそのまま賞金に！` : `足りない1点につき${CHALLENGE_UNIT/10000}万円減額。目標点はお題と一緒に発表。`}</p>
        {onBegin ? <button className="primary" onClick={onBegin}>お題に挑戦する</button> : <p className="event-note">まもなくチャレンジ開始</p>}
      </section>
    </div>
  );
}
