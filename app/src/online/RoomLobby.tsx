import { TheaterScene, PlayerToken } from '../presentation/StageArt';
import { playerColors } from '../presentation/palette';
import type { RoomSnapshot } from './protocol';

interface EntryProps { name: string; code: string; busy: boolean; error: string; setName: (name: string) => void; setCode: (code: string) => void; enter: (create: boolean) => void; onExit: () => void }
export function OnlineEntry({name,code,busy,error,setName,setCode,enter,onExit}: EntryProps) {
  return <main className="departure-screen online-entry-screen"><TheaterScene/>
    <section className="departure-desk">
      <header className="preparation-heading"><p className="route-kicker">東京の劇場をめぐる · みんなで集合</p><h1>オンライン対戦</h1><p>友達とそれぞれのスマホで。2〜4人の笑いをつなごう。</p></header>
      <div className="passenger-name"><span className="counter-step" aria-hidden="true">1</span><label htmlFor="online-name">まずは、あなたの名前</label><input id="online-name" aria-label="名前" value={name} onChange={e=>setName(e.target.value)} maxLength={10} autoComplete="nickname" placeholder="10文字まで"/></div>
      <div className="room-options">
        <section className="room-option create-option"><span className="counter-label">友達を招待する</span><PlayerToken color={playerColors[0]}/><h2>部屋をつくって集合</h2><p>部屋をつくったら、招待URLを<br/>友達に送るだけ。</p><button className="primary" disabled={busy || !name.trim()} onClick={()=>enter(true)}>部屋をつくる</button></section>
        <section className="room-option join-option"><span className="counter-label">招待されたら、こちら</span><h2>友達の部屋へ</h2><label htmlFor="online-code">部屋コード</label><input id="online-code" className="code-input" value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,''))} maxLength={8} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="ABCD2345"/><p>友達から届いたコードを入力</p><button className="primary" disabled={busy || !name.trim() || code.length<6} onClick={()=>enter(false)}>部屋に参加</button></section>
      </div>
      {busy && <p role="status" className="counter-notice">部屋を準備しています…</p>}
      {error && <p role="alert" className="counter-error">{error}</p>}
      <footer className="desk-footer"><button className="text-button" onClick={onExit}>← タイトルへ戻る</button><span>同じ部屋で、同じお題を。</span></footer>
    </section>
  </main>;
}

interface LobbyProps { room: RoomSnapshot; memberId: string; inviteUrl: string; copied: boolean; connected: boolean; pending: boolean; onCopy: () => void; onStart: () => void }
export function RoomLobby({room,memberId,inviteUrl,copied,connected,pending,onCopy,onStart}: LobbyProps) {
  const host = memberId === room.hostId;
  const ready = connected && !pending && room.members.length >= 2 && room.members.every(m=>m.connected);
  return <main className="departure-screen waiting-screen"><TheaterScene/>
    <section className="departure-desk waiting-desk">
      <header className="preparation-heading"><p className="route-kicker">開演前の待機室</p><h1>{room.members.length >= 2 ? '出演メンバーが集まってきた！' : '友達を待っています'}</h1><p>メンバーがそろったら、大喜利を始めよう。</p></header>
      <div className="invitation-ticket"><div><small>この部屋のコード</small><strong aria-label={`部屋コード ${room.code}`}>{room.code}</strong></div><span>{room.members.length}<small>/ 4人</small></span></div>
      <ol className="passenger-seats" aria-label="参加するプレイヤー">{Array.from({length:4},(_,i)=>{
        const member=room.members[i];
        return <li key={member?.id??`empty-${i}`} className={`passenger-seat ${member?'occupied':'empty'}`} style={{borderTopColor:playerColors[i]}}>
          <span className="seat-number">プレイヤー{i+1}</span><PlayerToken number={i+1} color={member?playerColors[i]:'#a6aaa0'}/>
          <strong>{member?.name??'空いています'}</strong>
          <small className={member&&!member.connected?'seat-disconnected':''}>{member ? member.connected ? '参加しています' : '再接続待ち' : '友達を待っています'}</small>
          {member?.id===room.hostId&&<span className="host-label">ホスト</span>}
        </li>;
      })}</ol>
      <div className="invite-controls"><label htmlFor="invite-url">友達を招待する</label><input id="invite-url" readOnly value={inviteUrl} onFocus={e=>e.target.select()}/><button onClick={onCopy}>{copied?'コピーしました':'招待URLをコピー'}</button></div>
      <footer className="lobby-departure"><p role="status">{pending?'開演の準備中…':room.members.length<2?'あと1人参加すると開始できます。':room.members.some(m=>!m.connected)?'全員の接続が戻るのを待っています。':host?'みんなそろったら、大喜利を始めよう！':'ホストの開始を待っています'}</p>{host&&<button className="primary" disabled={!ready} onClick={onStart}>みんなで開始</button>}</footer>
      <p className="online-hint">通常のお題は全員で30秒。移動は上の参加順（プレイヤー1から）で固定です。青・赤マスの追加お題は15秒、移動は1歩30秒以内。開始後は途中参加できません。</p>
    </section>
  </main>;
}
