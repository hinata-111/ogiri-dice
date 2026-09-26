import type { MapNode } from '../../game/types';

type Point = [number, number];
// Art-space percentages. These describe the streets in tokyo-board.png, not geography or gameplay.
const hubs:Record<string,Point>={koenji:[10,30],nakano:[22,34],shinjuku:[37,47],shibuya:[22,58],shimokita:[13,74],ikebukuro:[41,23],jimbocho:[51,39],j1:[60,35],asakusa:[82,29],akihabara:[70,39],shiodome:[59,55],odaiba:[89,87],roppongi:[43,71],yurakucho:[78,55],shinagawa:[52,86]};
// Individually placed bends follow open plazas, road verges and bridge approaches.
const bends:Record<string,Point[]>={
  'koenji-nakano':[[14,33],[19,36]],
  'nakano-shinjuku':[[21,39],[24,42],[30,46]],
  'shinjuku-jimbocho':[[42,44],[47,41]],
  'shinjuku-shibuya':[[32,49],[27,53]],
  'shibuya-shimokita':[[18,62],[16,67]],
  'shibuya-roppongi':[[27,63],[33,67],[38,70]],
  'ikebukuro-jimbocho':[[45,25],[47,30],[48,35]],
  'jimbocho-shiodome':[[49,44],[54,44],[55,49]],
  'jimbocho-j1':[[55,38]],
  'j1-asakusa':[[67,38],[73,37],[77,33]],
  'j1-akihabara':[[64,39],[68,40]],
  'shiodome-akihabara':[[58,51],[57,47],[61,47],[67,46],[71,43]],
  'shiodome-odaiba':[[65,61],[71,63],[77,58],[82,62],[89,67],[96,72],[98,76],[97,81],[94,85]],
  'odaiba-roppongi':[[84,85],[79,83],[72,81],[64,77],[57,75],[49,74]],
  'roppongi-shinagawa':[[42,76],[45,81]],
  'akihabara-yurakucho':[[73,43],[76,48]],
  'yurakucho-shinagawa':[[72,58],[67,62],[61,67],[56,69],[54,75],[56,81]],
};
const length=(a:Point,b:Point)=>Math.hypot((b[0]-a[0])*16/9,b[1]-a[1]);
const key=(a:string,b:string)=>[a,b].sort().join(':');
export function buildArtLayout(nodes:MapNode[]){
  const points=new Map<string,Point>(Object.entries(hubs)),paths=new Map<string,string>(),segments=new Map<string,Point[]>();
  for(const [route,via] of Object.entries(bends)){
    const [from,to]=route.split('-');
    const cells=nodes.filter(n=>n.id.startsWith(`${route}-`)).sort((a,b)=>Number(a.id.split('-').at(-1))-Number(b.id.split('-').at(-1)));
    const ids=[from,...cells.map(n=>n.id),to],line=[hubs[from],...via,hubs[to]];
    const cumulative=[0];for(let i=1;i<line.length;i++)cumulative.push(cumulative[i-1]+length(line[i-1],line[i]));
    const total=cumulative.at(-1)!;
    const at=(d:number):Point=>{for(let i=1;i<line.length;i++){if(d<=cumulative[i]){const t=(d-cumulative[i-1])/(cumulative[i]-cumulative[i-1]);return [line[i-1][0]+(line[i][0]-line[i-1][0])*t,line[i-1][1]+(line[i][1]-line[i-1][1])*t]}}return line.at(-1)!};
    ids.forEach((id,i)=>points.set(id,at(total*i/(ids.length-1))));
    for(let i=1;i<ids.length;i++){
      const start=total*(i-1)/(ids.length-1),end=total*i/(ids.length-1);
      const segment=[at(start),...line.filter((_,j)=>cumulative[j]>start&&cumulative[j]<end),at(end)];
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
