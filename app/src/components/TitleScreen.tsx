import { useRef, useState } from 'react';
import { ANSWER_TIME_LIMIT_MS, ONLINE_ROUND_ANSWER_MS, ARRIVAL_PRIZE, WIN_MONEY } from '../game/rules';
import { TheaterScene } from '../presentation/StageArt';

interface Props { onStart: () => void; onOnline?: () => void }
export function TitleScreen({ onStart, onOnline }: Props) {
  const [help,setHelp] = useState(false);
  const helpButton=useRef<HTMLButtonElement>(null);
  return <main className="departure-screen title-screen">
    <TheaterScene/>
    <div className="title-content">
      <p className="route-kicker"><span/> 東京の劇場をめぐる 大喜利すごろく <span/></p>
      <h1 className="game-wordmark" aria-label="大喜利ダイス"><span className="wordmark-top">大喜利</span><span className="wordmark-bottom">ダイス</span></h1>
      <p className="title-catch">次の劇場まで、ひとボケ。</p>
      <p className="title-rule">ボケた点数のぶんだけ、次の会場へ。<br className="mobile-break"/> 目指せ、{WIN_MONEY/10000}万円の一番乗り！</p>
      <div className="boarding-options">
        <button className="boarding-ticket local-ticket primary" aria-label="はじめる" onClick={onStart}>
          <span className="ticket-number" aria-hidden="true">1–4</span><span className="ticket-main"><small>1台でわいわい・CPUとも対戦</small><strong>はじめる</strong><span>1〜4人で遊ぶ</span></span><span className="ticket-arrow" aria-hidden="true">→</span>
        </button>
        {onOnline && <button className="boarding-ticket online-ticket" aria-label="オンラインで遊ぶ" onClick={onOnline}>
          <span className="ticket-number" aria-hidden="true">2–4</span><span className="ticket-main"><small>離れた友達と、それぞれの端末で</small><strong>オンラインで遊ぶ</strong><span>2〜4人で集合</span></span><span className="ticket-arrow" aria-hidden="true">→</span>
        </button>}
      </div>
      <button ref={helpButton} className="title-help" aria-expanded={help} aria-controls="how-to-play" onClick={() => setHelp(!help)}>遊び方 <span aria-hidden="true">{help?'−':'＋'}</span></button>
      {help && <section className="travel-help" id="how-to-play"><h2>笑って、進んで、一番乗り。</h2><ol><li><b>お題にひと言。</b> どちらの遊び方も全員で同じお題に{ONLINE_ROUND_ANSWER_MS/1000}秒で回答。CPUも同じお題に挑戦。採点は1〜6点、点数の数だけ東京を進もう。</li><li><b>目的地へ一番乗り！</b> 到着すると{ARRIVAL_PRIZE/10000}万円。青・赤マスでは{ANSWER_TIME_LIMIT_MS/1000}秒の追加お題に挑戦。</li><li><b>先に{WIN_MONEY/10000}万円で優勝。</b> うまい回答も、思わぬ珍回答も、みんなで楽しもう。</li></ol><button onClick={() => { setHelp(false); helpButton.current?.focus(); }}>とじる</button></section>}
    </div>
    <div className="departure-caption"><span>東京の劇場をめぐる</span><span>まもなく、開演です。</span></div>
  </main>;
}
