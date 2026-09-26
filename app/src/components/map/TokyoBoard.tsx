import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { GameState } from '../../game/state';
import { currentPlayer } from '../../game/state';
import { buildNodeMap, moveOptions } from '../../game/graph';
import { ARRIVAL_PRIZE, MAX_ROUNDS, rankPlayers, WIN_MONEY } from '../../game/rules';
import './tokyo-board.css';
import { buildArtLayout } from './art-layout';
import { placeChoices } from './choice-layout';
import { PlayerToken } from '../../presentation/StageArt';
import { playerColors } from '../../presentation/palette';

const colors=playerColors;
const cellNames={normal:'通常マス',blue:'賞金チャレンジ',red:'減額回避チャレンジ'};

export function TokyoBoard({state,onStep,canAct=true}:{state:GameState;onStep:(id:string)=>void;canAct?:boolean}) {
  const root=useRef<HTMLDivElement>(null);
  const boardId=useId();
  const overviewArea=useRef<HTMLDivElement>(null);
  const standingsTrigger=useRef<HTMLButtonElement>(null);
  const [size,setSize]=useState({width:844,height:390});
  const [overviewFit,setOverviewFit]=useState(false);
  const [view,setView]=useState<'current'|'destination'|'overview'>('current');
  const [selection,setSelection]=useState<{from:string;id:string}|null>(null);
  const [standings,setStandings]=useState(false);
  const [newDestination,setNewDestination]=useState(true);
  useEffect(()=>{setNewDestination(true);const timer=setTimeout(()=>setNewDestination(false),4000);return()=>clearTimeout(timer)},[state.destinationId]);
  const player=currentPlayer(state),phase=state.phase;
  useEffect(()=>setStandings(false),[phase.name,player.id,state.round]);
  const closeStandings=()=>{setStandings(false);standingsTrigger.current?.focus()};
  const graph=useMemo(()=>buildNodeMap(state.nodes),[state.nodes]);
  const layout=useMemo(()=>buildArtLayout(state.nodes),[state.nodes]);
  const points=layout.points;
  useLayoutEffect(()=>{const node=root.current;if(!node)return;const observer=new ResizeObserver(()=>setSize({width:node.clientWidth,height:node.clientHeight}));observer.observe(node);return()=>observer.disconnect()},[]);
  const distance=(from:string,to:string)=>{const queue:[string,number][]=[[from,0]],seen=new Set([from]);for(let i=0;i<queue.length;i++){const [id,d]=queue[i];if(id===to)return d;for(const next of graph.get(id)!.neighbors)if(!seen.has(next)){seen.add(next);queue.push([next,d+1])}}return 0};
  const describe=(id:string)=>graph.get(id)!.name||cellNames[graph.get(id)!.cell];
  const options=phase.name==='moving'&&player.kind==='human'&&canAct?moveOptions(graph,player.position,phase.cameFrom):[];
  const selected=selection?.from===player.position&&options.includes(selection.id)?selection.id:null;
  const overview=view==='overview';
  const narrow=size.width<=600&&size.height>=500;
  const width=overview?(overviewFit?size.width:Math.max(900,size.width)):Math.max(size.width,size.height*16/9)*1.25,height=width*9/16;
  const focus=points.get(view==='destination'?state.destinationId!:player.position)!;
  const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
  const x=overview?0:clamp(size.width*.5-width*focus[0]/100,size.width-width,0);
  const y=overview?0:clamp(size.height*.42-height*focus[1]/100,size.height-height,0);
  const [px,py]=points.get(player.position)!;
  const pawnX=x+px*width/100,pawnY=y+py*height/100;
  const commandRaised=!narrow&&!overview&&(pawnX<270||options.length>0&&pawnX>size.width-270)&&pawnY>size.height-150;
  const stepsAside=!narrow&&Math.abs(pawnX-size.width/2)<75&&pawnY<150;
  const toolsRaised=!narrow&&!overview&&x+px*width/100>size.width-270&&y+py*height/100>size.height-150;
  const targets=options.map(id=>({id,x:x+points.get(id)![0]*width/100,y:y+points.get(id)![1]*height/100}));
  const obstacles=[
    ...(!narrow&&options.length>0?[{left:size.width-220,right:size.width,top:76,bottom:size.height-90}]:[]),
    ...(narrow?[{left:0,right:size.width,top:size.height-168,bottom:size.height},{left:0,right:size.width,top:0,bottom:244}]:[]),
    ...(commandRaised?[{left:16,right:size.width-234,top:84,bottom:154}]:[]),
    ...(toolsRaised&&options.length===0?[{left:size.width-220,right:size.width-16,top:84,bottom:156}]:[]),
    ...(stepsAside?[{left:16,right:105,top:84,bottom:142}]:[]),
  ];
  const choices=placeChoices(targets,{x:pawnX,y:pawnY},size,obstacles).map(c=>({id:c.id,cx:points.get(c.id)![0],cy:points.get(c.id)![1],bx:(c.x-x)/width*100,by:(c.y-y)/height*100}));
  useLayoutEffect(()=>{
    if(!overview||!overviewArea.current)return;
    const area=overviewArea.current;
    area.scrollTo({left:px*width/100-area.clientWidth/2,top:py*height/100-area.clientHeight/2});
  },[overview,px,py,width,height]);
  return <div className={`tokyo-board ${overview?'is-overview':''} ${phase.name==='gameResult'?'is-finished':''}`} ref={root}>
    <div inert={standings&&phase.name==='moving'}>
    <div className={overview?"overview-scroll":"map-viewport"} ref={overviewArea} tabIndex={overview?0:undefined} aria-label={overview?"東京全体地図。上下左右にスクロールできます":undefined}>
    <div className="tokyo-camera" style={{width,height,transform:`translate(${x}px,${y}px)`}}>
      <img className="tokyo-art" src={`${import.meta.env.BASE_URL}art/tokyo-board-console.png`} alt="東京の街並み、公園、寺社と湾岸を描いたすごろくマップ"/>
      <svg className="tokyo-routes" viewBox="0 0 1000 562.5" aria-hidden="true">
        <defs>{layout.crossings.map((crossing,i)=><mask key={i} id={`${boardId}-crossing-${i}`} maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="562.5"><rect width="1000" height="562.5" fill="white"/><circle cx={crossing.x} cy={crossing.y} r="7" fill="black"/></mask>)}</defs>
        {state.nodes.flatMap(n=>n.neighbors.filter(id=>n.id<id).map(id=>{const crossing=layout.crossings.findIndex(c=>c.under===`${n.id}:${id}`);return <path key={`${n.id}:${id}`} mask={crossing>=0?`url(#${boardId}-crossing-${crossing})`:undefined} className={`tokyo-track ${selected&&((n.id===player.position&&id===selected)||(id===player.position&&n.id===selected))?'selected':''}`} d={layout.path(n.id,id)}/>}))}
        {state.nodes.map(n=>{const p=points.get(n.id)!,w=n.name?21:17;return <g key={n.id} transform={`translate(${p[0]*10} ${p[1]*5.625})`}><g transform="rotate(-20)"><rect className="tokyo-cell-base" x={-w/2} y={-5} width={w} height={13} rx="2"/><rect x={-w/2} y={-8} width={w} height={13} rx="2" className={`tokyo-cell ${n.cell} ${n.name?'hub':''}`}/></g>{n.cell!=='normal'&&<text className="tokyo-cell-symbol" x="0" y="-1">{n.cell==='blue'?'+':'!'}</text>}</g>})}
        {view==='current'&&choices.map(c=><path key={`guide-${c.id}`} d={`M${c.cx*10} ${c.cy*5.625}L${c.bx*10} ${c.by*5.625}`} fill="none" stroke="#174c6b" strokeWidth="2" strokeDasharray="3 3"/>)}
      </svg>
      {state.nodes.filter(n=>n.name&&(!overview||!overviewFit||n.id===state.destinationId||n.id===player.position)).map(n=>{const p=points.get(n.id)!;return <span key={n.id} className={`tokyo-label ${n.id===state.destinationId?'goal':''}`} style={{left:`${p[0]}%`,top:`${p[1]}%`,transform:state.players.filter(player=>player.position===n.id).length>1?'translate(-50%,24px)':undefined}}>{n.id===state.destinationId?'⚑ ':''}{n.name}</span>})}
      {overview&&<span className="overview-current" style={{left:`${px}%`,top:`${py}%`}}>現在地</span>}
      {state.players.filter((p,i,all)=>!overview||all.findIndex(v=>v.position===p.position)===i).map(p=>{const pos=points.get(p.position)!,group=state.players.filter(v=>v.position===p.position),slot=group.findIndex(v=>v.id===p.id),offset=group.length>1?[[-19,-12],[19,-12],[-19,18],[19,18]][slot]:[0,0];return <div key={p.id} role="img" aria-label={`${p.name}：${describe(p.position)}${p.id===player.id?'、現在の手番':''}`} className={`tokyo-pawn ${group.length>1?'shared':''}`} style={{left:`${pos[0]}%`,top:`${pos[1]}%`,'--ox':`${offset[0]}px`,'--oy':`${offset[1]}px`} as CSSProperties}><PlayerToken color={colors[p.id%4]} number={p.id+1}/>{overview&&group.length>1&&<small className="pawn-group-count">{group.length}人</small>}</div>})}
      {view==='current'&&choices.map((c,i)=><button key={c.id} className="tokyo-choice" aria-label={`${String.fromCharCode(65+i)} ${describe(c.id)}を選ぶ`} aria-pressed={selected===c.id} style={{left:`${c.bx}%`,top:`${c.by}%`}} onClick={()=>setSelection({from:player.position,id:c.id})}>{String.fromCharCode(65+i)}</button>)}
    </div>
    </div>
    {overview&&<p className="overview-hint">{overviewFit?"全体の位置関係を確認。地名は拡大して表示":"指で地図を動かして、目的地と経路を確認"}</p>}
    {phase.name==='moving'&&view==='current'&&options.length>0&&<div className="route-comparison" aria-label="進路の比較">{options.map((id,i)=><button key={id} aria-pressed={selected===id} onClick={()=>setSelection({from:player.position,id})}><b>{String.fromCharCode(65+i)} <span>{graph.get(id)!.name||(graph.get(id)!.cell==="blue"?"青マス":graph.get(id)!.cell==="red"?"赤マス":"通常マス")}</span></b><small>目的地まで <strong>{distance(id,state.destinationId!)}マス</strong></small></button>)}</div>}
    <div className="tokyo-hud"><div className="tokyo-player" style={{borderLeftColor:colors[player.id%4]}}><span style={{background:colors[player.id%4]}}>{player.id+1}</span><b>{player.name}</b><strong>{player.money/10000}万円</strong></div><button className={`tokyo-destination ${newDestination?"destination-new":""}`} onClick={()=>setView(view==='destination'?'current':'destination')} aria-pressed={view==='destination'}><span>⚑ {newDestination?'新しい目的地':'目的地'}　{state.destinationId&&describe(state.destinationId)}</span><small>最短 {distance(player.position,state.destinationId!)}マス・到着で{ARRIVAL_PRIZE/10000}万円</small></button></div>
    {phase.name==='moving'&&!overview&&<div className={`tokyo-steps ${stepsAside?'steps-aside':''}`}>あと <b>{phase.remaining}</b> マス</div>}
    <div className={`tokyo-map-tools ${toolsRaised?'tools-raised':''}`}><div className="tokyo-tool-buttons">{overview&&<button onClick={()=>setOverviewFit(!overviewFit)}>{overviewFit?"地図を拡大":"全体を収める"}</button>}<button onClick={()=>setView(view==='current'?'overview':'current')}>{view==='current'?'全体地図':'現在地へ戻る'}</button>{phase.name==='moving'&&<button ref={standingsTrigger} onClick={()=>setStandings(true)}>みんなの状況</button>}</div><small>{state.round} / {MAX_ROUNDS} 周目</small></div>
    {phase.name==='moving'&&view==='current'&&<div className={`tokyo-command ${commandRaised?'command-raised':''}`}><div><strong>{player.kind==='cpu'||!canAct?`${player.name}が移動中…`:selected?describe(selected):'進む先を選ぼう'}</strong><small>{selected?`目的地まで最短 ${distance(selected,state.destinationId!)}マス`:canAct?'マスを選んで「決定」':'移動を見守ろう'}</small></div>{player.kind==='human'&&canAct&&<button disabled={!selected} onClick={()=>{if(selected){onStep(selected);setSelection(null)}}}>決定</button>}</div>}
    </div>
    {standings&&phase.name==='moving'&&<div className="tokyo-standings" role="dialog" aria-modal="true" aria-labelledby="standings-title" onKeyDown={e=>{if(e.key==='Escape')closeStandings();if(e.key==='Tab')e.preventDefault()}}><section><h2 id="standings-title">みんなの状況</h2><p>先に{WIN_MONEY/10000}万円で優勝！</p><ol>{rankPlayers(state.players).map((p,i)=><li key={p.id}><span className="standings-number" style={{background:colors[p.id%4]}}>{p.id+1}</span><span>{i+1}位　{p.name}{p.id===player.id?'（手番）':''}</span><strong>{p.money/10000}万円<small>目的地に{p.arrivals}回到着</small></strong></li>)}</ol><button autoFocus onClick={closeStandings}>マップへ戻る</button></section></div>}
  </div>;
}
