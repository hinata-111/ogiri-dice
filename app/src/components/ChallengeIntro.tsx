interface Props {
  cellKind: "blue" | "red";
}

export function ChallengeIntro({ cellKind }: Props) {
  const blue = cellKind === "blue";
  return (
    <div className="overlay transparent">
      <div className={`effect-popup ${blue ? "gain" : "loss"}`}>
        {blue ? "🟦 チャンスマス！" : "🟥 ピンチマス！"}
        <div style={{ fontSize: 18, marginTop: 8 }}>
          {blue ? "追加お題でボーナスを狙え！" : "追加お題！スベると罰金…"}
        </div>
      </div>
    </div>
  );
}
