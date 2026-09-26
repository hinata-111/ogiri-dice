import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TokyoBoard } from './components/map/TokyoBoard';
import { gameReducer,initialState } from './game/state';
import type { MapNode } from './game/types';
import map from './data/map.json';
import './index.css';

function fixture(startId:string){
  let state=gameReducer(initialState,{type:'SHOW_SETUP'});
  state=gameReducer(state,{type:'START_GAME',nodes:map.nodes as MapNode[],players:['たろう','はなこ','ケン','みどり'].map(name=>({name,kind:'human'})),startId,destinationId:startId==='asakusa'?'shinjuku':'asakusa'});
  state=gameReducer(state,{type:'BEGIN_TURN',topic:{id:'preview',prompt:'表示確認',category:'確認',difficulty:'Easy'}});
  state=gameReducer(state,{type:'SUBMIT_ANSWER',answer:'表示確認'});
  state=gameReducer(state,{type:'EVALUATED',result:{score:6,comment:'表示確認'}});
  return gameReducer(state,{type:'PROCEED'});
}
export function BoardPreview(){
  const [start,setStart]=useState('odaiba'),[state,setState]=useState(()=>fixture('odaiba'));
  return <><div className="stage" style={{height:'calc(100dvh - 52px)'}}><TokyoBoard key={start} state={state} onStep={id=>setState(s=>gameReducer(s,{type:'STEP_TO',nodeId:id}))}/></div><div className="board-review-toolbar"><label>確認する地点 <select value={start} onChange={e=>{setStart(e.target.value);setState(fixture(e.target.value))}}>{map.nodes.map(n=><option key={n.id} value={n.id}>{n.name||n.id}</option>)}</select></label><button onClick={()=>setState(fixture(start))}>配置を戻す</button><small>4人同居・全候補の確認用</small></div></>;
}
createRoot(document.getElementById('root')!).render(<BoardPreview/>);
