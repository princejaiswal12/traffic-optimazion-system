import { useEffect, useMemo, useState } from 'react';
import { TrafficCanvas } from './components/TrafficCanvas';
import { Sidebar } from './components/Sidebar';
import { TrafficSimulationEngine } from './simulation/engine';
import type { SimulationState, VehicleType } from './types';

const engine = new TrafficSimulationEngine();

export default function App() {
  const [state,setState]=useState<SimulationState>(engine.getState());
  useEffect(()=>engine.subscribe(setState),[]);
  useEffect(()=>{let frame=0;const loop=(now:number)=>{engine.tick(now);frame=requestAnimationFrame(loop)};frame=requestAnimationFrame(loop);return()=>cancelAnimationFrame(frame)},[]);
  useEffect(()=>{if(state.status==='STOPPED'&&Object.keys(state.vehicles).length===0){const roads=Object.values(state.roads).filter(r=>r.isActive);if(roads.length>10){engine.addVehicle('CAR',roads[0].id,roads[8].id);engine.addVehicle('BUS',roads[2].id,roads[12].id);engine.addVehicle('BIKE',roads[5].id,roads[14].id)}}},[state.status]);
  const actions=useMemo(()=>({
    setSource:(id?:string)=>engine.setSource(id),setDestination:(id?:string)=>engine.setDestination(id),
    addVehicle:(type:VehicleType,source:string,destination:string)=>engine.addVehicle(type,source,destination),
    updateRoad:(id:string,patch:any)=>engine.updateRoad(id,patch),removeRoad:(id:string)=>engine.removeRoad(id),toggleRoad:(id:string)=>engine.toggleRoad(id),selectRoad:(id?:string)=>engine.selectRoad(id),
    addEmergency:()=>{const roads=Object.values(engine.getState().roads).filter(r=>r.isActive);if(roads.length>1)engine.addVehicle('AMBULANCE',roads[1].id,roads[Math.min(roads.length-1,14)].id)}
  }),[]);
  return <div className="app-shell">
    <header className="topbar"><div><div className="brand">ADAPTIVE TRAFFIC SIMULATOR</div><div className="subbrand">Graph routing · adaptive signals · fairness · emergency priority</div></div>
      <div className="status-pill"><span className={'pulse '+state.status.toLowerCase()}/>{state.status}</div>
      <div className="controls">{state.status==='RUNNING'?<button className="control" onClick={()=>engine.pause()}>Ⅱ Pause</button>:<button className="control accent" onClick={()=>state.status==='PAUSED'?engine.resume():engine.start()}>▶ {state.status==='PAUSED'?'Resume':'Start'}</button>}<button className="control" onClick={()=>engine.reset()}>↺ Reset</button>{[.5,1,2,5].map(v=><button key={v} className={'speed '+(state.speedMultiplier===v?'active':'')} onClick={()=>engine.setSpeedMultiplier(v)}>×{v}</button>)}</div>
    </header>
    <main className="main-grid"><div className="canvas-panel"><div className="map-heading"><div><b>LIVE ROAD NETWORK</b><span>4 × 2 junction grid · 8-way approaches · adaptive signals</span></div><div className="network-health"><span/> NETWORK HEALTH {Math.round(100-state.stats.totalCongestion)}%</div></div><TrafficCanvas state={state} onRoadClick={id=>engine.selectRoad(id)} onJunctionClick={id=>engine.selectJunction(id)}/></div><Sidebar state={state} actions={actions}/></main>
    <footer className="footer"><div>Vehicles <strong>{state.stats.activeVehicles}</strong></div><div>Emergency <strong>{state.stats.emergencyVehicles}</strong></div><div>Avg speed <strong>{Math.round(state.stats.averageSpeed)} km/h</strong></div><div>Congestion <strong>{Math.round(state.stats.totalCongestion)}%</strong></div><div>Roads <strong>{state.stats.activeRoads}</strong></div><div>Simulation <strong>{state.simTime.toFixed(1)} s</strong></div></footer>
  </div>
}