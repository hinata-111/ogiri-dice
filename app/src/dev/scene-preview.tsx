import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrivalOverlay } from '../components/ArrivalOverlay';
import { ChallengeIntro } from '../components/ChallengeIntro';
import { GameResultScreen } from '../components/GameResultScreen';
import { ResultOverlay } from '../components/ResultOverlay';
import { TokyoBoard } from '../components/map/TokyoBoard';
import { GameView } from '../components/GameView';
import { RoomLobby } from '../online/RoomLobby';
import { gameReducer, initialState } from '../game/state';
import type { MapNode, Player } from '../game/types';
import map from '../data/map.json';
import '../index.css';
import '../online/online.css';
import '../presentation/presentation.css';
import { AudioProvider } from '../audio/AudioProvider';
import { useAudio } from '../audio/context';
import { RESULT_REVEAL_MS } from '../ui/constants';

const names = ['たろう','はなこ','ケン','みどり'];
const topic = { id:'preview', prompt:'こんな劇場はイヤだ', category:'劇場', difficulty:'Easy' as const };
const players:Player[] = names.map((name,id)=>({id,name,kind:'human',position:'asakusa',money:[1120000,750000,440000,280000][id],arrivals:[3,2,1,0][id]}));
const started = gameReducer(gameReducer(initialState,{type:'SHOW_SETUP'}),{type:'START_GAME', nodes:map.nodes as MapNode[],players:names.map(name=>({name,kind:'human' as const})),startId:'shinjuku',destinationId:'asakusa',simultaneous:true});
function sharedFixture() {
  let state = gameReducer(started, { type:'BEGIN_ROUND',topic });
  for (let id=0;id<4;id++) state=gameReducer(state,{type:'SUBMIT_ROUND_ANSWER',round:state.round,playerId:id,answer:['拍手の音量で家賃が決まる。','幕が上がると、大家さんが最前列で腕を組んでいる。','楽屋の鏡が、毎回ダメ出ししてくる。','終演後のアンコールが町内会の議題になっている。'][id]});
  for (let id=0;id<4;id++) state=gameReducer(state,{type:'ROUND_EVALUATED',round:state.round,playerId:id,result:{score:[5,4,6,3][id],comment:['大家さんが一番真剣！','客席から家賃のプレッシャー。','一番厳しい先輩は鏡でした。','会長がアンコールを仕切るんですね。'][id]}});
  return state;
}
const shared = sharedFixture();
const scenes = [['answer','回答発表'],['shared','全員発表'],['lobby','待機室'],['arrival','到着'],['blue','青マス'],['red','赤マス'],['reward','賞金結果'],['loss','減額結果'],['fallback','採点失敗'],['final','最終順位']];
export function ScenePreview(){
  const requested = new URLSearchParams(window.location.search).get('scene');
  const [scene,setScene]=useState(scenes.some(([id])=>id===requested)?requested!:'answer');
  const {play}=useAudio();
  useEffect(()=>{if(['answer','reward','loss','fallback'].includes(scene)){play('roll');const timer=setTimeout(()=>play(scene==='loss'?'loss':scene==='reward'?'gain':'score',scene==='fallback'?2:5),RESULT_REVEAL_MS);return()=>clearTimeout(timer)}},[scene,play]);
  const next=()=>setScene('final');
  return <main className={`stage scene-preview ${new URLSearchParams(window.location.search).has('clean') ? 'is-clean' : ''}`}><nav className="scene-nav" aria-label="確認する画面">{scenes.map(([id,label])=><button key={id} aria-pressed={scene===id} onClick={()=>{setScene(id);if(id==='arrival')play('arrival');if(id==='final')play('victory');}}>{label}</button>)}</nav>
    <div className="journey-topbar preview-brand" aria-hidden="true"><strong>大喜利ダイス</strong><span>東京の劇場をめぐる</span></div>
    {scene!=='shared'&&scene!=='lobby'&&<div className="preview-board" inert><TokyoBoard state={{...started,players:started.players.map((p,i)=>i===0?{...p,money:scene==='loss'?30000:scene==='reward'||scene==='arrival'?400000:100000}:p)}} canAct={false} onStep={()=>{}}/></div>}
    {scene==='answer'&&<ResultOverlay key={scene} topicPrompt={topic.prompt} playerId={0} result={{score:5,comment:'大家さんが一番真剣！'}} answer="拍手の音量で家賃が決まる。" playerName="たろう" context={{kind:'main'}} moneyDelta={0} money={100000} onProceed={next}/>}
    {scene==='shared'&&<div className="preview-board"><GameView state={shared} dispatch={()=>{}} remaining={0} cpuAnswer={null} online canAct={false} playerId={0}/></div>}
    {scene==='lobby'&&<RoomLobby room={{code:'ABCD2345',revision:1,gameRevision:1,hostId:'a',members:names.map((name,i)=>({id:String.fromCharCode(97+i),name,connected:true,playerId:null})),game:initialState,deadline:null,expiresAt:100000,serverNow:1,expired:false}} memberId="a" inviteUrl="http://localhost/?room=ABCD2345" copied={false} connected pending={false} onCopy={()=>{}} onStart={()=>setScene('shared')}/>}
    {scene==='arrival'&&<ArrivalOverlay name="浅草" money={400000} onContinue={next}/>}
    {(scene==='blue'||scene==='red')&&<ChallengeIntro cellKind={scene} onBegin={()=>setScene('fallback')}/>}
    {(scene==='reward'||scene==='loss')&&<ResultOverlay key={scene} topicPrompt={topic.prompt} playerId={0} result={{score:scene==='reward'?6:1,comment:'劇場の日常と、予想外の結末を結びつけたところに面白さがありました。楽屋での細かい仕草まで想像できる、次の舞台にも期待したくなる回答です。'}} answer={'拍手の音量で家賃が決まり、大家さんが最前列で真剣にメモを取りながら、アンコールのたびに電卓を叩いている。'.repeat(2).slice(0,120)} playerName="長い名前のプレイヤー" context={scene==='reward'?{kind:'blue'}:{kind:'red',target:4}} moneyDelta={scene==='reward'?180000:-90000} money={scene==='reward'?400000:30000} onProceed={next} onRetry={next}/>}
    {scene==='fallback'&&<ResultOverlay key={scene} topicPrompt={topic.prompt} playerId={1} result={{score:3,comment:'仮の点数で続けられます',fallback:true}} answer="幕が上がると、大家さんが最前列で腕を組んでいる。" playerName="はなこ" context={{kind:'main'}} moneyDelta={0} money={100000} onProceed={next} onRetry={next}/>}
    {scene==='final'&&<GameResultScreen players={players} winnerId={0} winMoney={1000000} bestAnswers={[{playerName:'はなこ',topicPrompt:topic.prompt,answer:'拍手の音量で家賃が決まる。',score:6,comment:'大家さんが一番真剣！'}]} onRestart={()=>setScene('answer')}/>}
    <small className="scene-note">画面確認用の固定データ・ゲーム進行には影響しません</small>
  </main>;
}
createRoot(document.getElementById('root')!).render(<AudioProvider><ScenePreview/></AudioProvider>);
