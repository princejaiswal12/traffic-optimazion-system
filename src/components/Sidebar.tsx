import type { Road, SimulationState, VehicleType } from '../types';
const types: VehicleType[] = ['CAR','BIKE','BUS','TRUCK','AMBULANCE','FIRE_TRUCK','POLICE'];

export function Sidebar({ state, actions }: { state: SimulationState; actions: {
  setSource:(id?:string)=>void; setDestination:(id?:string)=>void; addVehicle:(type:VehicleType,source:string,destination:string)=>void;
  updateRoad:(id:string,patch:Partial<Pick<Road,'capacity'|'laneCount'|'speedLimit'>>)=>void; removeRoad:(id:string)=>void; toggleRoad:(id:string)=>void; selectRoad:(id?:string)=>void; addEmergency:()=>void;
}}){
  const selectedRoad=state.selectedRoadId?state.roads[state.selectedRoadId]:undefined;
  const roads=Object.values(state.roads).filter(r=>r.isActive);
  const junction=state.selectedJunctionId?state.junctions[state.selectedJunctionId]:undefined;
  const source=state.selectedSourceRoadId??roads[0]?.id??'';
  const destination=state.selectedDestinationRoadId??roads[roads.length-1]?.id??'';
  return <aside className="sidebar">
    <section className="card hero-card"><div className="eyebrow">ADAPTIVE CONTROL CENTER</div><h1>Traffic Network</h1><p>8 junctions · dynamic routing · emergency pre-emption</p></section>
    <section className="card"><div className="card-title">Add vehicle</div><label>Vehicle type</label><select id="vehicle-type"><option value="CAR">CAR</option>{types.slice(1).map(t=><option key={t} value={t}>{t}</option>)}</select><label>Source road</label><select value={source} onChange={e=>actions.setSource(e.target.value)}>{roads.map(r=><option key={r.id}>{r.id}</option>)}</select><label>Destination road</label><select value={destination} onChange={e=>actions.setDestination(e.target.value)}>{roads.map(r=><option key={r.id}>{r.id}</option>)}</select><button className="primary" onClick={()=>{const type=(document.getElementById('vehicle-type') as HTMLSelectElement).value as VehicleType;actions.addVehicle(type,source,destination)}}>＋ Add Vehicle</button><button className="danger" onClick={actions.addEmergency}>🚑 Add Emergency Vehicle</button>{state.routePreview.length>0&&<div className="route-preview">Route selected: <b>{state.routePreview.length}</b> road segments</div>}</section>
    <section className="card"><div className="card-title">Road inspector</div><label>Select road</label><select value={selectedRoad?.id??''} onChange={e=>actions.selectRoad(e.target.value||undefined)}><option value="">Choose a road…</option>{Object.values(state.roads).map(r=><option key={r.id}>{r.id}</option>)}</select>
    {selectedRoad?<><div className="metric-grid"><Metric label="Vehicles" value={String(selectedRoad.vehicleIds.length)}/><Metric label="Density" value={Math.round(selectedRoad.density*100)+'%'}/><Metric label="Avg speed" value={Math.round(selectedRoad.averageSpeed)+' km/h'}/><Metric label="Travel time" value={selectedRoad.travelTime.toFixed(1)+' sec'}/></div>
    <div className="slider-row"><span>Lanes</span><input type="range" min="1" max="4" value={selectedRoad.laneCount} onChange={e=>actions.updateRoad(selectedRoad.id,{laneCount:Number(e.target.value)})}/><b>{selectedRoad.laneCount}</b></div>
    <div className="slider-row"><span>Capacity</span><input type="range" min="5" max="60" value={selectedRoad.capacity} onChange={e=>actions.updateRoad(selectedRoad.id,{capacity:Number(e.target.value)})}/><b>{selectedRoad.capacity}</b></div>
    <div className="slider-row"><span>Speed</span><input type="range" min="20" max="80" value={selectedRoad.speedLimit} onChange={e=>actions.updateRoad(selectedRoad.id,{speedLimit:Number(e.target.value)})}/><b>{selectedRoad.speedLimit}</b></div>
    <button className="secondary" onClick={()=>actions.toggleRoad(selectedRoad.id)}>{selectedRoad.isActive?'Disable road':'Enable road'}</button><button className="danger-outline" onClick={()=>actions.removeRoad(selectedRoad.id)}>Remove road</button></>:<p className="muted">Click a road on the map or choose one here.</p>}</section>
    <section className="card"><div className="card-title">Junction inspector</div>{junction?<><div className="junction-chip">{junction.id}</div><div className="metric-grid"><Metric label="N" value={junction.signal.N}/><Metric label="E" value={junction.signal.E}/><Metric label="S" value={junction.signal.S}/><Metric label="W" value={junction.signal.W}/></div></>:<p className="muted">Select a junction on the canvas.</p>}</section>
    <section className="card event-card"><div className="card-title">Simulation events</div>{state.events.map((event,i)=><div key={event+'-'+i} className="event-row">{event}</div>)}</section>
  </aside>;
}
function Metric({label,value}:{label:string;value:string}){return <div className="metric"><span>{label}</span><strong>{value}</strong></div>}