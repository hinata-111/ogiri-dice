import { ARRIVAL_PRIZE } from "../game/rules";
import { MoneyChange } from './MoneyChange';

interface Props {
  name: string; // 到着した拠点名
  money: number; // reducerで到着賞金を反映した後の所持金
  onContinue?: () => void;
}

export function ArrivalOverlay({ name, money, onContinue }: Props) {
  return (
    <div className="overlay">
      <section className="panel arrival-panel event-panel">
      <p className="arrival-stamp">目的地クリア</p>
      <h2 className="score-big">{name} 到着！</h2>
      <div className="comment-bubble">到着ボーナス +{ARRIVAL_PRIZE / 10000}万円！</div>
      <MoneyChange before={money-ARRIVAL_PRIZE} after={money}/>
      <p>次はどの街へ？ 新しい目的地へ旅を続けよう。</p>
      {onContinue ? <button className="primary" onClick={onContinue}>次の目的地へ</button> : <p className="event-note">次の目的地を選んでいます…</p>}
      </section>
    </div>
  );
}
