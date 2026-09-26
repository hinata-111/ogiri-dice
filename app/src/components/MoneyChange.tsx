/** A receipt of the real game amounts; animation never changes the displayed values. */
export function MoneyChange({before,after}:{before:number;after:number}) {
  return <dl className="money-change" aria-label="所持金の変化">
    <div><dt>変更前</dt><dd>{before/10000}<small>万円</small></dd></div>
    <div className="money-after"><dt>変更後</dt><dd>{after/10000}<small>万円</small></dd></div>
  </dl>;
}
