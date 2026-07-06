import { describe, expect, it } from "vitest";
import { pickRandomTopic } from "./topics";
import type { Topic } from "./types";

const topics: Topic[] = [
  { id: "a", category: "c", prompt: "p1", difficulty: "Easy" },
  { id: "b", category: "c", prompt: "p2", difficulty: "Normal" },
  { id: "c", category: "c", prompt: "p3", difficulty: "Hard" },
];

describe("pickRandomTopic", () => {
  it("未使用のお題から選ぶ", () => {
    const t = pickRandomTopic(topics, ["a", "b"], () => 0);
    expect(t.id).toBe("c");
  });

  it("全て使用済みなら全体から選び直す", () => {
    const t = pickRandomTopic(topics, ["a", "b", "c"], () => 0);
    expect(t.id).toBe("a");
  });

  it("randomの値で選択が変わる", () => {
    const t = pickRandomTopic(topics, [], () => 0.99);
    expect(t.id).toBe("c");
  });
});
