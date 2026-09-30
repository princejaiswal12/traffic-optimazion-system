export type Direction = 'N' | 'E' | 'S' | 'W';
export type VehicleType = 'CAR' | 'BIKE' | 'BUS' | 'TRUCK' | 'AMBULANCE' | 'FIRE_TRUCK' | 'POLICE';
export type SignalState = 'RED' | 'YELLOW' | 'GREEN';
export type Congestion = 'LOW' | 'MEDIUM' | 'HIGH' | 'SEVERE';
export type SimulationStatus = 'STOPPED' | 'RUNNING' | 'PAUSED';

export interface Point { x: number; y: number; }

export interface Junction {
  id: string;
  x: number;
  y: number;
  size: number;
  connectedRoadIds: string[];
  signal: Record<Direction, SignalState>;
  phaseAge: number;
}

export interface Lane {
  id: string;
  roadId: string;
  index: number;
  direction: 'IN' | 'OUT';
}

export interface Road {
  id: string;
  source: string;
  destination: string;
  start: Point;
  end: Point;
  laneCount: number;
  capacity: number;
  speedLimit: number;
  vehicleIds: string[];
  isActive: boolean;
  density: number;
  averageSpeed: number;
  travelTime: number;
  queueLength: number;
  congestion: Congestion;
}

export interface Route {
  roadIds: string[];
  currentIndex: number;
}

export interface Vehicle {
  id: string;
  type: VehicleType;
  sourceRoadId: string;
  destinationRoadId: string;
  currentRoadId: string;
  laneIndex: number;
  progress: number;
  speed: number;
  maxSpeed: number;
  priority: number;
  route: Route;
  waiting: boolean;
  status: 'MOVING' | 'WAITING' | 'ARRIVED' | 'REROUTING';
  position: Point;
}

export interface NetworkStats {
  totalVehicles: number;
  activeVehicles: number;
  emergencyVehicles: number;
  averageSpeed: number;
  averageTravelTime: number;
  totalCongestion: number;
  activeJunctions: number;
  activeRoads: number;
}

export interface SimulationState {
  junctions: Record<string, Junction>;
  roads: Record<string, Road>;
  vehicles: Record<string, Vehicle>;
  selectedRoadId?: string;
  selectedJunctionId?: string;
  selectedSourceRoadId?: string;
  selectedDestinationRoadId?: string;
  routePreview: string[];
  simTime: number;
  status: SimulationStatus;
  speedMultiplier: number;
  stats: NetworkStats;
  events: string[];
}

export const VEHICLE_META: Record<VehicleType, { label: string; maxSpeed: number; length: number; priority: number }> = {
  CAR: { label: 'Car', maxSpeed: 52, length: 1, priority: 1 },
  BIKE: { label: 'Bike', maxSpeed: 44, length: 0.55, priority: 1 },
  BUS: { label: 'Bus', maxSpeed: 38, length: 2.6, priority: 2 },
  TRUCK: { label: 'Truck', maxSpeed: 34, length: 2.2, priority: 2 },
  AMBULANCE: { label: 'Ambulance', maxSpeed: 68, length: 1.8, priority: 100 },
  FIRE_TRUCK: { label: 'Fire truck', maxSpeed: 58, length: 2.2, priority: 100 },
  POLICE: { label: 'Police', maxSpeed: 64, length: 1.7, priority: 100 },
};