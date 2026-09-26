import { expect,it } from 'vitest';
import map from '../../data/map.json';
import type { MapNode } from '../../game/types';
import { buildArtLayout } from './art-layout';
import { placeChoices } from './choice-layout';

it.each([[844,390],[667,375],[568,320],[393,852],[375,667],[320,568]])('全マスの全候補が画面内でHUD・コマ・他候補を避ける (%i×%i)',(vw,vh)=>{
  const nodes=map.nodes as MapNode[],{points}=buildArtLayout(nodes),width=Math.max(vw,vh*16/9)*1.25,height=width*9/16;
  for(const node of nodes){
    const p=points.get(node.id)!,x=Math.max(vw-width,Math.min(0,vw*.5-width*p[0]/100)),y=Math.max(vh-height,Math.min(0,vh*.42-height*p[1]/100));
    const pawn={x:x+width*p[0]/100,y:y+height*p[1]/100};
    const targets=node.neighbors.map(id=>({id,x:x+width*points.get(id)![0]/100,y:y+height*points.get(id)![1]/100}));
    const narrow=vw<=600&&vh>=500;
    const obstacles=narrow?[{left:0,right:vw,top:vh-168,bottom:vh},{left:0,right:vw,top:0,bottom:244}]:[
      {left:vw-220,right:vw,top:76,bottom:vh-90},
      ...((pawn.x<270||pawn.x>vw-270)&&pawn.y>vh-150?[{left:16,right:vw-234,top:84,bottom:154}]:[]),
      ...(Math.abs(pawn.x-vw/2)<75&&pawn.y<150?[{left:16,right:105,top:84,bottom:142}]:[]),
    ];
    const result=placeChoices(targets,pawn,{width:vw,height:vh},obstacles);
    expect(result.map(c=>c.id)).toEqual(node.neighbors);
    for(const c of result){
      expect(c.x).toBeGreaterThanOrEqual(32);expect(c.x).toBeLessThanOrEqual(vw-32);
      expect(c.y).toBeGreaterThanOrEqual(142);expect(c.y).toBeLessThanOrEqual(vh-112);
      expect(c.x>pawn.x-60&&c.x<pawn.x+60&&c.y>pawn.y-84&&c.y<pawn.y+44).toBe(false);
      for(const rect of obstacles)expect(c.x+31<=rect.left||c.x-31>=rect.right||c.y+31<=rect.top||c.y-31>=rect.bottom).toBe(true);
      for(const other of result)if(c.id!==other.id)expect(Math.hypot(c.x-other.x,c.y-other.y)).toBeGreaterThanOrEqual(56);
    }
  }
});
