import { describe, expect, it } from "vitest";
import { buildCpuPrompt, buildEvaluatePrompt } from "./prompts";

describe("buildEvaluatePrompt", () => {
  it("お題と回答を含む放送作家プロンプトを組み立てる", () => {
    const p = buildEvaluatePrompt("こんな劇場は嫌だ", "客席が回る");
    expect(p).toContain("放送作家");
    expect(p).toContain("こんな劇場は嫌だ");
    expect(p).toContain("客席が回る");
    expect(p).toContain("1〜6");
  });
});

describe("buildCpuPrompt", () => {
  it("boldなら攻めた回答を指示する", () => {
    expect(buildCpuPrompt("お題", "bold")).toContain("攻め");
  });
  it("safeなら無難な回答を指示する", () => {
    expect(buildCpuPrompt("お題", "safe")).toContain("無難");
  });
});
