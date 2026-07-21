export function buildEvaluatePrompt(topic: string, answer: string): string {
  return `あなたは辛口の放送作家です。大喜利のお題に対する回答の面白さを審査します。
【お題】${topic}
【回答】${answer}
面白さを1〜6の整数で採点し、短いツッコミコメントを日本語で付けてください。
6=天才的、5=会場が沸く、4=なかなか、3=普通、2=弱い、1=スベった。`;
}

export function buildCpuPrompt(topic: string, personality: string): string {
  const style =
    personality === "bold"
      ? "意表を突く攻めた回答"
      : "誰にでも伝わる無難で面白い回答";
  return `あなたは大喜利プレイヤーです。次のお題に${style}を1つだけ、30文字以内の日本語で答えてください。
【お題】${topic}`;
}
