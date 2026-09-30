import { Circle, Group, Line, Rect, Text } from 'react-konva';
import type { VehicleType } from '../types';

export function VehicleShape({ type, x, y, rotation }: { type: VehicleType; x: number; y: number; rotation: number }) {
  const emergency = type === 'AMBULANCE' || type === 'FIRE_TRUCK' || type === 'POLICE';
  const width = type === 'BIKE' ? 8 : type === 'BUS' || type === 'TRUCK' ? 18 : 13;
  const height = type === 'BIKE' ? 16 : type === 'BUS' ? 34 : type === 'TRUCK' ? 28 : 24;
  const body = type === 'AMBULANCE' ? 'white' : type === 'POLICE' ? 'white' : type === 'FIRE_TRUCK' ? 'red' : type === 'BUS' ? '#1f7aff' : type === 'TRUCK' ? '#7b8794' : type === 'BIKE' ? '#ffd24a' : '#f04c42';
  return <Group x={x} y={y} rotation={rotation}>
    <Rect x={-width / 2} y={-height / 2} width={width} height={height} cornerRadius={3} fill={body} stroke="#16202a" strokeWidth={1.1} shadowBlur={2} shadowOpacity={0.35} />
    {type !== 'BIKE' && <Rect x={-width * 0.33} y={-height * 0.1} width={width * 0.66} height={height * 0.28} cornerRadius={2} fill="#98c7d7" opacity={0.9} />}
    {type === 'AMBULANCE' && <><Line points={[-width * .42, 0, width * .42, 0]} stroke="#e53838" strokeWidth={2.4} /><Line points={[0, -height * .18, 0, height * .18]} stroke="#e53838" strokeWidth={2.4} /></>}
    {emergency && <><Circle x={-width * 0.25} y={-height * 0.48} radius={2} fill="#fff" /><Circle x={width * 0.25} y={-height * 0.48} radius={2} fill="#fff" /></>}
    {type === 'BIKE' && <Line points={[0, -height / 2, 0, height / 2]} stroke="#111" strokeWidth={2} />}
    {emergency && <Text text="!" fontSize={8} fontStyle="bold" fill="#111" x={-2.2} y={-4.5} />}
  </Group>;
}