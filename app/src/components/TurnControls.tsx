interface Props {
  round: number;
  playerName: string;
  simultaneous: boolean;
  seconds: number;
  canStart: boolean;
  waitingFor?: string;
  connected: boolean;
  onBegin: () => void;
  onRules: () => void;
}

export function TurnControls({ round, playerName, simultaneous, seconds, canStart, waitingFor, connected, onBegin, onRules }: Props) {
  return <section className="turn-controls" aria-label="ターンの操作" tabIndex={-1}>
    <header><h2>第{round}ターン</h2><span>{simultaneous ? '全員で回答' : `${playerName}の番`}</span></header>
    <p role="status">{!connected ? '再接続を待っています' : !canStart && waitingFor ? `${waitingFor}の開始操作を待っています` : `開始すると、お題を発表。回答は${seconds}秒です。`}</p>
    <div className="turn-control-buttons">
      <button onClick={onRules}>遊び方</button>
      <button className="primary" disabled={!canStart || !connected} onClick={onBegin}>大喜利をはじめる</button>
    </div>
  </section>;
}
