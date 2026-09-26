import { useEffect, useState } from "react";

interface Props {
  disabled: boolean;
  cpuAnswer: string | null; // CPU手番のとき表示する回答(編集不可)
  onSubmit: (answer: string) => void;
  preserveDraft?: boolean;
  maxLength?: number;
}

export function AnswerInput({ disabled, cpuAnswer, onSubmit, preserveDraft = false, maxLength = 100 }: Props) {
  const [text, setText] = useState("");
  useEffect(() => { if (!preserveDraft) setText(""); }, [disabled, preserveDraft]);

  if (cpuAnswer !== null) {
    return (
      <div className="answer-form">
        <input type="text" value={cpuAnswer} readOnly />
        <button className="primary" disabled>🤖考え中</button>
      </div>
    );
  }

  const submit = () => {
    const answer = text.trim();
    if (answer) onSubmit(answer);
  };

  return (
    <div className="answer-form">
      <input
        type="text"
        aria-label="あなたの回答"
        enterKeyHint="send"
        placeholder={`ボケを入力…(${maxLength}文字まで)`}
        value={text}
        maxLength={maxLength}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // 日本語IME変換確定のEnterでは送信しない
          if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
        }}
      />
      <button className="primary" disabled={disabled || !text.trim()} onClick={submit}>
        送信！
      </button>
    </div>
  );
}
