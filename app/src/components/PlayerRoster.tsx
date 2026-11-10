import type { CSSProperties } from 'react';
import type { GameState } from '../game/state';
import { rankPlayers } from '../game/rules';
import { playerColors } from '../presentation/palette';

function progress(state:GameState,playerId:number):string {
  const phase=state.phase,entry=state.sharedRound?.entries.find(item=>item.playerId===playerId);
  if(phase.name==='roundAnswering')return entry?.submitted?'提出済み':'回答中';
  if(phase.name==='roundEvaluating')return !entry?.submitted?'未回答':entry.result?'採点済み':'採点中';
  if(phase.name==='roundResults')return entry?.result?`${entry.result.score}点`:'結果待ち';
  if(phase.name==='turnStart'&&state.simultaneous)return '開始待ち';
  if(phase.name==='gameResult')return state.winnerId===playerId?'優勝':'終了';
  if(state.players[state.currentPlayerIndex]?.id!==playerId)return '';
  const labels:Partial<Record<GameState['phase']['name'],string>>={
    turnStart:'準備中',moving:'移動中',challengeIntro:'追加お題',awaitingAnswer:'回答中',
    evaluating:'採点中',showingResult:'結果発表',arrival:'到着！',
  };
  return labels[phase.name]??'';
}

export function PlayerRoster({state}:{state:GameState}) {
  if(!state.players.length)return null;
  const ranks=new Map(rankPlayers(state.players).map((player,index)=>[player.id,index+1]));
  const personalTurn=['moving','challengeIntro','awaitingAnswer','evaluating','showingResult','arrival'].includes(state.phase.name)
    ||state.phase.name==='turnStart'&&!state.simultaneous;
  return <section className="player-roster" aria-label="みんなの状況" style={{'--roster-count':state.players.length} as CSSProperties}>
    <h2>みんなの状況</h2>
    <ol className="player-roster-list" aria-label="全員の状況">
      {state.players.map(player=>{
        const active=personalTurn&&state.players[state.currentPlayerIndex]?.id===player.id;
        const status=progress(state,player.id);
        return <li key={player.id} className={`player-roster-item${active?' is-active':''}`} aria-current={active?true:undefined}
          style={{'--player-color':playerColors[player.id%playerColors.length]} as CSSProperties}>
          <div className="roster-person"><span className="roster-number">{player.id+1}</span><strong className="roster-name" title={player.name}>{player.name}</strong>
            {player.kind==='cpu'&&<span className="roster-cpu">CPU</span>}{status&&<span className="roster-progress">{status}</span>}</div>
          <div className="roster-totals"><span className="roster-rank">{ranks.get(player.id)}位</span><b>{player.money/10000}万円</b><span className="roster-arrivals">到着{player.arrivals}回</span></div>
        </li>;
      })}
    </ol>
  </section>;
}
