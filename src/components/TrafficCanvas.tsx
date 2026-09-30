import { useEffect, useMemo, useRef, useState } from 'react';
import { Arrow, Circle, Group, Layer, Line, Rect, Stage, Text } from 'react-konva';
import { directionForRoad } from '../model/network';
import type { Junction, Road, SimulationState, Vehicle } from '../types';
import { VehicleShape } from './VehicleShape';

const congestionColor: Record<string, string> = { LOW: '#2bb673', MEDIUM: '#f2b134', HIGH: '#ef6b3f', SEVERE: '#d92842' };

function Signal({ x, y, state, rotation = 0 }: { x: number; y: number; state: string; rotation?: number }) {
  const light = state === 'GREEN' ? '#36d26f' : state === 'YELLOW' ? '#f6c23e' : '#f04444';
  return <Group x={x} y={y} rotation={rotation}><Rect width={16} height={42} cornerRadius={5} fill="#111923" stroke="#465261" strokeWidth={1.3} shadowBlur={3} shadowOpacity={0.2} /><Circle x={8} y={9} radius={3.5} fill={state === 'RED' ? light : '#3f2329'} /><Circle x={8} y={21} radius={3.5} fill={state === 'YELLOW' ? light : '#4c4324'} /><Circle x={8} y={33} radius={3.5} fill={state === 'GREEN' ? light : '#203a2d'} /></Group>;
}

function JunctionVisual({ junction }: { junction: Junction }) {
  const s = junction.size, road = 56;
  return <Group x={junction.x} y={junction.y}>
    <Rect x={-s / 2} y={-s / 2} width={s} height={s} fill="#2f3339" /><Rect x={-road / 2} y={-s / 2} width={road} height={s} fill="#252a31" /><Rect x={-s / 2} y={-road / 2} width={s} height={road} fill="#252a31" />
    <Line points={[-s/2,-road/2,s/2,-road/2]} stroke="#f4d65e" strokeWidth={2.2} /><Line points={[-s/2,road/2,s/2,road/2]} stroke="#f4d65e" strokeWidth={2.2} /><Line points={[-road/2,-s/2,-road/2,s/2]} stroke="#f4d65e" strokeWidth={2.2} /><Line points={[road/2,-s/2,road/2,s/2]} stroke="#f4d65e" strokeWidth={2.2} />
    <Line points={[-s/2,0,-road/2,0]} stroke="#edf2f7" strokeWidth={1.2} dash={[10,8]} /><Line points={[road/2,0,s/2,0]} stroke="#edf2f7" strokeWidth={1.2} dash={[10,8]} /><Line points={[0,-s/2,0,-road/2]} stroke="#edf2f7" strokeWidth={1.2} dash={[10,8]} /><Line points={[0,road/2,0,s/2]} stroke="#edf2f7" strokeWidth={1.2} dash={[10,8]} />
    {[-1,1].flatMap(sign => Array.from({length:6}).map((_,i)=><Rect key={`hz-${sign}-${i}`} x={-42+i*8} y={sign*37} width={5} height={8} fill="#f5f7f9" />))}
    {[-1,1].flatMap(sign => Array.from({length:6}).map((_,i)=><Rect key={`vt-${sign}-${i}`} x={sign*37} y={-42+i*8} width={8} height={5} fill="#f5f7f9" />))}
    <Line points={[-38,-38,38,38]} stroke="#d6a23c" strokeWidth={1} /><Line points={[-38,38,38,-38]} stroke="#d6a23c" strokeWidth={1} />
    <Signal x={-s/2-25} y={-25} state={junction.signal.W} /><Signal x={s/2+9} y={25} state={junction.signal.E} rotation={180} /><Signal x={-25} y={-s/2-25} state={junction.signal.N} rotation={90} /><Signal x={25} y={s/2+9} state={junction.signal.S} rotation={270} />
    <Rect x={-34} y={-79} width={68} height={22} cornerRadius={10} fill="#13283b" stroke="#3e7eac" strokeWidth={1.2} /><Text x={-34} y={-75} width={68} text={junction.id} fontSize={12} align="center" fill="#eef6ff" fontStyle="bold" />
  </Group>;
}

