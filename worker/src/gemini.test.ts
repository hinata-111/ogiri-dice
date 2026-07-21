import { describe, expect, it } from "vitest";
import { extractJson } from "./gemini";

describe("extractJson", () => {
  it("candidates[0].content.parts[0].text をJSONとして取り出す", () => {
    const data = {
      candidates: [
        { content: { parts: [{ text: '{"score": 5, "comment": "やるな"}' }] } },
      ],
    };
    expect(extractJson(data)).toEqual({ score: 5, comment: "やるな" });
  });

  it("構造が想定外なら例外", () => {
    expect(() => extractJson({})).toThrow();
  });

  it("textがJSONでなければ例外", () => {
    const data = { candidates: [{ content: { parts: [{ text: "not json" }] } }] };
    expect(() => extractJson(data)).toThrow();
  });
});
