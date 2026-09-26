export interface ScreenPoint {x:number;y:number}
export interface ChoiceTarget extends ScreenPoint {id:string}
export interface ScreenRect {left:number;right:number;top:number;bottom:number}

// Reserve the top for HUD and the bottom for commands. Coordinates are screen pixels.
export function placeChoices(targets:ChoiceTarget[],pawn:ScreenPoint,viewport:{width:number;height:number},obstacles:ScreenRect[]=[]):ChoiceTarget[]{
  const minX=32,maxX=viewport.width-32,minY=142,maxY=Math.max(minY,viewport.height-112);
  const clamp=(n:number,a:number,b:number)=>Math.min(b,Math.max(a,n));
  const placed:ChoiceTarget[]=[];
  for(const target of targets){
    const dx=target.x-pawn.x,dy=target.y-pawn.y,len=Math.hypot(dx,dy)||1;
    const ideal={x:pawn.x+dx/len*Math.max(86,len),y:pawn.y+dy/len*Math.max(86,len)};
    const candidates:ScreenPoint[]=[{x:clamp(ideal.x,minX,maxX),y:clamp(ideal.y,minY,maxY)}];
    for(let y=minY;y<=maxY;y+=8)for(let x=minX;x<=maxX;x+=8)candidates.push({x,y});
    const free=(p:ScreenPoint)=>placed.every(other=>Math.hypot(p.x-other.x,p.y-other.y)>=56)&&!(p.x>pawn.x-60&&p.x<pawn.x+60&&p.y>pawn.y-84&&p.y<pawn.y+44)&&obstacles.every(r=>p.x+31<=r.left||p.x-31>=r.right||p.y+31<=r.top||p.y-31>=r.bottom);
    const available=candidates.filter(free);
    if(!available.length)throw new Error('No unobstructed choice position in this viewport');
    available.sort((a,b)=>Math.hypot(a.x-ideal.x,a.y-ideal.y)-Math.hypot(b.x-ideal.x,b.y-ideal.y));
    placed.push({id:target.id,...available[0]});
  }
  return placed;
}
