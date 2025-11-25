export interface Vector {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
}

export interface Food extends Entity {
  type: 'pellet';
}

export interface Virus extends Entity {
  type: 'virus';
  spikes: number;
}

export interface EjectedMass extends Entity {
  type: 'ejected';
  vx: number;
  vy: number;
  mass: number;
  ownerId: string; // To prevent eating own ejecta immediately
  createdAt: number;
}

export interface PlayerCell extends Entity {
  mass: number;
  vx: number;
  vy: number;
  mergeTimer: number; // Timestamp when it can merge
  createdAt: number;
}

export interface Bot {
  id: string; // Bot Controller ID
  name: string;
  color: string;
  cells: PlayerCell[]; // Bots can split too, so they are a collection of cells
  target: Vector; // Where the bot wants to go
  deadAt?: number; // Timestamp when bot died
}

export interface GameState {
  playerCells: PlayerCell[];
  bots: Bot[];
  foods: Food[];
  viruses: Virus[];
  ejectedMass: EjectedMass[];
  camera: Vector;
  scale: number;
  score: number;
  gameOver: boolean;
  gameStarted: boolean;
  gameEndTime: number;
}