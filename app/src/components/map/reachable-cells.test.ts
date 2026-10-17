import { expect, it } from 'vitest';
import { buildNodeMap } from '../../game/graph';
import type { MapNode } from '../../game/types';
import { reachableCells } from './reachable-cells';

const graph = buildNodeMap([
  {id:'a',neighbors:['b']}, {id:'b',neighbors:['a','c']},
  {id:'c',neighbors:['b','d']}, {id:'d',neighbors:['c']},
].map(n=>({...n,name:n.id,kind:'stop',cell:'normal',x:0,y:0} as MapNode)));

it('残り歩数以内に通れるマスを表示し、来た道を除く',()=>{
  expect([...reachableCells(graph,'b','a',1,'d')]).toEqual(['c']);
  expect([...reachableCells(graph,'b','a',2,'d')]).toEqual(['c','d']);
});
it('目的地に着いた後の道は含めず、行き止まりだけは折り返せる',()=>{
  expect([...reachableCells(graph,'a',null,6,'c')]).toEqual(['b','c']);
  expect([...reachableCells(graph,'d','c',1,'a')]).toEqual(['c']);
});
