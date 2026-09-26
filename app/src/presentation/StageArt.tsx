import type { CSSProperties } from 'react';

/** Original, face-free props shared by the lobby and the playable board. */
export function MicrophoneMark({ className = '' }: { className?: string }) {
  return <svg className={`microphone-mark ${className}`} viewBox="0 0 32 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <rect x="10" y="3" width="12" height="23" rx="6"/>
    <path d="M6 19v2a10 10 0 0 0 20 0v-2M16 31v6m-6 0h12M12 9h8m-8 5h8m-8 5h8"/>
  </svg>;
}

export function PlayerToken({ color = '#bd4b4b', number }: { color?: string; number?: number }) {
  return <span className="player-token" style={{ '--token-color': color } as CSSProperties} aria-hidden="true"><span className="token-top"><MicrophoneMark/></span><span className="token-number">{number ?? <MicrophoneMark/>}</span></span>;
}

export function TheaterSign({ television = false }: { television?: boolean }) {
  return <svg className="theater-sign" viewBox="0 0 180 135" aria-hidden="true">
    <path d="M20 24h133v100H20z" fill="#d8d6c8"/><path d="m153 24 13-9v99l-13 10Z" fill="#989f9b"/>
    <path d="M35 59h103v65H35z" fill="#344150"/>{!television && <path d="M35 59h42q-7 35-42 48Zm61 0h42v48q-36-11-42-48Z" fill="#ac4548"/>}
    <path d="M14 23h146v30H14z" fill="#f8f5e9" stroke="#354553" strokeWidth="2"/>
    <text x="87" y="44" textAnchor="middle" fill="#354553" fontSize="18" fontWeight="700">{television ? 'テレビ局' : '大喜利劇場'}</text>
    <path d="M25 125h124" stroke="#b4aa91" strokeWidth="7"/><path d="M84 87v30m-10 0h20" stroke="#e8e9e0" strokeWidth="3"/>
    <rect x="80" y="73" width="8" height="18" rx="4" fill="#e8e9e0"/>
  </svg>;
}

export function TheaterScene() {
  return <div className="theater-scene" aria-hidden="true">
    <svg viewBox="0 0 1400 800" preserveAspectRatio="xMidYMid slice">
      <path fill="#dce4e2" d="M0 0h1400v800H0z"/>
      <path fill="#c0ccc8" d="M0 800V250h135v100h87V180h98v163h150V263h130v112h178V160h95v172h110V211h76v128h153V167h108v202h180v431Z"/>
      <path fill="#e6e4d9" d="M0 489 1400 407v393H0Z"/><path fill="#b7c2bf" d="m0 692 1400-161v123L0 794Z"/>
      <path d="m0 727 1400-161" stroke="#eae9df" strokeWidth="4"/>
      <g fill="#bac6c4" stroke="#a4b2af" strokeWidth="2"><path d="M595 287h136v287H595z"/><path d="m731 287 58-30v288l-58 29Z" fill="#98aba9"/><path d="m595 287 61-29h133l-58 29Z" fill="#d6ded9"/></g>
      <g fill="#809999">{[0,1,2,3].map(row => [0,1,2].map(col => <rect key={`${row}:${col}`} x={612+col*36} y={323+row*47} width="22" height="26"/>))}</g>
      <g><path d="m1089 349 44-154 41 149" fill="none" stroke="#b77062" strokeWidth="8"/><path d="M1113 269h38m-45 28h55m-62 28h70m-39-135v-37" fill="none" stroke="#b77062" strokeWidth="5"/></g>
      <path d="m750 367 327-40 112 76-337 40Z" fill="#ede6d2"/>
      <path d="m1077 327 112 76v208l-112-69Z" fill="#9b9990"/>
      <path d="m750 367 327-40v215l-327 49Z" fill="#c6bc9f"/>
      <path d="m779 436 261-32v145l-261 38Z" fill="#3a434b"/>
      <path d="m791 434 88-11q-19 75-88 98Zm154-19 85-10v82q-68-14-85-72Z" fill="#a94449"/>
      <path d="m759 377 310-37v63l-310 39Z" fill="#f8f4e6" stroke="#44515b" strokeWidth="3"/>
      <text x="785" y="425" transform="rotate(-7 785 425)" fill="#344150" fontSize="38" fontWeight="900" letterSpacing="5">大喜利劇場</text>
      <path d="m739 589 342-50 53 22-346 54Z" fill="#b1aa95"/>
      <path d="m748 613 340-50v13l-340 51Z" fill="#90968d"/>
      <path d="m910 484-2 67m-13 3 25-4" stroke="#efece1" strokeWidth="4"/><rect x="904" y="464" width="10" height="25" rx="5" fill="#efece1"/>
      <path d="m1025 527 49-8 4 85-49 8Z" fill="#eee9d7" stroke="#535e62" strokeWidth="3"/>
      <path d="m1036 540 29-4m-29 17 29-4m-28 19 21-3" stroke="#b64e4f" strokeWidth="4"/>
      <g fill="#7c9478"><path d="m1210 596 18-89 46-30 44 38 10 66-38 37Z"/><path d="m667 614 15-77 37-29 34 39-2 51-31 30Z"/></g>
      <g fill="#8fa58a"><path d="m1210 548 18-41 46-30 19 47-16 40Z"/><path d="m667 581 15-44 37-29 13 41-26 49Z"/></g>
      <path d="m1267 594-1 46m-558-34-2 42" stroke="#7c8071" strokeWidth="8"/>
    </svg>
  </div>;
}

export function Confetti() {
  return <div className="celebration-confetti" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--i':i, '--x':`${(i*37)%100}%`, '--color':['#bb5550','#dfba68','#678f92'][i%3] } as CSSProperties}/>)}</div>;
}

export function WinnerSeal() {
  return <svg className="winner-seal" viewBox="0 0 100 110" aria-hidden="true"><path d="m28 65-8 39 29-16 30 16-8-39" fill="#b95350"/><circle cx="50" cy="43" r="37" fill="#e3c476" stroke="#ac914d" strokeWidth="2"/><path d="M35 24h30v24q0 16-15 19-15-3-15-19V24Zm0 6H24v10q0 14 14 14m27-24h11v10q0 14-14 14M50 67v10m-12 0h24" fill="#f7e5ae" stroke="#806f43" strokeWidth="3"/></svg>;
}
