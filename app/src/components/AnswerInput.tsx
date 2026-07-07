import { useEffect, useState } from "react";

interface Props {
  disabled: boolean;
  cpuAnswer: string | null; // CPU手番のとき表示する回答(編集不可)
  onSubmit: (answer: string) => void;
}

export function AnswerInput({ disabled, cpuAnswer, onSubmit }: Props) {
  const [text, setText] = useState("");
  useEffect(() => setText(""), [disabled]); // 手番が変わったらクリア

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
        placeholder="ボケを入力…(100文字まで)"
        value={text}
        maxLength={100}
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
