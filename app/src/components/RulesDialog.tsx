import { ANSWER_TIME_LIMIT_MS, ARRIVAL_PRIZE, ONLINE_ROUND_ANSWER_MS, WIN_MONEY } from '../game/rules';

interface Props {
  simultaneous: boolean;
  hasCpu: boolean;
  onClose: () => void;
}

export function RulesDialog({ simultaneous, hasCpu, onClose }: Props) {
  return <div className="overlay rules-overlay">
    <section className="panel turn-panel" role="dialog" aria-modal="true" aria-labelledby="rules-title"
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
        if (event.key !== 'Tab') return;
        const items = event.currentTarget.querySelectorAll<HTMLElement>('[tabindex="0"], button');
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>
      <div className="turn-body" tabIndex={0} aria-label="ゲームの遊び方">
        <p className="eyebrow">はじめてでも、ひとボケから。</p>
        <h2 id="rules-title">まずはルールを確認！</h2>
        <ol className="start-rules" aria-label="ゲームのルール">
          <li><b>お題に回答する</b><span>{simultaneous ? `全員で同じお題に${ONLINE_ROUND_ANSWER_MS/1000}秒以内で回答。${hasCpu ? 'CPUも一緒に挑戦します。' : ''}` : `お題に${ANSWER_TIME_LIMIT_MS/1000}秒以内で回答します。`}</span></li>
          <li><b>点数のぶんだけ進む</b><span>AIが1〜6点で採点。点数と同じ数のマスを、{simultaneous ? 'プレイヤー1から順に' : '自分の手番に'}進みます。</span></li>
          <li><b>目的地で賞金を獲得</b><span>目的地に着くと{ARRIVAL_PRIZE/10000}万円。青・赤マスでは{ANSWER_TIME_LIMIT_MS/1000}秒の追加お題で賞金が増減します。</span></li>
          <li><b>先に{WIN_MONEY/10000}万円で優勝！</b><span>手番が終わったときの所持金で判定。みんなで東京の劇場をめぐろう。</span></li>
        </ol>
      </div>
      <div className="turn-actions">
        <p className="event-note">閉じたあと、準備ができたら右下から大喜利をはじめよう。</p>
        <button className="primary" onClick={onClose}>閉じる</button>
      </div>
    </section>
  </div>;
}
