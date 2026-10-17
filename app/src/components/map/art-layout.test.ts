import { expect, it } from 'vitest';
import map from '../../data/map.json';
import type { MapNode } from '../../game/types';
import { buildArtLayout } from './art-layout';

const pathPoints = (path: string) => {
  const values = path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  return Array.from({ length: values.length / 2 }, (_, i) => [values[i * 2], values[i * 2 + 1]]);
};

it('隣接マスの道は遠回りせず、途中で急角度に折れ返さない', () => {
  const nodes = map.nodes as MapNode[], layout = buildArtLayout(nodes);
  for (const node of nodes) for (const next of node.neighbors.filter(id => node.id < id)) {
    const points = pathPoints(layout.path(node.id, next));
    const vectors = points.slice(1).map((p, i) => [p[0] - points[i][0], p[1] - points[i][1]]);
    const lengths = vectors.map(v => Math.hypot(...v));
    const direct = Math.hypot(points.at(-1)![0] - points[0][0], points.at(-1)![1] - points[0][1]);
    expect(lengths.reduce((sum, length) => sum + length, 0) / direct, `${node.id} → ${next}: 遠回り`).toBeLessThan(1.15);
    for (let i = 1; i < vectors.length; i++) {
      const dot = vectors[i - 1][0] * vectors[i][0] + vectors[i - 1][1] * vectors[i][1];
      const cosine = Math.max(-1, Math.min(1, dot / (lengths[i - 1] * lengths[i])));
      expect(Math.acos(cosine) * 180 / Math.PI, `${node.id} → ${next}: 急な折れ曲がり`).toBeLessThan(15);
    }
  }
});

it('同じ路線のマスは見た目の間隔を揃えて並べる', () => {
  const nodes = map.nodes as MapNode[], layout = buildArtLayout(nodes);
  const routes = new Map<string, string[]>();
  for (const node of nodes.filter(n => n.kind === 'stop' && n.id !== 'j1')) {
    const route = node.id.slice(0, node.id.lastIndexOf('-'));
    routes.set(route, [...routes.get(route) ?? [], node.id]);
  }
  for (const [route, cells] of routes) {
    const [from, to] = route.split('-');
    const points = [from, ...cells.sort((a, b) => Number(a.split('-').at(-1)) - Number(b.split('-').at(-1))), to]
      .map(id => layout.points.get(id)!);
    const gaps = points.slice(1).map((p, i) => Math.hypot((p[0] - points[i][0]) * 10, (p[1] - points[i][1]) * 5.625));
    expect(Math.max(...gaps) / Math.min(...gaps), route).toBeLessThan(1.15);
  }
});

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
