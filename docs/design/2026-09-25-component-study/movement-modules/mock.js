


const MOCK_COMMENTS                         = {
  1: "出直してこい！",
  2: "うーん、あと一声！",
  3: "悪くないけど普通！",
  4: "お、ちょっと面白いじゃん",
  5: "やるな〜、会場ウケてるぞ",
  6: "天才か！座布団全部持ってけ！",
};

const MOCK_CPU_ANSWERS = [
  "全部の席がリクライニングしすぎて客が寝る",
  "入場料が出世払い",
  "舞台より客席のほうが明るい",
  "アンコールが義務",
];

const delay = (ms        ) => new Promise((r) => setTimeout(r, ms));

export class MockEvaluator                      {
          delayMs        ;
          random              ;

  constructor(delayMs = 1200, random               = Math.random) {
    this.delayMs = delayMs;
    this.random = random;
  }

  async evaluate(_topicPrompt        , _answer        )                            {
    await delay(this.delayMs);
    const score = 1 + Math.floor(this.random() * 6);
    return { score, comment: MOCK_COMMENTS[score] };
  }

  async cpuAnswer(_topicPrompt        , _personality                )                  {
    await delay(this.delayMs);
    return MOCK_CPU_ANSWERS[Math.floor(this.random() * MOCK_CPU_ANSWERS.length)];
  }
}
