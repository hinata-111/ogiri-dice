import { useState } from "react";
import type { CpuPersonality, PlayerConfig, PlayerKind } from "../game/types";

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
    <div className="overlay">
      <div className="panel">
        <h2 style={{ marginBottom: 14 }}>プレイヤー設定(1〜4人)</h2>
        {rows.map((r, i) => (
          <div className="setup-row" key={i}>
            <input
              type="text"
              value={r.name}
              maxLength={10}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <select
              value={r.kind}
              onChange={(e) => update(i, { kind: e.target.value as PlayerKind })}
            >
              <option value="human">人間</option>
              <option value="cpu">CPU</option>
            </select>
            {r.kind === "cpu" && (
              <select
                value={r.personality}
                onChange={(e) => update(i, { personality: e.target.value as CpuPersonality })}
              >
                <option value="safe">無難</option>
                <option value="bold">攻める</option>
              </select>
            )}
            {rows.length > 1 && (
              <button className="ghost" onClick={() => removeRow(i)}>
                ✕
              </button>
            )}
          </div>
        ))}
        {rows.length < 4 && (
          <button className="ghost" onClick={addRow} style={{ marginBottom: 14 }}>
            ＋ プレイヤー追加
          </button>
        )}
        <div>
          <button className="primary" onClick={submit}>
            ゲーム開始！
          </button>
        </div>
      </div>
    </div>
  );
}
