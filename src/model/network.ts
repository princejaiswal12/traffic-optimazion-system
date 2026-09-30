import type { Direction, Junction, Point, Road } from '../types';

export const WORLD_W = 1600;
export const WORLD_H = 840;
export const JUNCTION_SIZE = 150;

const JUNCTIONS = [
  ['J1', 220, 210], ['J2', 590, 210], ['J3', 960, 210], ['J4', 1330, 210],
  ['J5', 220, 610], ['J6', 590, 610], ['J7', 960, 610], ['J8', 1330, 610],
] as const;

function point(x: number, y: number): Point { return { x, y }; }

function addRoad(
  roads: Record<string, Road>,
  id: string,
  source: string,
  destination: string,
  start: Point,
  end: Point,
  laneCount = 2,
  capacity = 18,
  speedLimit = 45,
) {
  roads[id] = {
    id, source, destination, start, end, laneCount, capacity, speedLimit,
    vehicleIds: [], isActive: true, density: 0, averageSpeed: speedLimit,
    travelTime: Math.max(1, Math.hypot(end.x - start.x, end.y - start.y) / speedLimit * 3.6),
    queueLength: 0, congestion: 'LOW',
  };
}

export function createInitialNetwork() {
  const junctions: Record<string, Junction> = {};
  const roads: Record<string, Road> = {};

  for (const [id, x, y] of JUNCTIONS) {
    junctions[id] = {
      id, x, y, size: JUNCTION_SIZE, connectedRoadIds: [],
      signal: { N: 'RED', E: 'RED', S: 'RED', W: 'RED' }, phaseAge: 0,
    };
  }

  const half = JUNCTION_SIZE / 2;
  const eastGap = 370 - JUNCTION_SIZE;
  const vertGap = 400 - JUNCTION_SIZE;

  for (const [a, b] of [['J1', 'J2'], ['J2', 'J3'], ['J3', 'J4'], ['J5', 'J6'], ['J6', 'J7'], ['J7', 'J8']] as const) {
    const ja = junctions[a], jb = junctions[b];
    addRoad(roads, `${a}_TO_${b}_EAST`, a, b, point(ja.x + half, ja.y), point(jb.x - half, jb.y));
    addRoad(roads, `${b}_TO_${a}_WEST`, b, a, point(jb.x - half, jb.y), point(ja.x + half, ja.y));
  }

  for (const [a, b] of [['J1', 'J5'], ['J2', 'J6'], ['J3', 'J7'], ['J4', 'J8']] as const) {
    const ja = junctions[a], jb = junctions[b];
    addRoad(roads, `${a}_TO_${b}_SOUTH`, a, b, point(ja.x, ja.y + half), point(jb.x, jb.y - half));
    addRoad(roads, `${b}_TO_${a}_NORTH`, b, a, point(jb.x, jb.y - half), point(ja.x, ja.y + half));
  }

  const externalSpokes: Array<[string, Direction, Point]> = [
    ['N', 'N', point(0, -1)], ['E', 'E', point(1, 0)], ['S', 'S', point(0, 1)], ['W', 'W', point(-1, 0)],
  ];
  for (const [id, j] of Object.entries(junctions)) {
    for (const [dir, dirCode, vector] of externalSpokes) {
      const sameDirInternal = Object.values(roads).some(r => r.source === id && r.id.endsWith(`_${dirCode === 'N' ? 'NORTH' : dirCode === 'E' ? 'EAST' : dirCode === 'S' ? 'SOUTH' : 'WEST'}`));
      if (sameDirInternal) continue;
      const p1 = point(j.x + vector.x * (half + 10), j.y + vector.y * (half + 10));
      const p2 = point(j.x + vector.x * 185, j.y + vector.y * 185);
      const outId = `${id}_TO_EXTERNAL_${dir}`;
      const inId = `EXTERNAL_${dir}_TO_${id}`;
      addRoad(roads, outId, id, `EXTERNAL_${dir}`, p1, p2, 2, 15, 42);
      addRoad(roads, inId, `EXTERNAL_${dir}`, id, p2, p1, 2, 15, 42);
    }
  }

  for (const road of Object.values(roads)) {
    if (junctions[road.source]) junctions[road.source].connectedRoadIds.push(road.id);
    if (junctions[road.destination]) junctions[road.destination].connectedRoadIds.push(road.id);
  }

  void eastGap; void vertGap;
  return { junctions, roads };
}

export function directionForRoad(road: Road): Direction {
  const dx = road.end.x - road.start.x;
  const dy = road.end.y - road.start.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'E' : 'W';
  return dy >= 0 ? 'S' : 'N';
}
