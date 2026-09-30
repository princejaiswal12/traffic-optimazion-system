import { createInitialNetwork, directionForRoad } from '../model/network';
import type { Congestion, Direction, Road, SimulationState, Vehicle, VehicleType } from '../types';
import { VEHICLE_META } from '../types';

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const emergencyTypes = new Set<VehicleType>(['AMBULANCE', 'FIRE_TRUCK', 'POLICE']);

export class TrafficSimulationEngine {
  private state: SimulationState;
  private listeners = new Set<(state: SimulationState) => void>();
  private vehicleCounter = 0;
  private lastTick = performance.now();

  constructor() {
    const network = createInitialNetwork();
    this.state = {
      junctions: network.junctions, roads: network.roads, vehicles: {}, routePreview: [],
      simTime: 0, status: 'STOPPED', speedMultiplier: 1,
      stats: { totalVehicles: 0, activeVehicles: 0, emergencyVehicles: 0, averageSpeed: 0, averageTravelTime: 0, totalCongestion: 0, activeJunctions: Object.keys(network.junctions).length, activeRoads: Object.values(network.roads).length },
      events: ['Network initialized: 8 adaptive junctions online.'],
    };
  }

  subscribe(listener: (state: SimulationState) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  getState() { return this.state; }
  private emit() { for (const listener of this.listeners) listener(this.state); }

  start() { this.state.status = 'RUNNING'; this.lastTick = performance.now(); this.emit(); }
  pause() { this.state.status = 'PAUSED'; this.emit(); }
  resume() { this.state.status = 'RUNNING'; this.lastTick = performance.now(); this.emit(); }
  reset() {
    const network = createInitialNetwork();
    this.state = { ...this.state, junctions: network.junctions, roads: network.roads, vehicles: {}, routePreview: [], simTime: 0, status: 'STOPPED', events: ['Simulation reset.'] };
    this.updateStats(); this.emit();
  }
  setSpeedMultiplier(value: number) { this.state.speedMultiplier = value; this.emit(); }
  selectRoad(id?: string) { this.state.selectedRoadId = id; this.emit(); }
  selectJunction(id?: string) { this.state.selectedJunctionId = id; this.emit(); }
  setSource(id?: string) { this.state.selectedSourceRoadId = id; this.state.routePreview = []; this.emit(); }
  setDestination(id?: string) { this.state.selectedDestinationRoadId = id; const s = this.state.selectedSourceRoadId; if (s && id) this.state.routePreview = this.findRoute(s, id); this.emit(); }

  addVehicle(type: VehicleType, sourceRoadId: string, destinationRoadId: string) {
    const source = this.state.roads[sourceRoadId], destination = this.state.roads[destinationRoadId];
    if (!source || !destination || !source.isActive || !destination.isActive) return;
    const routeRoadIds = this.findRoute(sourceRoadId, destinationRoadId);
    if (!routeRoadIds.length) { this.pushEvent(`No route available from ${sourceRoadId} to ${destinationRoadId}.`); return; }
    const meta = VEHICLE_META[type], id = `${type}-${++this.vehicleCounter}`, startRoad = this.state.roads[routeRoadIds[0]];
    const vehicle: Vehicle = { id, type, sourceRoadId, destinationRoadId, currentRoadId: routeRoadIds[0], laneIndex: 0, progress: 0.03, speed: Math.min(meta.maxSpeed, startRoad.speedLimit), maxSpeed: meta.maxSpeed, priority: meta.priority, route: { roadIds: routeRoadIds, currentIndex: 0 }, waiting: false, status: 'MOVING', position: { ...startRoad.start } };
    this.state.vehicles[id] = vehicle; this.pushEvent(`${id} added: ${sourceRoadId} → ${destinationRoadId}.`); this.emit();
  }

  addRoad(sourceJunctionId: string, destinationJunctionId: string, direction: Direction) {
    const source = this.state.junctions[sourceJunctionId], destination = this.state.junctions[destinationJunctionId];
    if (!source || !destination) return;
    const id = `${sourceJunctionId}_TO_${destinationJunctionId}_${direction}`; if (this.state.roads[id]) return;
    const road: Road = { id, source: sourceJunctionId, destination: destinationJunctionId, start: { x: source.x, y: source.y }, end: { x: destination.x, y: destination.y }, laneCount: 2, capacity: 18, speedLimit: 45, vehicleIds: [], isActive: true, density: 0, averageSpeed: 45, travelTime: 10, queueLength: 0, congestion: 'LOW' };
    this.state.roads[id] = road; source.connectedRoadIds.push(id); destination.connectedRoadIds.push(id); this.state.stats.activeRoads++; this.pushEvent(`${id} added.`); this.emit();
  }

  removeRoad(id: string) {
    const road = this.state.roads[id]; if (!road || !road.isActive) return;
    road.isActive = false;
    for (const vehicle of Object.values(this.state.vehicles)) {
      if (vehicle.currentRoadId === id || vehicle.route.roadIds.includes(id)) {
        const reroute = this.findRoute(vehicle.currentRoadId, vehicle.destinationRoadId);
        if (reroute.length) { vehicle.route = { roadIds: reroute, currentIndex: 0 }; vehicle.currentRoadId = reroute[0]; vehicle.progress = 0.02; vehicle.status = 'REROUTING'; }
      }
    }
    this.pushEvent(`${id} disabled. Active vehicles rerouted where possible.`); this.updateStats(); this.emit();
  }

  toggleRoad(id: string) {
    const road = this.state.roads[id]; if (!road) return;
    if (road.isActive) this.removeRoad(id); else { road.isActive = true; this.pushEvent(`${id} re-enabled.`); this.updateStats(); this.emit(); }
  }

  updateRoad(id: string, patch: Partial<Pick<Road, 'capacity' | 'laneCount' | 'speedLimit'>>) {
    const road = this.state.roads[id]; if (!road) return;
    Object.assign(road, patch); this.pushEvent(`${id} updated.`); this.emit();
  }

  tick(now = performance.now()) {
    if (this.state.status !== 'RUNNING') { this.lastTick = now; return; }
    const realDt = Math.min(0.06, (now - this.lastTick) / 1000); this.lastTick = now;
    const dt = realDt * this.state.speedMultiplier; this.state.simTime += dt;
    this.updateRoadMetrics(); this.updateSignals(dt); this.moveVehicles(dt); this.updateStats(); this.emit();
  }

  private updateRoadMetrics() {
    for (const road of Object.values(this.state.roads)) road.vehicleIds = [];
    for (const vehicle of Object.values(this.state.vehicles)) { const road = this.state.roads[vehicle.currentRoadId]; if (road?.isActive) road.vehicleIds.push(vehicle.id); }
    for (const road of Object.values(this.state.roads)) {
      if (!road.isActive) continue;
      road.density = clamp(road.vehicleIds.length / Math.max(1, road.capacity), 0, 1.4);
      road.queueLength = road.vehicleIds.filter(id => this.state.vehicles[id]?.waiting).length;
      const speeds = road.vehicleIds.map(id => this.state.vehicles[id]?.speed ?? 0);
      road.averageSpeed = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : road.speedLimit;
      road.travelTime = this.estimateRoadTime(road); road.congestion = this.congestionBand(road.density);
    }
  }
  private congestionBand(density: number): Congestion { if (density >= 1) return 'SEVERE'; if (density >= 0.7) return 'HIGH'; if (density >= 0.3) return 'MEDIUM'; return 'LOW'; }
  private estimateRoadTime(road: Road) {
    const distance = Math.hypot(road.end.x - road.start.x, road.end.y - road.start.y);
    const effectiveSpeed = Math.max(10, road.speedLimit * (1 - Math.min(0.8, road.density * 0.65)));
    return Math.max(1, distance / effectiveSpeed * 3.6 + road.queueLength * 1.7);
  }

  private updateSignals(dt: number) {
    for (const junction of Object.values(this.state.junctions)) {
      junction.phaseAge += dt;
      const emergencyApproach = this.findEmergencyApproach(junction.id);
      const demand: Record<Direction, number> = { N: 0, E: 0, S: 0, W: 0 };
      for (const roadId of junction.connectedRoadIds) {
        const road = this.state.roads[roadId]; if (!road?.isActive || road.destination !== junction.id) continue;
        const dir = this.approachDirection(road); demand[dir] += road.queueLength * 3 + road.density * 10;
        demand[dir] += road.vehicleIds.filter(id => this.state.vehicles[id]?.waiting).length * 2;
      }
      if (emergencyApproach) demand[emergencyApproach] += 1000;
      const active = (Object.entries(junction.signal).find(([, s]) => s === 'GREEN')?.[0] ?? 'N') as Direction;
      const maxDemand = Math.max(...Object.values(demand)), currentDemand = demand[active];
      const starved = Object.entries(this.starvationScore(junction.id)).some(([dir, score]) => dir !== active && score > 24);
      if (junction.phaseAge > 3 && ((maxDemand > currentDemand * 1.25 && junction.phaseAge > 4) || junction.phaseAge > 12 || starved)) {
        const next = Object.entries(demand).sort((a, b) => b[1] - a[1])[0][0] as Direction; this.setPhase(junction.id, next);
      }
      if (!Object.values(junction.signal).includes('GREEN')) this.setPhase(junction.id, active);
    }
  }

  private starvationScore(junctionId: string) {
    const result: Record<Direction, number> = { N: 0, E: 0, S: 0, W: 0 }, now = this.state.simTime;
    for (const roadId of this.state.junctions[junctionId].connectedRoadIds) {
      const road = this.state.roads[roadId]; if (!road?.isActive || road.destination !== junctionId) continue;
      const dir = this.approachDirection(road);
      result[dir] = Math.max(result[dir], road.vehicleIds.reduce((m, id) => Math.max(m, now - (this.state.vehicles[id]?.progress ?? 0) * 5), 0));
    }
    return result;
  }
  private setPhase(junctionId: string, dir: Direction) {
    const j = this.state.junctions[junctionId], opposite = this.opposite(dir);
    j.signal = { N: 'RED', E: 'RED', S: 'RED', W: 'RED' }; j.signal[dir] = 'GREEN'; j.signal[opposite] = 'GREEN'; j.phaseAge = 0;
  }

  private moveVehicles(dt: number) {
    const arrived: string[] = [];
    for (const vehicle of Object.values(this.state.vehicles)) {
      const road = this.state.roads[vehicle.currentRoadId]; if (!road?.isActive) continue;
      const junction = this.state.junctions[road.destination], dir = this.approachDirection(road);
      const canPass = !junction || junction.signal[dir] === 'GREEN' || emergencyTypes.has(vehicle.type);
      const nextVehicle = this.nearestVehicleAhead(vehicle);
      const headwaySlowdown = nextVehicle && nextVehicle.progress > vehicle.progress && nextVehicle.progress - vehicle.progress < 0.08;
      const targetSpeed = canPass && !headwaySlowdown ? Math.min(vehicle.maxSpeed, road.speedLimit) : 0;
      if (vehicle.speed < targetSpeed) vehicle.speed = Math.min(targetSpeed, vehicle.speed + 18 * dt); else vehicle.speed = Math.max(targetSpeed, vehicle.speed - 30 * dt);
      vehicle.waiting = vehicle.speed < 3; vehicle.status = vehicle.waiting ? 'WAITING' : 'MOVING';
      const roadDistance = Math.max(60, Math.hypot(road.end.x - road.start.x, road.end.y - road.start.y));
      vehicle.progress += (vehicle.speed / 3.6) * dt / roadDistance;
      const t = clamp(vehicle.progress, 0, 1);
      vehicle.position = { x: road.start.x + (road.end.x - road.start.x) * t, y: road.start.y + (road.end.y - road.start.y) * t };
      if (vehicle.progress >= 1) {
        const nextIndex = vehicle.route.currentIndex + 1;
        if (nextIndex >= vehicle.route.roadIds.length) { vehicle.status = 'ARRIVED'; arrived.push(vehicle.id); continue; }
        const nextRoadId = vehicle.route.roadIds[nextIndex];
        if (!this.state.roads[nextRoadId]?.isActive) { const reroute = this.findRoute(vehicle.currentRoadId, vehicle.destinationRoadId); if (reroute.length) vehicle.route = { roadIds: reroute, currentIndex: 0 }; continue; }
        vehicle.route.currentIndex = nextIndex; vehicle.currentRoadId = nextRoadId; vehicle.progress = 0.02; vehicle.waiting = false;
      }
    }
    for (const id of arrived) delete this.state.vehicles[id];
  }

  private nearestVehicleAhead(vehicle: Vehicle) {
    return Object.values(this.state.vehicles).filter(v => v.id !== vehicle.id && v.currentRoadId === vehicle.currentRoadId && v.progress > vehicle.progress).sort((a, b) => a.progress - b.progress)[0];
  }
  private findEmergencyApproach(junctionId: string): Direction | undefined {
    for (const roadId of this.state.junctions[junctionId].connectedRoadIds) {
      const road = this.state.roads[roadId]; if (!road?.isActive || road.destination !== junctionId) continue;
      if (road.vehicleIds.some(id => emergencyTypes.has(this.state.vehicles[id]?.type as VehicleType))) return this.approachDirection(road);
    }
    return undefined;
  }
  private approachDirection(road: Road): Direction { return this.opposite(directionForRoad(road)); }
  private opposite(dir: Direction): Direction { return ({ N: 'S', S: 'N', E: 'W', W: 'E' } as const)[dir]; }

  private findRoute(sourceRoadId: string, destinationRoadId: string): string[] {
    if (sourceRoadId === destinationRoadId) return [sourceRoadId];
    const sourceRoad = this.state.roads[sourceRoadId], targetRoad = this.state.roads[destinationRoadId];
    if (!sourceRoad || !targetRoad || !sourceRoad.isActive || !targetRoad.isActive) return [];
    const startNode = sourceRoad.destination, goalNode = targetRoad.source;
    const dist = new Map<string, number>(), prev = new Map<string, string | undefined>();
    const unvisited = new Set<string>(Object.keys(this.state.junctions));
    for (const node of unvisited) dist.set(node, Number.POSITIVE_INFINITY); dist.set(startNode, 0);
    while (unvisited.size) {
      let current: string | undefined, currentDist = Number.POSITIVE_INFINITY;
      for (const node of unvisited) { const d = dist.get(node)!; if (d < currentDist) { current = node; currentDist = d; } }
      if (!current || current === goalNode) break; unvisited.delete(current);
      for (const edge of Object.values(this.state.roads)) {
        if (!edge.isActive || edge.source !== current || !this.state.junctions[edge.destination]) continue;
        const alt = currentDist + this.dynamicEdgeCost(edge);
        if (alt < (dist.get(edge.destination) ?? Number.POSITIVE_INFINITY)) { dist.set(edge.destination, alt); prev.set(edge.destination, edge.id); }
      }
    }
    if (!prev.has(goalNode) && startNode !== goalNode) return [];
    const path: string[] = []; let n = goalNode;
    while (n !== startNode) { const edgeId = prev.get(n); if (!edgeId) return []; path.unshift(edgeId); n = this.state.roads[edgeId].source; }
    return [sourceRoadId, ...path, ...(destinationRoadId === path[path.length - 1] ? [] : [destinationRoadId])].filter((id, idx, arr) => arr.indexOf(id) === idx);
  }
  private dynamicEdgeCost(road: Road) {
    const distance = Math.hypot(road.end.x - road.start.x, road.end.y - road.start.y);
    return distance * (1 + road.density * 3.4) + road.queueLength * 15 + road.travelTime * 2;
  }
  private updateStats() {
    const vehicles = Object.values(this.state.vehicles), roads = Object.values(this.state.roads).filter(r => r.isActive);
    this.state.stats.activeVehicles = vehicles.length;
    this.state.stats.emergencyVehicles = vehicles.filter(v => emergencyTypes.has(v.type)).length;
    this.state.stats.averageSpeed = vehicles.length ? vehicles.reduce((s, v) => s + v.speed, 0) / vehicles.length : 0;
    this.state.stats.totalCongestion = roads.length ? roads.reduce((s, r) => s + Math.min(1, r.density), 0) / roads.length * 100 : 0;
    this.state.stats.activeRoads = roads.length;
  }
  private pushEvent(message: string) { this.state.events = [message, ...this.state.events].slice(0, 8); }
}
