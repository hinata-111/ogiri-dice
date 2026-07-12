import { describe, expect, it } from "vitest";
import { pickDestination } from "./destination";
import type { MapNode } from "./types";

const n = (id: string, kind: MapNode["kind"]): MapNode => ({
  id, name: id, kind, cell: "normal", x: 0, y: 0, neighbors: [],
});
const nodes = [n("a", "theater"), n("b", "tv"), n("c", "station")];

describe("pickDestination", () => {
  it("除外idを避けて選ぶ", () => {
    expect(pickDestination(nodes, ["a"], () => 0)).toBe("b");
  });
  it("stationは選ばれない", () => {
    expect(pickDestination(nodes, [], () => 0.99)).toBe("b");
  });
  it("全除外なら全候補から", () => {
    expect(pickDestination(nodes, ["a", "b"], () => 0)).toBe("a");
  });
});
