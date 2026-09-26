import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrivalOverlay } from './components/ArrivalOverlay';
import { ChallengeIntro } from './components/ChallengeIntro';
import { GameResultScreen } from './components/GameResultScreen';
import { ResultOverlay } from './components/ResultOverlay';
import type { Player } from './game/types';
import './index.css';

const players:Player[]=['たろう','はなこ','ケン','みどり'].map((name,id)=>({id,name,kind:'human',position:'asakusa',money:[1120000,750000,440000,280000][id],arrivals:[3,2,1,0][id]}));
export function ScenePreview(){
  const [scene,setScene]=useState('arrival');
  const next=()=>setScene('final');
  return <main className="stage"><nav className="scene-nav" aria-label="確認する画面">{[['arrival','到着'],['blue','青マス'],['red','赤マス'],['reward','賞金結果'],['loss','減額結果'],['fallback','採点失敗'],['final','最終順位']].map(([id,label])=><button key={id} aria-pressed={scene===id} onClick={()=>setScene(id)}>{label}</button>)}</nav>
    {scene==='arrival'&&<ArrivalOverlay name="浅草" money={400000} onContinue={next}/>}
    {(scene==='blue'||scene==='red')&&<ChallengeIntro cellKind={scene} onBegin={()=>setScene('fallback')}/>}
    {(scene==='reward'||scene==='loss')&&<ResultOverlay key={scene} result={{score:scene==='reward'?6:1,comment:'東京の街をよく見ている回答です。予想外の結末と、登場人物の細かい仕草を結びつけたところに面白さがありました。'}} answer={'改札を抜けたら駅員さんが座布団を配っていて、乗り換え案内にも「次のボケまで徒歩五分」と書いてあった。'.repeat(2).slice(0,100)} playerName="東京を巡るたろう" context={scene==='reward'?{kind:'blue'}:{kind:'red',target:4}} moneyDelta={scene==='reward'?180000:-90000} money={scene==='reward'?400000:30000} onProceed={next} onRetry={next}/>}
    {scene==='fallback'&&<ResultOverlay key={scene} result={{score:3,comment:'仮の点数で続けられます',fallback:true}} answer="東京タワーがスカイツリーに背伸びのコツを聞いていた" playerName="たろう" context={{kind:'main'}} moneyDelta={0} money={100000} onProceed={next} onRetry={next}/>}
    {scene==='final'&&<GameResultScreen players={players} winnerId={0} winMoney={1000000} bestAnswers={[{playerName:'はなこ',topicPrompt:'東京タワーが突然しゃべった。最初のひと言は？',answer:'スカイツリーには内緒だぞ',score:6,comment:'街じゅうが笑った！'}]} onRestart={()=>setScene('arrival')}/>}
    <small className="scene-note">画面確認用の固定データ・ゲーム進行には影響しません</small>
  </main>;
}
createRoot(document.getElementById('root')!).render(<ScenePreview/>);