function RoadVisual({ road, selected, onClick }: { road: Road; selected: boolean; onClick: () => void }) {
  if (!road.isActive) return <Line points={[road.start.x,road.start.y,road.end.x,road.end.y]} stroke="#4f5964" strokeWidth={62} opacity={0.28} dash={[12,12]} onClick={onClick} />;
  const lane=26, angle=Math.atan2(road.end.y-road.start.y,road.end.x-road.start.x), perp={x:-Math.sin(angle),y:Math.cos(angle)}, offset=22, c=congestionColor[road.congestion];
  return <Group onClick={onClick}>
    <Line points={[road.start.x,road.start.y,road.end.x,road.end.y]} stroke="#181d24" strokeWidth={62} />
    <Line points={[road.start.x+perp.x*offset,road.start.y+perp.y*offset,road.end.x+perp.x*offset,road.end.y+perp.y*offset]} stroke="#303740" strokeWidth={lane*Math.max(1,road.laneCount/2)} />
    <Line points={[road.start.x-perp.x*offset,road.start.y-perp.y*offset,road.end.x-perp.x*offset,road.end.y-perp.y*offset]} stroke="#303740" strokeWidth={lane*Math.max(1,road.laneCount/2)} />
    <Line points={[road.start.x+perp.x*2,road.start.y+perp.y*2,road.end.x+perp.x*2,road.end.y+perp.y*2]} stroke="#f5d44d" strokeWidth={1.6} /><Line points={[road.start.x-perp.x*2,road.start.y-perp.y*2,road.end.x-perp.x*2,road.end.y-perp.y*2]} stroke="#f5d44d" strokeWidth={1.6} />
    <Line points={[road.start.x+perp.x*offset,road.start.y+perp.y*offset,road.end.x+perp.x*offset,road.end.y+perp.y*offset]} stroke="#eef0f3" strokeWidth={1.1} dash={[10,10]} /><Line points={[road.start.x-perp.x*offset,road.start.y-perp.y*offset,road.end.x-perp.x*offset,road.end.y-perp.y*offset]} stroke="#eef0f3" strokeWidth={1.1} dash={[10,10]} />
    <Arrow points={[road.start.x+(road.end.x-road.start.x)*.28,road.start.y+(road.end.y-road.start.y)*.28,road.start.x+(road.end.x-road.start.x)*.33,road.start.y+(road.end.y-road.start.y)*.33]} stroke="#e7ebef" fill="#e7ebef" pointerLength={5} pointerWidth={5} />
    <Line points={[road.start.x,road.start.y,road.end.x,road.end.y]} stroke={c} strokeWidth={selected?6:3} opacity={selected?.95:.72} />
    {selected && <Text x={(road.start.x+road.end.x)/2-52} y={(road.start.y+road.end.y)/2-48} text={`${road.id}\n${Math.round(road.density*100)}% • ${road.vehicleIds.length} veh`} fontSize={11} fill="#fff" padding={7} align="center" width={105} />}
  </Group>;
}

export function TrafficCanvas({ state, onRoadClick, onJunctionClick }: { state: SimulationState; onRoadClick:(id:string)=>void; onJunctionClick:(id:string)=>void }) {
  const stageWrap=useRef<HTMLDivElement|null>(null); const [scale,setScale]=useState(.88); const [pan,setPan]=useState({x:0,y:0});
  const roads=Object.values(state.roads).filter(r=>!r.source.startsWith('EXTERNAL')), junctions=Object.values(state.junctions), vehicles=Object.values(state.vehicles);
  useEffect(()=>{const fit=()=>{if(!stageWrap.current)return;const width=stageWrap.current.clientWidth,height=stageWrap.current.clientHeight,next=Math.min((width-20)/1600,(height-20)/840),s=Math.max(.45,Math.min(1,next));setScale(s);setPan({x:(width-1600*s)/2,y:(height-840*s)/2})};fit();window.addEventListener('resize',fit);return()=>window.removeEventListener('resize',fit)},[]);
  const worldRoads=useMemo(()=>roads,[roads]);
  return <div className="canvas-wrap" ref={stageWrap}><Stage width={stageWrap.current?.clientWidth??1200} height={stageWrap.current?.clientHeight??760} scaleX={scale} scaleY={scale} x={pan.x} y={pan.y}><Layer>
    <Rect x={0} y={0} width={1600} height={840} fill="#6f9d63" />
    {Array.from({length:50}).map((_,i)=><Circle key={i} x={(i*317)%1590+5} y={(i*173)%820+10} radius={6+(i%4)*2} fill={i%3===0?'#5f8d54':'#799e68'} opacity={.75}/>)}
    {worldRoads.map(r=><RoadVisual key={r.id} road={r} selected={state.selectedRoadId===r.id} onClick={()=>onRoadClick(r.id)}/>)}{junctions.map(j=><Group key={j.id} onClick={()=>onJunctionClick(j.id)}><JunctionVisual junction={j}/></Group>)}{vehicles.map(v=><VehicleLayer key={v.id} vehicle={v} roads={state.roads}/>)}
  </Layer></Stage><div className="map-legend"><div><span className="legend-dot low"/>LOW</div><div><span className="legend-dot med"/>MEDIUM</div><div><span className="legend-dot high"/>HIGH</div><div><span className="legend-dot severe"/>SEVERE</div></div></div>;
}
function VehicleLayer({vehicle,roads}:{vehicle:Vehicle;roads:Record<string,Road>}){const road=roads[vehicle.currentRoadId],angle=road?Math.atan2(road.end.y-road.start.y,road.end.x-road.start.x)*180/Math.PI+90:0,laneShift=(vehicle.laneIndex-.5)*10,rad=angle*Math.PI/180;return <VehicleShape type={vehicle.type} x={vehicle.position.x+Math.cos(rad)*laneShift} y={vehicle.position.y+Math.sin(rad)*laneShift} rotation={angle}/>;}
