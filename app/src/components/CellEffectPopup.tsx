interface Props {
  delta: number;
}

export function CellEffectPopup({ delta }: Props) {
  const gain = delta > 0;
  return (
    <div className="overlay transparent">
      <div className={`effect-popup ${gain ? "gain" : "loss"}`}>
        {gain ? "🎉 +" : "💸 -"}{Math.abs(delta) / 10000}万円！
      </div>
    </div>
  );
}
