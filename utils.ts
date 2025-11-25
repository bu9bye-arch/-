import { Vector } from "./types";

export const getRandomColor = (palette: string[]): string => {
  return palette[Math.floor(Math.random() * palette.length)];
};

export const getRandomName = (names: string[]): string => {
  return names[Math.floor(Math.random() * names.length)];
};

export const getRandomPos = (w: number, h: number): Vector => {
  return {
    x: Math.random() * w,
    y: Math.random() * h
  };
};

export const massToRadius = (mass: number): number => {
  return Math.sqrt(mass * 100 / Math.PI);
};

export const radiusToMass = (r: number): number => {
  return (r * r * Math.PI) / 100;
};

export const getDistance = (p1: Vector, p2: Vector): number => {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};