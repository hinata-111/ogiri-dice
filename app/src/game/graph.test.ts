import { describe, expect, it } from "vitest";
import { buildNodeMap, destinationCandidates, moveOptions, nextStepToward } from "./graph";
import type { MapNode } from "./types";

// 直線+分岐のテスト用ミニマップ: a - b - c - d、bから枝 b - e
const n = (id: string, neighbors: string[], kind: MapNode["kind"] = "stop"): MapNode => ({
  id, name: id, kind, cell: "normal", x: 0, y: 0, neighbors,
});
const nodes: MapNode[] = [
  n("a", ["b"], "theater"),
  n("b", ["a", "c", "e"]),
  n("c", ["b", "d"]),
  n("d", ["c"], "tv"),
  n("e", ["b"], "station"),
];

describe("buildNodeMap", () => {
  it("全ノードを引ける", () => {
    const m = buildNodeMap(nodes);
    expect(m.get("c")?.neighbors).toEqual(["b", "d"]);
  });
  it("id重複でthrow", () => {
    expect(() => buildNodeMap([...nodes, n("a", ["b"])])).toThrow();
  });
  it("片方向エッジでthrow", () => {
    expect(() => buildNodeMap([n("x", ["y"]), n("y", [])])).toThrow();
  });
  it("未知の隣接idでthrow", () => {
    expect(() => buildNodeMap([n("x", ["zzz"])])).toThrow();
  });
});

describe("moveOptions", () => {
  const m = buildNodeMap(nodes);
  it("来た道を除外する", () => {
    expect(moveOptions(m, "b", "a").sort()).toEqual(["c", "e"]);
  });
  it("cameFromがnullなら全隣接", () => {
    expect(moveOptions(m, "b", null).sort()).toEqual(["a", "c", "e"]);
  });
  it("行き止まりでは来た道に戻れる", () => {
    expect(moveOptions(m, "e", "b")).toEqual(["b"]);
  });
});

describe("nextStepToward", () => {
  const m = buildNodeMap(nodes);
  it("最短経路の次の一歩を返す", () => {
    expect(nextStepToward(m, "a", null, "d")).toBe("b");
    expect(nextStepToward(m, "b", "a", "d")).toBe("c");
  });
  it("行き止まりからは戻る一歩", () => {
    expect(nextStepToward(m, "e", "b", "d")).toBe("b");
  });
});

describe("destinationCandidates", () => {
  it("theater/tvのみ", () => {
    expect(destinationCandidates(nodes).map((x) => x.id).sort()).toEqual(["a", "d"]);
  });
});
