import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { GameState } from '../../game/state';
import { currentPlayer } from '../../game/state';
import { buildNodeMap, moveOptions } from '../../game/graph';
import { ARRIVAL_PRIZE, MAX_ROUNDS, rankPlayers, WIN_MONEY } from '../../game/rules';
import './tokyo-board.css';
import { buildArtLayout } from './art-layout';
import { PlayerToken } from '../../presentation/StageArt';
import { playerColors } from '../../presentation/palette';
import { useMapCamera } from './useMapCamera';
import { reachableCells } from './reachable-cells';
import { GoalArch } from './GoalArch';

const colors=playerColors;
const cellNames={normal:'通常マス',blue:'賞金チャレンジ',red:'減額回避チャレンジ'};

export function TokyoBoard({state,onStep,canAct=true}:{state:GameState;onStep:(id:string)=>void;canAct?:boolean}) {
  const root=useRef<HTMLDivElement>(null);
  const boardId=useId();
  const standingsTrigger=useRef<HTMLButtonElement>(null);
  const [size,setSize]=useState({width:844,height:390});
  const [inspected,setInspected]=useState<string|null>(null);
  const lastStep=useRef<string|null>(null);
  const [standings,setStandings]=useState(false);
  const [newDestination,setNewDestination]=useState(true);
  useEffect(()=>{setNewDestination(true);const timer=setTimeout(()=>setNewDestination(false),4000);return()=>clearTimeout(timer)},[state.destinationId]);
  const player=currentPlayer(state),phase=state.phase;
  useEffect(()=>setStandings(false),[phase.name,player.id,state.round]);
  const closeStandings=()=>{setStandings(false);standingsTrigger.current?.focus()};
  const graph=useMemo(()=>buildNodeMap(state.nodes),[state.nodes]);
  const layout=useMemo(()=>buildArtLayout(state.nodes),[state.nodes]);
  const points=layout.points;
  const goal=phase.name!=='gameResult'&&state.destinationId?graph.get(state.destinationId):undefined;
  useLayoutEffect(()=>{const node=root.current;if(!node)return;const observer=new ResizeObserver(()=>setSize({width:node.clientWidth,height:node.clientHeight}));observer.observe(node);return()=>observer.disconnect()},[]);
  const distance=(from:string,to:string)=>{const queue:[string,number][]=[[from,0]],seen=new Set([from]);for(let i=0;i<queue.length;i++){const [id,d]=queue[i];if(id===to)return d;for(const next of graph.get(id)!.neighbors)if(!seen.has(next)){seen.add(next);queue.push([next,d+1])}}return 0};
  const describe=(id:string)=>graph.get(id)!.name||cellNames[graph.get(id)!.cell];
  const options=phase.name==='moving'&&player.kind==='human'&&canAct?moveOptions(graph,player.position,phase.cameFrom):[];
  const stepKey=phase.name==='moving'?JSON.stringify([state.round,player.id,player.position,phase.remaining,phase.cameFrom]):null;
  useLayoutEffect(()=>{lastStep.current=null},[stepKey,canAct]);
  const reachable=useMemo(()=>phase.name==='moving'?reachableCells(graph,player.position,phase.cameFrom,phase.remaining,state.destinationId):new Set<string>(),[graph,player.position,phase,state.destinationId]);
  const camera=useMapCamera(size,points.get(player.position)!,player.id);
  const {width,height,x,y}=camera;
  const overview=camera.mode==='overview';
  const view=camera.mode==='follow'?'current':camera.mode;
  const overviewFit=overview;
  const returnToPlayer=()=>{camera.follow();setInspected(null)};
  const narrow=size.width<=600&&size.height>=500;
  const [px,py]=points.get(player.position)!;
  const pawnX=x+px*width/100,pawnY=y+py*height/100;
  const stepsAside=!narrow&&Math.abs(pawnX-size.width/2)<75&&pawnY<150;
  const toolsRaised=!narrow&&!overview&&x+px*width/100>size.width-270&&y+py*height/100>size.height-150;
  return <div className={`tokyo-board ${overview?'is-overview':''} ${camera.mode!=='follow'?'is-browsing':''} ${camera.dragging?'is-dragging':''} ${phase.name==='gameResult'?'is-finished':''}`} ref={root}>
    <div inert={standings&&phase.name==='moving'}>
    <div className="map-viewport" ref={camera.viewport} role="region" tabIndex={0} aria-label="東京マップ。ドラッグ・矢印キーで移動、プラス・マイナスで拡大縮小" {...camera.bindings}>
    <div className="tokyo-camera" style={{width,height,transform:`translate(${x}px,${y}px)`}}>
      <img className="tokyo-art" draggable={false} src={`${import.meta.env.BASE_URL}art/tokyo-board-console.png`} alt="東京の街並み、公園、寺社と湾岸を描いたすごろくマップ"/>
      <svg className="tokyo-routes" viewBox="0 0 1000 562.5" aria-hidden="true">
        <defs>{layout.crossings.map((crossing,i)=><mask key={i} id={`${boardId}-crossing-${i}`} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="562.5"><rect width="1000" height="562.5" fill="white"/><circle cx={crossing.x} cy={crossing.y} r="7" fill="black"/></mask>)}</defs>
        {[...reachable].map(id=>{const p=points.get(id)!;return <ellipse key={`reachable-${id}`} className="tokyo-reachable" cx={p[0]*10} cy={p[1]*5.625} rx="18" ry="13"/>})}
        {state.nodes.flatMap(n=>n.neighbors.filter(id=>n.id<id).map(id=>{const crossing=layout.crossings.findIndex(c=>c.under===`${n.id}:${id}`);return <path key={`${n.id}:${id}`} mask={crossing>=0?`url(#${boardId}-crossing-${crossing})`:undefined} className="tokyo-track" d={layout.path(n.id,id)}/>}))}
        {state.nodes.map(n=>{const p=points.get(n.id)!,w=n.name?21:17;return <g key={n.id} transform={`translate(${p[0]*10} ${p[1]*5.625})`}><g transform="rotate(-20)"><rect className="tokyo-cell-base" x={-w/2} y={-5} width={w} height={13} rx="2"/><rect data-cell-id={n.id} x={-w/2} y={-8} width={w} height={13} rx="2" className={`tokyo-cell ${n.cell} ${n.name?'hub':''} ${options.includes(n.id)?'can-step':''} ${n.id===goal?.id?'goal':''}`}/></g>{n.cell!=='normal'&&<text className="tokyo-cell-symbol" x="0" y="-1">{n.cell==='blue'?'+':'!'}</text>}</g>})}
      </svg>
      {state.nodes.map(n=>{
        const p=points.get(n.id)!,canStep=options.includes(n.id);
        return <button key={n.id} data-node-id={n.id} className={`tokyo-cell-target ${canStep?'tokyo-cell-move':'tokyo-cell-inspect'}`}
          style={{left:`${p[0]}%`,top:`${p[1]}%`}}
          aria-label={canStep?`${describe(n.id)}へ進む`:`${describe(n.id)}のマス情報`}
          aria-describedby={canStep?`${boardId}-move-hint`:undefined}
          aria-pressed={canStep?undefined:inspected===n.id}
          onKeyDown={e=>{if(canStep&&e.repeat&&(e.key==='Enter'||e.key===' '))e.preventDefault()}}
          onClick={e=>{
            if(!canStep){setInspected(inspected===n.id?null:n.id);return}
            if(e.detail>1||lastStep.current===stepKey)return;
            lastStep.current=stepKey;
            setInspected(null);
            onStep(n.id);
          }}/>;
      })}
      {state.nodes.filter(n=>n.name&&n.id!==goal?.id&&(!overview||!overviewFit||n.id===state.destinationId||n.id===player.position)).map(n=>{const p=points.get(n.id)!;return <span key={n.id} className="tokyo-label" style={{left:`${p[0]}%`,top:`${p[1]}%`,transform:state.players.filter(player=>player.position===n.id).length>1?'translate(-50%,24px)':undefined}}>{n.name}</span>})}
      {goal&&<GoalArch name={goal.name} point={points.get(goal.id)!}/>}
      {overview&&<span className="overview-current" style={{left:`${px}%`,top:`${py}%`}}>現在地</span>}
      {state.players.filter((p,i,all)=>!overview||all.findIndex(v=>v.position===p.position)===i).map(p=>{const pos=points.get(p.position)!,group=state.players.filter(v=>v.position===p.position),slot=group.findIndex(v=>v.id===p.id),offset=group.length>1?[[-19,-12],[19,-12],[-19,18],[19,18]][slot]:[0,0];return <div key={p.id} role="img" aria-label={`${p.name}：${describe(p.position)}${p.id===player.id?'、現在の手番':''}`} className={`tokyo-pawn ${group.length>1?'shared':''}`} style={{left:`${pos[0]}%`,top:`${pos[1]}%`,'--ox':`${offset[0]}px`,'--oy':`${offset[1]}px`} as CSSProperties}><PlayerToken color={colors[p.id%4]} number={p.id+1}/>{overview&&group.length>1&&<small className="pawn-group-count">{group.length}人</small>}</div>})}
    </div>
    </div>
    <div className="map-navigation" aria-label="地図の操作"><button aria-label="地図を拡大" disabled={!camera.canZoomIn} onClick={camera.zoomIn}>＋</button><button aria-label="地図を縮小" disabled={!camera.canZoomOut} onClick={camera.zoomOut}>−</button></div>
    {camera.mode!=='follow'&&<p className="map-browsing-hint">地図を見回し中 · 自動追従は停止中</p>}
    {inspected&&<section className="map-cell-detail" aria-label="マスの情報"><strong>{describe(inspected)}</strong><span>{cellNames[graph.get(inspected)!.cell]} · 現在地から最短 {distance(player.position,inspected)}マス</span>{phase.name==='moving'&&<span>{reachable.has(inspected)?'残り歩数で通れるマス':'残り歩数で通れる範囲の外'}</span>}<small>距離は地図上の最短です。移動中は来た道へ戻れません（行き止まりを除く）。</small><button onClick={()=>setInspected(null)} aria-label="マスの情報を閉じる">閉じる</button></section>}
    <div className="tokyo-hud"><div className="tokyo-player" style={{borderLeftColor:colors[player.id%4]}}><span style={{background:colors[player.id%4]}}>{player.id+1}</span><b>{player.name}</b><strong>{player.money/10000}万円</strong></div><button className={`tokyo-destination ${newDestination?"destination-new":""}`} onClick={()=>{setInspected(null);if(view==='destination')returnToPlayer();else camera.destination(points.get(state.destinationId!)!)}} aria-pressed={view==='destination'}><span>⚑ {newDestination?'新しい目的地':'目的地'}　{state.destinationId&&describe(state.destinationId)}</span><small>最短 {distance(player.position,state.destinationId!)}マス・到着で{ARRIVAL_PRIZE/10000}万円</small></button></div>
    {phase.name==='moving'&&!overview&&<div className={`tokyo-steps ${stepsAside?'steps-aside':''}`}>あと <b>{phase.remaining}</b> マス</div>}
    <div className={`tokyo-map-tools ${toolsRaised?'tools-raised':''}`}><div className="tokyo-tool-buttons"><button onClick={()=>{setInspected(null);camera.overview()}}>広く見る</button>{camera.mode!=='follow'&&<button onClick={returnToPlayer}>現在地へ戻る</button>}{phase.name==='moving'&&<button ref={standingsTrigger} onClick={()=>setStandings(true)}>みんなの状況</button>}</div><small>{state.round} / {MAX_ROUNDS} 周目</small></div>
    {phase.name==='moving'&&<p className="tokyo-move-hint" id={`${boardId}-move-hint`} role="status">{player.kind==='cpu'||!canAct?`${player.name}が移動中…`:'光っている隣のマスをタップ'}</p>}
    </div>
    {standings&&phase.name==='moving'&&<div className="tokyo-standings" role="dialog" aria-modal="true" aria-labelledby="standings-title" onKeyDown={e=>{if(e.key==='Escape')closeStandings();if(e.key==='Tab')e.preventDefault()}}><section><h2 id="standings-title">みんなの状況</h2><p>先に{WIN_MONEY/10000}万円で優勝！</p><ol>{rankPlayers(state.players).map((p,i)=><li key={p.id}><span className="standings-number" style={{background:colors[p.id%4]}}>{p.id+1}</span><span>{i+1}位　{p.name}{p.id===player.id?'（手番）':''}</span><strong>{p.money/10000}万円<small>目的地に{p.arrivals}回到着</small></strong></li>)}</ol><button autoFocus onClick={closeStandings}>マップへ戻る</button></section></div>}
  </div>;
}
