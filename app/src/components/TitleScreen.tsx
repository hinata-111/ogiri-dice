interface Props {
  onStart: () => void;
}

export function TitleScreen({ onStart }: Props) {
  return (
    <div className="overlay">
      <div className="panel" style={{ textAlign: "center" }}>
        <h1 className="logo">大喜利ダイス</h1>
        <p style={{ margin: "12px 0 20px", opacity: 0.85 }}>
          ボケた分だけ進める。面白さがサイコロだ！
        </p>
        <button className="primary" onClick={onStart}>
          はじめる
        </button>
      </div>
    </div>
  );
}
