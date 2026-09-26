import { gameReducer, initialState, currentPlayer } from './movement-modules/state.js';
import { buildNodeMap, moveOptions } from './movement-modules/graph.js';
import map from './movement-modules/map.js';
import { MockEvaluator } from './movement-modules/mock.js';
import { ANSWER_TIME_LIMIT_MS, ARRIVAL_PRIZE, CHALLENGE_UNIT, rankPlayers } from './movement-modules/rules.js';
import { pickDestination } from './movement-modules/destination.js';
import { pickRandomTopic } from './movement-modules/topics.js';
import topicData from './movement-modules/topic-data.js';

const $ = id => document.getElementById(id);
const graph = buildNodeMap(map.nodes);
// Presentation anchors only. Original map.json, adjacency, rules and cell types stay unchanged.
const anchors = {koenji:[8,29],nakano:[20,34],shinjuku:[31,47],shibuya:[23,60],shimokita:[12,76],ikebukuro:[40,24],jimbocho:[51,40],j1:[62,27],asakusa:[78,30],akihabara:[68,40],shiodome:[63,65],odaiba:[87,87],roppongi:[41,69],yurakucho:[75,55],shinagawa:[52,83]};
const positions = new Map(Object.entries(anchors));
for (const node of map.nodes) {
  if (positions.has(node.id)) continue;
  // Generator creates intermediate ids as from-to-index; interpolate along their own route only.
  const parts = node.id.split('-');
  const from = parts[0], to = parts[1];
  const route = map.nodes.filter(n => n.id.startsWith(`${from}-${to}-`)).sort((a,b) => Number(a.id.split('-').at(-1))-Number(b.id.split('-').at(-1)));
  const t = (route.findIndex(n=>n.id===node.id)+1)/(route.length+1);
  const a=anchors[from], b=anchors[to];
  if (!a||!b) throw new Error(`Missing visual anchor: ${node.id}`);
  positions.set(node.id,[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
}
let state=initialState, selected=null, busy=false, inspectingDestination=false;
let answerTimer=null, previewVersion=0;
let challengeTarget=4;
const evaluator=new MockEvaluator();
const previewPlayers=[{name:'たろう',kind:'human'},{name:'はなこ',kind:'human'},{name:'ケン',kind:'human'},{name:'みどり',kind:'human'}];
const topic={id:'movement-preview',category:'表示検証',difficulty:'Easy',prompt:'東京タワーが突然しゃべった。最初のひと言とは？'};
function dispatch(action){const before=state.phase.name;state=gameReducer(state,action);if(before!=='challengeIntro'&&state.phase.name==='challengeIntro')challengeTarget=1+Math.floor(Math.random()*6)}
function seed(startId='j1',answerFirst=false,score=4){
  clearInterval(answerTimer);previewVersion++;
  // Set up a legal movement state via reducer actions, never mutate gameplay fields in the UI.
  state=initialState;
  dispatch({type:'SHOW_SETUP'});
  dispatch({type:'START_GAME',players:previewPlayers,nodes:map.nodes,startId,destinationId:'asakusa'});
  if(!answerFirst){dispatch({type:'BEGIN_TURN',topic});dispatch({type:'SUBMIT_ANSWER',answer:'移動検証用の固定回答'});
  dispatch({type:'EVALUATED',result:{score,comment:'デザイン検証用の固定点数'}});dispatch({type:'PROCEED'});
  }
  selected=null;busy=false;inspectingDestination=false;returnButton.hidden=true;goal.setAttribute('aria-pressed','false');document.body.classList.remove('destination-view','overview');render();
}
function distance(from,to){let q=[[from,0]],seen=new Set([from]);for(let i=0;i<q.length;i++){const [id,d]=q[i];if(id===to)return d;for(const nb of graph.get(id).neighbors)if(!seen.has(nb)){seen.add(nb);q.push([nb,d+1])}}return null}
function svg(tag,attrs){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));return el}
function near(id){return distance(currentPlayer(state).position,id)<=2}
function render(){
  const player=currentPlayer(state), phase=state.phase;
  const options=phase.name==='moving'?moveOptions(graph,player.position,phase.cameFrom):[];
  const tracks=$('tracks');tracks.replaceChildren();
  for(const n of map.nodes)for(const nb of n.neighbors){if(n.id>nb)continue;const a=positions.get(n.id),b=positions.get(nb);const active=selected&&((n.id===player.position&&nb===selected)||(nb===player.position&&n.id===selected));tracks.append(svg('path',{d:`M ${a[0]*10} ${a[1]*5.625} L ${b[0]*10} ${b[1]*5.625}`,class:`track ${active?'active':near(n.id)&&near(nb)?'':'quiet'}`}))}
  for(const n of map.nodes){const [x,y]=positions.get(n.id);tracks.append(svg('circle',{cx:x*10,cy:y*5.625,r:n.name?7:5,class:`cell ${n.cell} ${n.name?'hub':''} ${n.id===player.position?'current':''}`}))}
  $('boardLabels').replaceChildren();
  for(const n of map.nodes.filter(n=>n.name)){const [x,y]=positions.get(n.id);const label=document.createElement('span');label.className=`map-label ${n.id===state.destinationId?'goal':''} ${near(n.id)?'':'quiet'}`;label.textContent=(n.id===state.destinationId?'⚑ ':'')+n.name;label.style.left=x+'%';label.style.top=y+'%';$('boardLabels').append(label)}
  renderPawns();
  followCurrentPosition();
  $('choices').replaceChildren();
  const camera=document.querySelector('.camera'),placed=[];
  const [px,py]=positions.get(player.position);
  options.forEach((id,i)=>{
    const [cx,cy]=positions.get(id),dx=(cx-px)*camera.clientWidth/100,dy=(cy-py)*camera.clientHeight/100;
    const length=Math.hypot(dx,dy)||1,ux=dx/length,uy=dy/length;
    let radius=Math.max(length,86),x=ux*radius,y=uy*radius;
    while(placed.some(p=>Math.hypot(p[0]-x,p[1]-y)<56)){radius+=16;x=ux*radius;y=uy*radius;}
    placed.push([x,y]);const bx=px+x/camera.clientWidth*100,by=py+y/camera.clientHeight*100;
    tracks.append(svg('path',{d:`M ${cx*10} ${cy*5.625} L ${bx*10} ${by*5.625}`,class:'choice-guide'}));
    const button=document.createElement('button');button.textContent=String.fromCharCode(65+i);button.style.left=bx+'%';button.style.top=by+'%';button.setAttribute('aria-label',`${button.textContent} ${describe(id)}を選ぶ`);button.setAttribute('aria-pressed',String(selected===id));button.disabled=busy;button.onclick=()=>{selected=id;render();$('confirm').focus({preventScroll:true})};$('choices').append(button)
  });
  document.querySelector('.player .number').textContent=player.id+1;
  document.querySelector('.player .number').style.background=['#206caf','#b33248','#287348','#7849ab'][player.id];
  document.querySelector('.player .number').nextElementSibling.textContent=player.name;
  document.querySelector('.player b').textContent=(player.money/10000)+'万円';
  goal.firstChild.textContent=`⚑ 目的地　${describe(state.destinationId)}`;goal.setAttribute('aria-label',`目的地の${describe(state.destinationId)}を地図で確認`);
  document.querySelector('.destination small').textContent=`最短 ${distance(player.position,state.destinationId)}マス・到着で${ARRIVAL_PRIZE/10000}万円`;
  $('steps').hidden=phase.name!=='moving';$('steps').querySelector('b').textContent=phase.name==='moving'?phase.remaining:0;
  $('confirm').disabled=!selected||busy||phase.name!=='moving';
  $('routeText').replaceChildren();const main=document.createElement('span');main.textContent=busy?'移動中…':selected?describe(selected):'進む先を選ぼう';$('routeText').append(main);
  const small=document.createElement('small');small.textContent=selected?`目的地まで最短 ${distance(selected,state.destinationId)}マス`:'明るい経路が現在地の周辺です';$('routeText').append(small);
  $('message').hidden=phase.name!=='moving';renderPanel();
}
function renderPawns(){
  for(const player of state.players){
    let pawn=$('pawn-'+player.id);
    if(!pawn){pawn=document.createElement('div');pawn.id='pawn-'+player.id;pawn.className='pawn';pawn.dataset.player=player.id;pawn.setAttribute('role','img');const number=document.createElement('span');number.textContent=player.id+1;pawn.append(number);document.querySelector('.camera').append(pawn)}
    const group=state.players.filter(p=>p.position===player.position);
    const slot=group.findIndex(p=>p.id===player.id);
    const offset=group.length===1?[0,0]:[[-19,-12],[19,-12],[-19,18],[19,18]][slot];
    const [x,y]=positions.get(player.position);
    pawn.style.left=x+'%';pawn.style.top=y+'%';
    pawn.style.setProperty('--offset-x',offset[0]+'px');pawn.style.setProperty('--offset-y',offset[1]+'px');
    pawn.classList.toggle('shared',group.length>1);pawn.classList.toggle('active',player.id===currentPlayer(state).id);
    pawn.setAttribute('aria-label',`${player.id+1} ${player.name}、${describe(player.position)}${group.length>1?'、'+group.length+'人が同じマス':''}${player.id===currentPlayer(state).id?'、現在の手番':''}`);
  }
}
function describe(id){const node=graph.get(id);return node.name||({blue:'青マス（賞金チャレンジ）',red:'赤マス（減額回避）',normal:'通常マス'})[node.cell]}
const panel=document.createElement('section');panel.id='statusPanel';panel.setAttribute('aria-live','polite');$('game').append(panel);
$('traveler').remove();
const goal=document.createElement('button');goal.className='plate destination';goal.innerHTML='⚑ 目的地　浅草<small></small>';goal.setAttribute('aria-label','目的地の浅草を地図で確認');document.querySelector('.destination').replaceWith(goal);
const returnButton=document.createElement('button');returnButton.id='returnCurrent';returnButton.textContent='現在地へ戻る';returnButton.hidden=true;$('game').append(returnButton);
function setDestinationView(value){inspectingDestination=value;document.body.classList.toggle('destination-view',value);document.body.classList.remove('overview');returnButton.hidden=!value;goal.setAttribute('aria-pressed',String(value));followCurrentPosition()}
goal.onclick=()=>setDestinationView(!inspectingDestination);returnButton.onclick=()=>{setDestinationView(false);goal.focus()};
function beginAnswer(){
  const nextTopic=pickRandomTopic(topicData.topics,state.usedTopicIds);
  dispatch(state.phase.name==='challengeIntro'?{type:'BEGIN_CHALLENGE',topic:nextTopic,target:challengeTarget}:{type:'BEGIN_TURN',topic:nextTopic});render();
  const deadline=performance.now()+ANSWER_TIME_LIMIT_MS;
  const tick=()=>{if(state.phase.name!=='awaitingAnswer'){clearInterval(answerTimer);return;}
    const remaining=Math.max(0,Math.ceil((deadline-performance.now())/1000));
    const clock=$('answerClock');if(clock){clock.textContent=`あと ${remaining} 秒`;clock.classList.toggle('urgent',remaining<=5);}
    if(remaining===0){clearInterval(answerTimer);dispatch({type:'TIME_UP'});render();panel.querySelector('button')?.focus();}
  };answerTimer=setInterval(tick,100);tick();
  $('previewAnswer').focus({preventScroll:true});
}
async function submitAnswer(answer){
  if(state.phase.name!=='awaitingAnswer'||!answer.trim())return;
  clearInterval(answerTimer);const version=previewVersion;
  const prompt=state.phase.topic.prompt;
  dispatch({type:'SUBMIT_ANSWER',answer:answer.trim()});render();
  const result=await evaluator.evaluate(prompt,answer.trim());
  if(version!==previewVersion)return;
  dispatch({type:'EVALUATED',result});render();panel.querySelector('button')?.focus();
}
function renderPanel(){panel.replaceChildren();panel.hidden=state.phase.name==='moving';panel.classList.toggle('answer-panel',['awaitingAnswer','evaluating','showingResult'].includes(state.phase.name));if(panel.hidden)return;const title=document.createElement('h1'),body=document.createElement('p'),button=document.createElement('button');button.className='primary';
  const phase=state.phase;
  panel.dataset.scene=phase.name;
  panel.dataset.tone=phase.name==='challengeIntro'?phase.cellKind:phase.context?.kind||'main';
  if(phase.name==='turnStart'){
    title.textContent=`${currentPlayer(state).name}の番！`;body.textContent='お題を見て15秒で回答。獲得した点数だけマップを進もう。';button.textContent='お題を見る';button.onclick=beginAnswer;panel.append(title,body,button);return;
  }
  if(phase.name==='awaitingAnswer'){
    title.textContent=phase.topic.prompt;
    const header=document.createElement('div');header.className='answer-header';
    const label=document.createElement('span');label.textContent=`${currentPlayer(state).name}のお題`;
    const clock=document.createElement('strong');clock.id='answerClock';clock.textContent='あと 15 秒';header.append(label,clock);
    const form=document.createElement('form'),input=document.createElement('textarea'),inputLabel=document.createElement('label');
    input.id='previewAnswer';input.maxLength=140;input.rows=2;input.placeholder='ひと言でボケよう';inputLabel.htmlFor=input.id;inputLabel.textContent='あなたの回答';
    button.type='submit';button.textContent='この回答で勝負';button.disabled=true;
    input.oninput=()=>button.disabled=!input.value.trim();
    input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229){e.preventDefault();submitAnswer(input.value)}};
    form.onsubmit=e=>{e.preventDefault();submitAnswer(input.value)};
    form.append(inputLabel,input,button);panel.append(header,title,form);return;
  }
  if(phase.name==='evaluating'){title.textContent='採点中…';body.textContent=phase.answer;const note=document.createElement('small');note.textContent='モック採点で結果を準備しています';panel.append(title,body,note);return;}
  if(phase.name==='showingResult'){
    const main=phase.context.kind==='main';
    title.textContent=main?`${phase.result.score}点！ ${phase.result.score}マス進める`:`${phase.result.score}点！ ${phase.moneyDelta>0?'賞金獲得':phase.moneyDelta<0?'減額…':'減額を回避！'}`;
    body.textContent=phase.answer||'時間切れ。今回は1点です。';body.className='submitted-answer';
    const comment=document.createElement('p');comment.textContent=phase.result.comment;
    button.textContent=main?'マップを進む':'結果を受け取る';button.onclick=()=>{dispatch({type:'PROCEED'});render();($('choices').querySelector('button')||panel.querySelector('button'))?.focus({preventScroll:true})};
    panel.append(title,body,comment);if(!main){const amount=document.createElement('strong');amount.className='prize-value';amount.textContent=`${phase.moneyDelta>=0?'＋':'−'}${Math.abs(phase.moneyDelta)/10000}万円`;panel.append(amount)}panel.append(button);return;
  }
  if(phase.name==='arrival'){
    title.textContent=`${describe(phase.nodeId)}に到着！`;body.textContent=`${currentPlayer(state).name}の所持金は${currentPlayer(state).money/10000}万円に！`;
    const prize=document.createElement('strong');prize.className='prize-value';prize.textContent=`到着賞金 ＋${ARRIVAL_PRIZE/10000}万円`;
    button.textContent='次の目的地へ';button.onclick=()=>{dispatch({type:'ARRIVAL_DONE',nextDestinationId:pickDestination(map.nodes,[state.destinationId])});render();panel.querySelector('button')?.focus({preventScroll:true})};panel.append(title,prize,body,button);return;
  }
  if(phase.name==='challengeIntro'){
    const blue=phase.cellKind==='blue';title.textContent=blue?'賞金チャレンジ！':'減額回避チャレンジ！';
    const badge=document.createElement('strong');badge.className='prize-value';badge.textContent=blue?`1点につき ＋${CHALLENGE_UNIT/10000}万円`:`目標 ${challengeTarget}点`;
    body.textContent=blue?'もうひとつのお題に挑戦。高得点で賞金を増やそう！':`${challengeTarget}点以上で減額なし。不足1点につき${CHALLENGE_UNIT/10000}万円減額。`;
    button.textContent='お題に挑戦する';button.onclick=beginAnswer;panel.append(title,badge,body,button);return;
  }
  if(phase.name==='gameResult'){
    title.textContent='旅の結果発表！';const list=document.createElement('ol');list.className='ranking';
    rankPlayers(state.players).forEach((player,i)=>{const row=document.createElement('li');row.textContent=`${i+1}位　${player.name}　${player.money/10000}万円`;list.append(row)});
    button.textContent='もう一度遊ぶ';button.onclick=()=>seed('j1',true);panel.append(title,list,button);return;
  }
}
$('confirm').onclick=()=>{if(busy||!selected||state.phase.name!=='moving')return;busy=true;const target=selected;selected=null;dispatch({type:'STEP_TO',nodeId:target});render();setTimeout(()=>{busy=false;render()},280)};
$('drawer').replaceChildren();for(const [text,fn]of [['浅草方面の移動を試す',()=>seed()],['新宿から移動を試す',()=>seed('shinjuku')],['湾岸の移動を試す',()=>seed('odaiba')],['全体地図 / 現在地',()=>{const wasOverview=document.body.classList.contains('overview');setDestinationView(false);document.body.classList.toggle('overview',!wasOverview);followCurrentPosition()}],['原画だけを見る',()=>document.body.classList.add('art-only')]]){const b=document.createElement('button');b.textContent=text;b.onclick=()=>{fn();$('drawer').hidden=true;$('menu').setAttribute('aria-expanded','false')};$('drawer').append(b)}
$('menu').onclick=()=>{$('drawer').hidden=!$('drawer').hidden;$('menu').setAttribute('aria-expanded',String(!$('drawer').hidden))};
$('artBack').onclick=()=>document.body.classList.remove('art-only');
const answerPreviewButton=document.createElement('button');answerPreviewButton.textContent='回答から移動まで試す';answerPreviewButton.onclick=()=>{seed('j1',true);$('drawer').hidden=true;$('menu').setAttribute('aria-expanded','false');panel.querySelector('button').focus()};$('drawer').prepend(answerPreviewButton);
document.querySelector('.review').textContent='操作見本・モック採点 ／ 街の絵は地理を簡略化';
for(const [kind,label] of [['blue','青マスの画面を試す'],['red','赤マスの画面を試す']]){
  const shortcut=document.createElement('button');shortcut.textContent=label;
  shortcut.onclick=()=>{const cell=map.nodes.find(n=>n.cell===kind);seed(cell.neighbors[0],false,1);dispatch({type:'STEP_TO',nodeId:cell.id});render();$('drawer').hidden=true;$('menu').setAttribute('aria-expanded','false');panel.querySelector('button')?.focus({preventScroll:true})};$('drawer').append(shortcut);
}
function followCurrentPosition(){
  if(!state.players.length)return;
  const camera=document.querySelector('.camera'),game=$('game');
  if(document.body.classList.contains('overview')){camera.style.transform='translate(-50%,-50%)';return;}
  const [x,y]=positions.get(inspectingDestination?state.destinationId:currentPlayer(state).position);
  const cw=camera.offsetWidth,ch=camera.offsetHeight,w=game.clientWidth,h=game.clientHeight;
  const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
  const dx=clamp(cw*(.5-x/100),-(cw-w)/2,(cw-w)/2);
  const dy=clamp(ch*(.5-y/100)-h*.08,-(ch-h)/2,(ch-h)/2);
  camera.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;
}
function resize(){document.documentElement.style.setProperty('--screen-height',(window.visualViewport?.height||innerHeight)+'px');if(state.phase.name==='moving')render();else followCurrentPosition()}window.visualViewport?.addEventListener('resize',resize);window.addEventListener('resize',resize);resize();seed();
