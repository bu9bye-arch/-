
export const MAP_WIDTH = 4000;
export const MAP_HEIGHT = 4000;

export const INITIAL_MASS = 15; // Initial very small ball
export const MIN_MASS_TO_SPLIT = 35;
export const MIN_MASS_TO_EJECT = 35;
export const EJECT_MASS_LOSS = 16;
export const EJECT_MASS_GAIN = 12; // Ejected blob size
export const MAX_CELLS = 16;
export const MERGE_COOLDOWN_MS = 15000; // 15 seconds to re-merge
export const VIRUS_MASS = 100;
export const VIRUS_RADIUS = 70; // Visual radius roughly
export const VIRUS_BONUS_MASS = 150; // Mass gained when eating a virus

// Physics
export const BASE_SPEED = 6;
export const FRICTION = 0.9;
export const SPLIT_IMPULSE = 25; // Increased from 12 to 25 to double split distance
export const EJECT_IMPULSE = 15;
export const MASS_DECAY_RATE = 0.9999; // Much slower decay (approx 0.6% per sec)
export const MASS_DECAY_THRESHOLD = 100; // Only decay if bigger than this
export const SWARM_GRAVITY = 0.02; // Force pulling split cells together

// Game Rules
export const GAME_DURATION_MS = 12 * 60 * 1000; // 12 Minutes
export const RESPAWN_DELAY_MS = 3000; // 3 Seconds

// Bots
export const BOT_COUNT = 15;
export const BOT_SPEED_FACTOR = 0.6; // Bots are slightly slower than human for balance
export const BOT_NAMES = [
  "Terminator", "Blob", "Goliath", "Tiny", "Eater", 
  "Pro_Gamer", "Noob", "Mars", "Pluto", "Virus_Lover", 
  "Bacteria", "Cell_Mate", "Winner", "Loser", "Alpha", 
  "Omega", "Zeta", "Prime", "Hunter", "Prey", "Agar", "Io", "Sphere"
];

// Visuals
export const COLORS = [
  '#FF5252', '#E040FB', '#7C4DFF', '#536DFE', 
  '#448AFF', '#40C4FF', '#18FFFF', '#64FFDA', 
  '#69F0AE', '#B2FF59', '#EEFF41', '#FFFF00', 
  '#FFD740', '#FFAB40', '#FF6E40'
];

export const FOOD_COLORS = ['#ffcd56', '#36a2eb', '#ff6384', '#4bc0c0', '#9966ff'];