import { useState } from 'react';
import { ANSWER_TIME_LIMIT_MS, ARRIVAL_PRIZE, WIN_MONEY } from '../game/rules';
interface Props {
  onStart: () => void;
}

export function TitleScreen({ onStart }: Props) {
  const [help,setHelp]=useState(false);
  return (
    <div className="overlay title-overlay">
      <div className="panel title-panel" style={{ textAlign: "center" }}>
        <p className="title-route">東京をめぐる 大喜利すごろく</p>
        <h1 className="logo">大喜利ダイス</h1>
        <p style={{ margin: "12px 0 20px", opacity: 0.85 }}>
          {ANSWER_TIME_LIMIT_MS/1000}秒でボケる。点数だけ進む。<br/>東京の目的地を目指して、先に{WIN_MONEY/10000}万円！
        </p>
        <button className="primary" onClick={onStart}>
          はじめる
        </button>
        <button className="ghost help-toggle" aria-expanded={help} onClick={()=>setHelp(!help)}>遊び方</button>
        {help&&<ol className="how-to-play"><li><b>{ANSWER_TIME_LIMIT_MS/1000}秒でひと言！</b> お題にボケて、採点された点数だけ進もう。</li><li><b>東京の目的地を目指そう。</b> 到着すると{ARRIVAL_PRIZE/10000}万円。青・赤マスでは追加のお題に挑戦！</li><li><b>先に{WIN_MONEY/10000}万円で優勝！</b> 1〜4人で遊べます。CPUとも対戦できます。</li></ol>}
      </div>
    </div>
  );
}
