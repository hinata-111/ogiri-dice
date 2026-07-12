import { describe, expect, it } from "vitest";
import mapData from "../data/map.json";
import { buildNodeMap, destinationCandidates, nextStepToward } from "./graph";
import type { MapNode } from "./types";

const nodes = (mapData as { nodes: MapNode[] }).nodes;

describe("東京マップデータ", () => {
  it("36ノード・双方向整合(buildNodeMapが通る)", () => {
    const m = buildNodeMap(nodes);
    expect(m.size).toBe(36);
  });
  it("目的地候補は劇場9+テレビ局3の12件", () => {
    // theater: 高円寺/中野/新宿/渋谷/下北沢/池袋/神保町/浅草/有楽町 = 9, tv: 汐留/お台場/六本木 = 3
    expect(destinationCandidates(nodes)).toHaveLength(12);
  });
  it("全拠点間が連結(新宿→浅草に経路がある)", () => {
    const m = buildNodeMap(nodes);
    let at = "shinjuku";
    let cameFrom: string | null = null;
    for (let i = 0; i < 50; i++) {
      if (at === "asakusa") break;
      const next = nextStepToward(m, at, cameFrom, "asakusa");
      cameFrom = at;
      at = next;
    }
    expect(at).toBe("asakusa");
  });
});
