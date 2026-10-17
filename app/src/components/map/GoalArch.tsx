export function GoalArch({ name, point }: { name: string; point: readonly number[] }) {
  return (
    <div className="tokyo-goal-arch" role="img" aria-label={`${name}：今回のゴール`} style={{ left: `${point[0]}%`, top: `${point[1]}%` }}>
      <svg viewBox="0 0 112 80" preserveAspectRatio="none" aria-hidden="true">
        <path d="M12 30H24V73L20 77H8V73H12ZM88 30H100V73L104 77H88Z" fill="#85665b" />
        <path d="M10 29H20V73H10ZM90 29H100V73H90Z" fill="#efe4ce" stroke="#77594f" strokeWidth="1.5" />
        <path d="M13 32V69M93 32V69" stroke="#fffaf0" strokeWidth="2" />
        <path d="M10 62H20V69H10ZM90 62H100V69H90Z" fill="#b35b50" />
        <path d="M6 74H24M86 74H104" stroke="#77594f" strokeWidth="3" strokeLinecap="round" />
        <path d="M5 10Q56-1 107 10V35H5Z" fill="#81534a" transform="translate(0 3)" />
        <path d="M5 8Q56-3 107 8V33H5Z" fill="#b35b50" stroke="#77594f" strokeWidth="1.5" />
        <path d="M9 10Q56 1 103 10V29H9Z" fill="#fff5de" />
        <path d="M13 32H99" stroke="#d8bd83" strokeWidth="2" />
      </svg>
      <span className="goal-arch-sign" aria-hidden="true"><small>ゴール</small><strong>{name}</strong></span>
    </div>
  );
}
