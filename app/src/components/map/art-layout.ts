import type { MapNode } from '../../game/types';

type Point = [number, number];
// Art-space percentages. Keep the board readable over the city without changing gameplay.
const hubs:Record<string,Point>={koenji:[10,30],nakano:[22,34],shinjuku:[37,47],shibuya:[22,58],shimokita:[13,74],ikebukuro:[41,23],jimbocho:[51,39],j1:[60,35],asakusa:[82,29],akihabara:[70,39],shiodome:[59,55],odaiba:[89,87],roppongi:[43,71],yurakucho:[78,55],shinagawa:[52,86]};
// One gentle quadratic arc per route, or a straight line (null). Extra street bends
// made a single step zigzag several times and put its cells at uneven visual gaps.
const routes:Record<string,Point|null>={
  'koenji-nakano':[16,34],
  'nakano-shinjuku':[25,44],
  'shinjuku-jimbocho':[44,44],
  'shinjuku-shibuya':null,
  'shibuya-shimokita':null,
  'shibuya-roppongi':[31,69],
  'ikebukuro-jimbocho':[48,27],
  'jimbocho-shiodome':null,
  'jimbocho-j1':null,
  'j1-asakusa':[72,35],
  'j1-akihabara':[65,39],
  'shiodome-akihabara':[62,44],
  'shiodome-odaiba':[76,65],
  'odaiba-roppongi':[65,84],
  'roppongi-shinagawa':null,
  'akihabara-yurakucho':null,
  'yurakucho-shinagawa':[62,69],
};
const CURVE_STEPS=32;
const length=(a:Point,b:Point)=>Math.hypot((b[0]-a[0])*16/9,b[1]-a[1]);
const key=(a:string,b:string)=>[a,b].sort().join(':');
export function buildArtLayout(nodes:MapNode[]){
  const points=new Map<string,Point>(Object.entries(hubs)),paths=new Map<string,string>(),segments=new Map<string,Point[]>();
  for(const [route,control] of Object.entries(routes)){
    const [from,to]=route.split('-');
    const cells=nodes.filter(n=>n.id.startsWith(`${route}-`)).sort((a,b)=>Number(a.id.split('-').at(-1))-Number(b.id.split('-').at(-1)));
    const ids=[from,...cells.map(n=>n.id),to],a=hubs[from],b=hubs[to];
    // Sample the same arc for cell spacing, drawing and overpass detection so
    // hit targets, pawns and route ends all keep using the exact cell positions.
    const line:Point[]=control?Array.from({length:CURVE_STEPS+1},(_,i)=>{
      const t=i/CURVE_STEPS,u=1-t;
      return [u*u*a[0]+2*u*t*control[0]+t*t*b[0],u*u*a[1]+2*u*t*control[1]+t*t*b[1]];
    }):[a,b];
    const cumulative=[0];for(let i=1;i<line.length;i++)cumulative.push(cumulative[i-1]+length(line[i-1],line[i]));
    const total=cumulative.at(-1)!;
    const at=(d:number):Point=>{for(let i=1;i<line.length;i++){if(d<=cumulative[i]){const t=(d-cumulative[i-1])/(cumulative[i]-cumulative[i-1]);return [line[i-1][0]+(line[i][0]-line[i-1][0])*t,line[i-1][1]+(line[i][1]-line[i-1][1])*t]}}return line.at(-1)!};
    ids.forEach((id,i)=>points.set(id,at(total*i/(ids.length-1))));
    for(let i=1;i<ids.length;i++){
      const start=total*(i-1)/(ids.length-1),end=total*i/(ids.length-1);
      const segment=[at(start),...line.filter((_,j)=>cumulative[j]>start+1e-8&&cumulative[j]<end-1e-8),at(end)];
      segments.set(key(ids[i-1],ids[i]),segment);
      paths.set(key(ids[i-1],ids[i]),segment.map((p,j)=>`${j?'L':'M'}${p[0]*10} ${p[1]*5.625}`).join(' '));
    }
  }
  for(const n of nodes){if(!points.has(n.id))throw new Error(`Missing art position: ${n.id}`);for(const neighbor of n.neighbors)if(!paths.has(key(n.id,neighbor)))throw new Error(`Missing art route: ${n.id}:${neighbor}`)}
  // Only interior intersections are overpasses. Shared ends remain real junctions.
  const crossings:{under:string;x:number;y:number}[]=[],edges=[...segments];
  for(let a=0;a<edges.length;a++)for(let b=a+1;b<edges.length;b++){
    const [under,line]=edges[a],other=edges[b][1];
    for(let i=1;i<line.length;i++)for(let j=1;j<other.length;j++){
      const [x,y]=line[i-1],[u,v]=other[j-1];
      const dx=line[i][0]-x,dy=line[i][1]-y,ex=other[j][0]-u,ey=other[j][1]-v;
      const den=dx*ey-dy*ex;if(Math.abs(den)<1e-8)continue;
      const t=((u-x)*ey-(v-y)*ex)/den,s=((u-x)*dy-(v-y)*dx)/den;
      if(t>1e-6&&t<1-1e-6&&s>1e-6&&s<1-1e-6)crossings.push({under,x:(x+t*dx)*10,y:(y+t*dy)*5.625});
    }
  }
  return {points,crossings,path:(a:string,b:string)=>paths.get(key(a,b))!};
}
