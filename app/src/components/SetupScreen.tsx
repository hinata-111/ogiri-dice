import { useState } from "react";
import type { CpuPersonality, PlayerConfig, PlayerKind } from "../game/types";
import { TheaterScene, PlayerToken } from '../presentation/StageArt';
import { playerColors } from '../presentation/palette';

interface Props {
  onSubmit: (players: PlayerConfig[]) => void;
}

interface Row {
  name: string;
  kind: PlayerKind;
  personality: CpuPersonality;
}

const defaultRows: Row[] = [
  { name: "プレイヤー1", kind: "human", personality: "safe" },
  { name: "ロボ作家", kind: "cpu", personality: "bold" },
];

export function SetupScreen({ onSubmit }: Props) {
  const [rows, setRows] = useState<Row[]>(defaultRows);

  const update = (i: number, patch: Partial<Row>) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const addRow = () =>
    setRows([...rows, { name: `プレイヤー${rows.length + 1}`, kind: "human", personality: "safe" }]);

  const removeRow = (i: number) => setRows(rows.filter((_, j) => j !== i));

  const submit = () =>
    onSubmit(
      rows.map((r) => ({
        name: r.name.trim() || "名無し",
        kind: r.kind,
        personality: r.kind === "cpu" ? r.personality : undefined,
      })),
    );

  return (
    <div className="departure-screen setup-screen">
      <TheaterScene/>
      <div className="panel setup-panel">
        <header className="preparation-heading"><p className="route-kicker">開演の準備</p><h2>今日の出演メンバー</h2><p>プレイヤー設定(1〜4人) · 名前と操作方法を決めよう。</p></header>
        <div className="setup-rows">
        {rows.map((r, i) => (
          <div className="setup-row" key={i}>
            <div className={`setup-player-number player-color-${i}`}><PlayerToken color={playerColors[i]} number={i+1}/><small>プレイヤー{i+1}</small></div>
            <input
              type="text"
              aria-label={`プレイヤー${i+1}の名前`}
              value={r.name}
              maxLength={10}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <select
              value={r.kind}
              aria-label={`プレイヤー${i+1}の操作`}
              onChange={(e) => update(i, { kind: e.target.value as PlayerKind })}
            >
              <option value="human">自分で操作</option>
              <option value="cpu">CPUにおまかせ</option>
            </select>
            {r.kind === "cpu" && (
              <select
                value={r.personality}
                aria-label={`プレイヤー${i+1}の性格`}
                onChange={(e) => update(i, { personality: e.target.value as CpuPersonality })}
              >
                <option value="safe">性格：堅実</option>
                <option value="bold">性格：攻める</option>
              </select>
            )}
            {rows.length > 1 && (
              <button className="ghost" aria-label={`プレイヤー${i+1}を外す`} onClick={() => removeRow(i)}>
                ×
              </button>
            )}
          </div>
        ))}
        </div>
        <div className="setup-footer">
        <span className="boarding-count">{rows.length}人で挑戦</span>
        {rows.length < 4 && (
          <button className="ghost" onClick={addRow}>
            ＋ プレイヤー追加
          </button>
        )}
          <button className="primary" onClick={submit}>
            ゲーム開始！
          </button>
        </div>
      </div>
    </div>
  );
}
