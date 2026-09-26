import { expect, it } from 'vitest';
import map from '../../data/map.json';
import type { MapNode } from '../../game/types';
import { buildArtLayout } from './art-layout';

it('全マスを原画内に配置し、実データの全接続を両端のマスまで描く',()=>{
  const nodes=map.nodes as MapNode[],before=JSON.stringify(nodes),layout=buildArtLayout(nodes);
  for(const n of nodes){
    const point=layout.points.get(n.id)!;
    expect(point.every(v=>Number.isFinite(v)&&v>=0&&v<=100)).toBe(true);
    for(const next of n.neighbors){
      const p=layout.path(n.id,next).match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      const ends=[[p[0]/10,p[1]/5.625],[p.at(-2)!/10,p.at(-1)!/5.625]];
      for(const id of [n.id,next])expect(ends.some(end=>Math.hypot(end[0]-layout.points.get(id)![0],end[1]-layout.points.get(id)![1])<.0001)).toBe(true);
      expect(layout.path(n.id,next)).toBe(layout.path(next,n.id));
    }
  }
  expect(JSON.stringify(nodes)).toBe(before);
  // The two non-junction crossings must be rendered as overpasses, never as extra nodes.
  expect(layout.crossings).toHaveLength(2);
  for(const crossing of layout.crossings){
    expect([...layout.points.values()].every(p=>Math.hypot(p[0]*10-crossing.x,p[1]*5.625-crossing.y)>7)).toBe(true);
  }
});
