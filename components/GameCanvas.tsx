
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameState, PlayerCell, Food, Virus, EjectedMass, Vector, Bot } from '../types';
import { 
  MAP_WIDTH, MAP_HEIGHT, INITIAL_MASS, MIN_MASS_TO_SPLIT, 
  MAX_CELLS, MERGE_COOLDOWN_MS, BASE_SPEED, FRICTION, 
  SPLIT_IMPULSE, VIRUS_MASS, FOOD_COLORS, COLORS, 
  MIN_MASS_TO_EJECT, EJECT_MASS_LOSS, EJECT_IMPULSE, EJECT_MASS_GAIN,
  MASS_DECAY_RATE, MASS_DECAY_THRESHOLD, VIRUS_BONUS_MASS, SWARM_GRAVITY,
  BOT_COUNT, BOT_SPEED_FACTOR, GAME_DURATION_MS, RESPAWN_DELAY_MS, BOT_NAMES
} from '../constants';
import { getRandomColor, getRandomPos, massToRadius, getDistance, generateUUID, getRandomName } from '../utils';
import { audio } from '../audio';

interface GameCanvasProps {
  playerName: string;
  gameStarted: boolean;
  onGameOver: (score: number) => void;
  actionRef: React.MutableRefObject<{ split: boolean; eject: boolean }>;
}

interface LeaderboardEntry {
  name: string;
  mass: number;
  isMe: boolean;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ playerName, gameStarted, onGameOver, actionRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  
  // Performance & HUD Refs
  const lastUiUpdateRef = useRef<number>(0);
  const framesCountRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(0);

  // Player State
  const playerDeadAtRef = useRef<number | null>(null);

  // Keyboard Input State
  const inputState = useRef({ up: false, down: false, left: false, right: false });
  // Store last valid movement direction
  const lastMoveDir = useRef({ x: 1, y: 0 });

  // Game State Ref (Mutable for performance loop)
  const stateRef = useRef<GameState>({
    playerCells: [],
    bots: [],
    foods: [],
    viruses: [],
    ejectedMass: [],
    camera: { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 },
    scale: 1,
    score: 0,
    gameOver: false,
    gameStarted: false,
    gameEndTime: 0,
  });

  // UI State sync for HUD (Score, etc)
  const [hudScore, setHudScore] = useState(0);
  const [hudMass, setHudMass] = useState(0);
  const [hudTime, setHudTime] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [fps, setFps] = useState(60);
  const [respawnCountdown, setRespawnCountdown] = useState<number | null>(null);

  // Helper to spawn a bot
  const spawnBot = useCallback((): Bot => {
    const startPos = getRandomPos(MAP_WIDTH, MAP_HEIGHT);
    const mass = INITIAL_MASS + Math.random() * 50; // Random starting size
    return {
      id: generateUUID(),
      name: getRandomName(BOT_NAMES),
      color: getRandomColor(COLORS),
      target: getRandomPos(MAP_WIDTH, MAP_HEIGHT),
      cells: [{
        id: generateUUID(),
        x: startPos.x,
        y: startPos.y,
        mass: mass,
        radius: massToRadius(mass),
        color: getRandomColor(COLORS), // Will be overwritten by bot color usually
        vx: 0,
        vy: 0,
        mergeTimer: 0,
        createdAt: Date.now(),
      }]
    };
  }, []);

  const spawnPlayer = useCallback(() => {
    const startPos = getRandomPos(MAP_WIDTH, MAP_HEIGHT);
    const initialCell: PlayerCell = {
      id: generateUUID(),
      x: startPos.x,
      y: startPos.y,
      mass: INITIAL_MASS,
      radius: massToRadius(INITIAL_MASS),
      color: getRandomColor(COLORS),
      vx: 0,
      vy: 0,
      mergeTimer: 0,
      createdAt: Date.now(),
    };
    
    stateRef.current.playerCells = [initialCell];
    stateRef.current.camera = { x: startPos.x, y: startPos.y };
    stateRef.current.scale = 1;
    playerDeadAtRef.current = null;
    setRespawnCountdown(null);
  }, []);

  // Initialize Game World
  const initWorld = useCallback(() => {
    // Generate Food
    const foods: Food[] = [];
    for (let i = 0; i < 800; i++) {
      foods.push({
        id: generateUUID(),
        ...getRandomPos(MAP_WIDTH, MAP_HEIGHT),
        radius: 5 + Math.random() * 3, // slightly varrying size
        color: getRandomColor(FOOD_COLORS),
        type: 'pellet'
      });
    }

    // Generate Viruses
    const viruses: Virus[] = [];
    for (let i = 0; i < 40; i++) {
      viruses.push({
        id: generateUUID(),
        ...getRandomPos(MAP_WIDTH, MAP_HEIGHT),
        radius: massToRadius(VIRUS_MASS),
        color: '#33ff33', // Green
        type: 'virus',
        spikes: 12
      });
    }

    // Generate Bots
    const bots: Bot[] = [];
    for (let i = 0; i < BOT_COUNT; i++) {
      bots.push(spawnBot());
    }

    stateRef.current = {
      playerCells: [], // Player spawns separately
      bots,
      foods,
      viruses,
      ejectedMass: [],
      camera: { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 },
      scale: 1,
      score: 0,
      gameOver: false,
      gameStarted: true,
      gameEndTime: Date.now() + GAME_DURATION_MS,
    };
    
    spawnPlayer();
    
    // Reset inputs
    inputState.current = { up: false, down: false, left: false, right: false };
    lastMoveDir.current = { x: 1, y: 0 };
    
    // Reset Perf counters
    lastUiUpdateRef.current = performance.now();
    lastFpsTimeRef.current = performance.now();
    framesCountRef.current = 0;
  }, [spawnBot, spawnPlayer]);

  // Handle Input logic
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.code === 'ArrowUp') inputState.current.up = true;
    if (e.code === 'ArrowDown') inputState.current.down = true;
    if (e.code === 'ArrowLeft') inputState.current.left = true;
    if (e.code === 'ArrowRight') inputState.current.right = true;
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.code === 'ArrowUp') inputState.current.up = false;
    if (e.code === 'ArrowDown') inputState.current.down = false;
    if (e.code === 'ArrowLeft') inputState.current.left = false;
    if (e.code === 'ArrowRight') inputState.current.right = false;
  }, []);

  // GAME LOOP
  const update = useCallback(() => {
    const state = stateRef.current;
    if (!state.gameStarted || state.gameOver) return;

    const now = Date.now();

    // GAME OVER CHECK (Time based)
    if (now >= state.gameEndTime) {
        state.gameOver = true;
        audio.stopMusic();
        onGameOver(state.score);
        return;
    }

    // --- RESPAWN LOGIC ---
    // Player Respawn
    if (state.playerCells.length === 0) {
        if (playerDeadAtRef.current === null) {
            playerDeadAtRef.current = now;
        } else {
            const deadTime = now - playerDeadAtRef.current;
            const remaining = Math.ceil((RESPAWN_DELAY_MS - deadTime) / 1000);
            if (remaining > 0) {
                // Throttle this state update inside the logic loop to avoid heavy react rendering
                // We'll update it in the UI throttle block below
            } else {
                spawnPlayer();
            }
        }
    }

    // Bot Respawn
    state.bots.forEach((bot, idx) => {
        if (bot.cells.length === 0) {
            if (!bot.deadAt) {
                bot.deadAt = now;
            } else if (now - bot.deadAt > RESPAWN_DELAY_MS) {
                state.bots[idx] = spawnBot(); // Respawn new bot
            }
        }
    });


    // --- PLAYER LOGIC ---
    if (state.playerCells.length > 0) {
        // 0. Determine Target Direction from Keys
        let moveX = 0;
        let moveY = 0;
        if (inputState.current.up) moveY -= 1;
        if (inputState.current.down) moveY += 1;
        if (inputState.current.left) moveX -= 1;
        if (inputState.current.right) moveX += 1;

        // Normalize input vector
        const len = Math.sqrt(moveX * moveX + moveY * moveY);
        if (len > 0) {
            moveX /= len;
            moveY /= len;
            lastMoveDir.current = { x: moveX, y: moveY };
        }

        // 1. Process Actions (Split/Eject)
        const dirX = lastMoveDir.current.x;
        const dirY = lastMoveDir.current.y;

        if (actionRef.current.split) {
            actionRef.current.split = false; // consume action
            const newCells: PlayerCell[] = [];
            let currentCellCount = state.playerCells.length;
            let didSplit = false;

            state.playerCells.forEach(cell => {
            if (cell.mass >= MIN_MASS_TO_SPLIT && currentCellCount < MAX_CELLS) {
                const splitMass = cell.mass / 2;
                cell.mass = splitMass;
                cell.radius = massToRadius(splitMass);
                
                const newCell: PlayerCell = {
                ...cell,
                id: generateUUID(),
                mass: splitMass,
                radius: massToRadius(splitMass),
                // Start slightly ahead in direction of movement
                x: cell.x + dirX * cell.radius, 
                y: cell.y + dirY * cell.radius,
                vx: cell.vx + dirX * SPLIT_IMPULSE,
                vy: cell.vy + dirY * SPLIT_IMPULSE,
                mergeTimer: Date.now() + MERGE_COOLDOWN_MS + (splitMass * 20),
                createdAt: Date.now()
                };
                newCells.push(newCell);
                currentCellCount++;
                didSplit = true;
            }
            });
            state.playerCells = [...state.playerCells, ...newCells];
            if (didSplit) audio.playSplit();
        }

        if (actionRef.current.eject) {
            actionRef.current.eject = false;
            let didEject = false;
            state.playerCells.forEach(cell => {
            if (cell.mass >= MIN_MASS_TO_EJECT) {
                cell.mass -= EJECT_MASS_LOSS;
                cell.radius = massToRadius(cell.mass);

                const ejecta: EjectedMass = {
                id: generateUUID(),
                type: 'ejected',
                x: cell.x + dirX * cell.radius,
                y: cell.y + dirY * cell.radius,
                radius: massToRadius(EJECT_MASS_GAIN),
                color: cell.color,
                vx: cell.vx + dirX * EJECT_IMPULSE,
                vy: cell.vy + dirY * EJECT_IMPULSE,
                mass: EJECT_MASS_GAIN,
                ownerId: cell.id,
                createdAt: Date.now()
                };
                state.ejectedMass.push(ejecta);
                didEject = true;
            }
            });
            if (didEject) audio.playEject();
        }

        // 2. Physics & Movement
        // Calculate Center of Mass for Gravity
        let comX = 0;
        let comY = 0;
        let tm = 0;
        state.playerCells.forEach(c => {
            comX += c.x * c.mass;
            comY += c.y * c.mass;
            tm += c.mass;
        });
        if (tm > 0) {
            comX /= tm;
            comY /= tm;
        }

        state.playerCells.forEach(cell => {
        // Mass Decay
        if (cell.mass > MASS_DECAY_THRESHOLD) {
            cell.mass *= MASS_DECAY_RATE;
            cell.radius = massToRadius(cell.mass);
        }

        // Movement Logic - Smaller = Faster
        const speed = BASE_SPEED * Math.pow(cell.mass, -0.439) * 4;
        
        // Apply input acceleration
        if (len > 0) {
            cell.vx += moveX * speed * 0.1;
            cell.vy += moveY * speed * 0.1;
        }

        // Apply Swarm Gravity (Attraction to Center of Mass)
        // Only if multiple cells
        if (state.playerCells.length > 1) {
            const distToCenter = getDistance(cell, {x: comX, y: comY});
            if (distToCenter > cell.radius) {
                const gravityForce = SWARM_GRAVITY * (cell.mass / 100); 
                const angle = Math.atan2(comY - cell.y, comX - cell.x);
                cell.vx += Math.cos(angle) * gravityForce;
                cell.vy += Math.sin(angle) * gravityForce;
            }
        }

        // Apply Friction
        cell.vx *= FRICTION;
        cell.vy *= FRICTION;

        // Apply Velocity
        cell.x += cell.vx;
        cell.y += cell.vy;

        // Map Boundaries
        cell.x = Math.max(cell.radius, Math.min(MAP_WIDTH - cell.radius, cell.x));
        cell.y = Math.max(cell.radius, Math.min(MAP_HEIGHT - cell.radius, cell.y));
        });
    }

    // --- BOT LOGIC ---
    state.bots.forEach(bot => {
      // Simple AI: Find nearest interesting thing
      if (bot.cells.length === 0) return;

      // 1. Find center of bot
      let bx = 0, by = 0, bm = 0;
      bot.cells.forEach(c => { bx += c.x; by += c.y; bm += c.mass; });
      bx /= bot.cells.length;
      by /= bot.cells.length;
      
      // Change target occasionally or if close
      if (Math.random() < 0.02 || getDistance({x: bx, y: by}, bot.target) < 100) {
          // Look for food
          let closestFood = null;
          let minDist = 9999;
          
          // Sample some food to save CPU
          for(let i=0; i<50; i++) {
              const f = state.foods[Math.floor(Math.random() * state.foods.length)];
              if(!f) continue;
              const d = getDistance({x: bx, y: by}, f);
              if (d < minDist) { minDist = d; closestFood = f; }
          }
          
          if (closestFood) {
              bot.target = {x: closestFood.x, y: closestFood.y};
          } else {
              bot.target = getRandomPos(MAP_WIDTH, MAP_HEIGHT);
          }
      }

      // Avoid Players
      let threat = null;
      let minDist = 500;
      state.playerCells.forEach(p => {
          const d = getDistance({x: bx, y: by}, p);
          if (d < minDist && p.mass > bm / bot.cells.length * 1.2) {
              minDist = d;
              threat = p;
          }
      });

      let tx = bot.target.x;
      let ty = bot.target.y;

      if (threat) {
          // Run away
          const angle = Math.atan2(by - threat.y, bx - threat.x);
          tx = bx + Math.cos(angle) * 1000;
          ty = by + Math.sin(angle) * 1000;
      }

      // Move Bot Cells
      bot.cells.forEach(cell => {
          // Decay
          if (cell.mass > MASS_DECAY_THRESHOLD) {
             cell.mass *= MASS_DECAY_RATE;
             cell.radius = massToRadius(cell.mass);
          }
          
          const speed = (BASE_SPEED * Math.pow(cell.mass, -0.439) * 4) * BOT_SPEED_FACTOR;
          const angle = Math.atan2(ty - cell.y, tx - cell.x);
          
          cell.vx += Math.cos(angle) * speed * 0.1;
          cell.vy += Math.sin(angle) * speed * 0.1;
          
          cell.vx *= FRICTION;
          cell.vy *= FRICTION;
          cell.x += cell.vx;
          cell.y += cell.vy;

          // Boundaries
          cell.x = Math.max(cell.radius, Math.min(MAP_WIDTH - cell.radius, cell.x));
          cell.y = Math.max(cell.radius, Math.min(MAP_HEIGHT - cell.radius, cell.y));
      });

      // Bot cell collision (self)
      for (let i = 0; i < bot.cells.length; i++) {
        for (let j = i + 1; j < bot.cells.length; j++) {
            const c1 = bot.cells[i];
            const c2 = bot.cells[j];
            const dist = getDistance(c1, c2);
            const minDist = c1.radius + c2.radius;
            
            if (dist < minDist) {
                // Bots merge aggressively
                const botMergeNow = Date.now();
                if (botMergeNow > c1.mergeTimer && botMergeNow > c2.mergeTimer) {
                    c1.mass += c2.mass;
                    c1.radius = massToRadius(c1.mass);
                    bot.cells.splice(j, 1);
                    j--;
                } else {
                    const angle = Math.atan2(c2.y - c1.y, c2.x - c1.x);
                    const overlap = minDist - dist;
                    const force = overlap / 2;
                    c1.x -= Math.cos(angle) * force;
                    c1.y -= Math.sin(angle) * force;
                    c2.x += Math.cos(angle) * force;
                    c2.y += Math.sin(angle) * force;
                }
            }
        }
      }
    });

    // 3. Collision Logic

    // Player Self-Collision (Push apart or Merge)
    for (let i = 0; i < state.playerCells.length; i++) {
      for (let j = i + 1; j < state.playerCells.length; j++) {
        const c1 = state.playerCells[i];
        const c2 = state.playerCells[j];
        const dist = getDistance(c1, c2);
        const minDist = c1.radius + c2.radius;

        if (dist < minDist) {
          // Check merge eligibility
          const now = Date.now();
          const canMerge = now > c1.mergeTimer && now > c2.mergeTimer;

          if (canMerge) {
            // Merge c2 into c1
            c1.mass += c2.mass;
            c1.radius = massToRadius(c1.mass);
            state.playerCells.splice(j, 1);
            j--;
            audio.playEat();
          } else {
             // Push apart
            const angle = Math.atan2(c2.y - c1.y, c2.x - c1.x);
            const overlap = minDist - dist;
            const force = overlap / 2;

            c1.x -= Math.cos(angle) * force;
            c1.y -= Math.sin(angle) * force;
            c2.x += Math.cos(angle) * force;
            c2.y += Math.sin(angle) * force;
          }
        }
      }
    }

    // Food Collision - OPTIMIZED
    // Combined loop for Player AND Bots vs Food
    let eatenCount = 0;
    
    // Create a list of all eaters to iterate food once
    const allEaters: {cell: PlayerCell, isBot: boolean, botIndex?: number}[] = [];
    state.playerCells.forEach(c => allEaters.push({cell: c, isBot: false}));
    state.bots.forEach((b, idx) => b.cells.forEach(c => allEaters.push({cell: c, isBot: true, botIndex: idx})));

    for (let i = state.foods.length - 1; i >= 0; i--) {
      const food = state.foods[i];
      let eaten = false;
      
      for (const eater of allEaters) {
        const dx = eater.cell.x - food.x;
        const dy = eater.cell.y - food.y;
        if (Math.abs(dx) > eater.cell.radius || Math.abs(dy) > eater.cell.radius) continue; // coarse check

        const distSq = dx*dx + dy*dy;
        const radSq = eater.cell.radius * eater.cell.radius;

        if (distSq < radSq) {
          eater.cell.mass += 1;
          eater.cell.radius = massToRadius(eater.cell.mass);
          if (!eater.isBot) {
              state.score += 1;
              eatenCount++;
          }
          eaten = true;
          break;
        }
      }

      if (eaten) {
        state.foods[i] = state.foods[state.foods.length - 1];
        state.foods.pop();
      }
    }
    if (eatenCount > 0) audio.playEat();

    // Respawn Food
    while (state.foods.length < 800) {
       state.foods.push({
        id: generateUUID(),
        ...getRandomPos(MAP_WIDTH, MAP_HEIGHT),
        radius: 5 + Math.random() * 3,
        color: getRandomColor(FOOD_COLORS),
        type: 'pellet'
      });
    }

    // Player vs Bot Interactions
    // 1. Check Player eating Bot
    // 2. Check Bot eating Player
    // 3. Check Bot eating Bot (omitted for perf/simplicity, they just overlap)
    
    // We iterate backwards to allow removal
    for (let i = state.bots.length - 1; i >= 0; i--) {
        const bot = state.bots[i];
        for (let j = bot.cells.length - 1; j >= 0; j--) {
            const bCell = bot.cells[j];
            
            // Check vs Player Cells
            for (let k = state.playerCells.length - 1; k >= 0; k--) {
                const pCell = state.playerCells[k];
                const dist = getDistance(pCell, bCell);
                
                // Player Eats Bot
                if (dist < pCell.radius && pCell.mass > bCell.mass * 1.25) {
                    pCell.mass += bCell.mass;
                    pCell.radius = massToRadius(pCell.mass);
                    state.score += Math.floor(bCell.mass);
                    bot.cells.splice(j, 1);
                    audio.playEat();
                    break; // Bot cell died
                }
                
                // Bot Eats Player
                if (dist < bCell.radius && bCell.mass > pCell.mass * 1.25) {
                    bCell.mass += pCell.mass;
                    bCell.radius = massToRadius(bCell.mass);
                    state.playerCells.splice(k, 1);
                    // Don't break, check other players
                }
            }
        }
        // NOTE: Bot respawning is handled at the top of the update loop
    }


    // Virus Collision (Universal)
    for (let i = state.viruses.length - 1; i >= 0; i--) {
      const virus = state.viruses[i];
      let exploded = false;
      
      // Check for Players
      for (let j = state.playerCells.length - 1; j >= 0; j--) {
        const cell = state.playerCells[j];
        if (getDistance(cell, virus) < cell.radius) {
           if (cell.mass > VIRUS_MASS * 1.1) {
             exploded = true;
             audio.playExplode();
             
             // BONUS MASS before split
             cell.mass += VIRUS_BONUS_MASS;
             cell.radius = massToRadius(cell.mass);

             const splitsRemaining = MAX_CELLS - state.playerCells.length;
             let pieces = Math.min(splitsRemaining, 6); 
             
             if (pieces > 0) {
                const massPerPiece = cell.mass / (pieces + 1);
                
                cell.mass = massPerPiece;
                cell.radius = massToRadius(massPerPiece);
                
                for (let k = 0; k < pieces; k++) {
                  const angle = Math.random() * Math.PI * 2;
                  state.playerCells.push({
                    ...cell,
                    id: generateUUID(),
                    mass: massPerPiece,
                    radius: massToRadius(massPerPiece),
                    x: cell.x + Math.cos(angle) * cell.radius,
                    y: cell.y + Math.sin(angle) * cell.radius,
                    vx: Math.cos(angle) * SPLIT_IMPULSE * 1.5, 
                    vy: Math.sin(angle) * SPLIT_IMPULSE * 1.5,
                    mergeTimer: Date.now() + MERGE_COOLDOWN_MS + 5000,
                    createdAt: Date.now()
                  });
                }
             }
             break; 
           }
        }
      }
      
      // Bots hitting Virus
      if (!exploded) {
         state.bots.forEach(bot => {
             bot.cells.forEach(cell => {
                 if (getDistance(cell, virus) < cell.radius && cell.mass > VIRUS_MASS * 1.1) {
                     exploded = true;
                     cell.mass += VIRUS_BONUS_MASS;
                     cell.mass /= 2;
                     cell.radius = massToRadius(cell.mass);
                 }
             })
         })
      }

      if (exploded) {
        state.viruses[i] = state.viruses[state.viruses.length - 1];
        state.viruses.pop();
      }
    }

    // Ejected Mass Logic
    let massConsumed = false;
    for (let i = state.ejectedMass.length - 1; i >= 0; i--) {
      const blob = state.ejectedMass[i];
      
      // BOUNDARY CHECK: Bounce instead of delete
      if (blob.x <= 0) { blob.x = 0; blob.vx *= -1; }
      if (blob.x >= MAP_WIDTH) { blob.x = MAP_WIDTH; blob.vx *= -1; }
      if (blob.y <= 0) { blob.y = 0; blob.vy *= -1; }
      if (blob.y >= MAP_HEIGHT) { blob.y = MAP_HEIGHT; blob.vy *= -1; }

      blob.x += blob.vx;
      blob.y += blob.vy;
      blob.vx *= 0.9;
      blob.vy *= 0.9;

      let consumed = false;
      // Check Player
      for (const cell of state.playerCells) {
         if (getDistance(cell, blob) < cell.radius) {
            if (blob.ownerId === cell.id && Date.now() - blob.createdAt < 500) {
              continue;
            }
            if (cell.mass > blob.mass * 1.25) {
               cell.mass += blob.mass;
               cell.radius = massToRadius(cell.mass);
               consumed = true;
               massConsumed = true;
               break;
            }
         }
      }
      
      // Check Bots
      if (!consumed) {
          for(const bot of state.bots) {
              for (const cell of bot.cells) {
                  if (getDistance(cell, blob) < cell.radius) {
                     if (cell.mass > blob.mass * 1.25) {
                        cell.mass += blob.mass;
                        cell.radius = massToRadius(cell.mass);
                        consumed = true;
                        break;
                     }
                  }
              }
              if (consumed) break;
          }
      }

      if (consumed) {
        state.ejectedMass[i] = state.ejectedMass[state.ejectedMass.length - 1];
        state.ejectedMass.pop();
      }
    }
    if (massConsumed) audio.playEat();

    // Cap total ejected mass to prevent infinite growth
    if (state.ejectedMass.length > 300) {
        state.ejectedMass.splice(0, state.ejectedMass.length - 300);
    }


    // 4. Update Camera
    let totalX = 0; 
    let totalY = 0;
    let totalMass = 0;
    
    // If player is alive, track player. If dead, keep camera where they died or center?
    // Let's keep it where they died (last valid camera pos) if cells = 0
    if (state.playerCells.length > 0) {
      state.playerCells.forEach(c => {
          totalX += c.x;
          totalY += c.y;
          totalMass += c.mass;
      });
      const centerX = totalX / state.playerCells.length;
      const centerY = totalY / state.playerCells.length;
      state.camera.x += (centerX - state.camera.x) * 0.1;
      state.camera.y += (centerY - state.camera.y) * 0.1;

      const idealScale = Math.max(0.1, 1 / Math.pow(totalMass, 0.2)); 
      state.scale += (idealScale - state.scale) * 0.05;
    } 

    // Performance & UI Update Throttling
    const nowPerf = performance.now();
    
    // FPS Calculation
    framesCountRef.current++;
    if (nowPerf - lastFpsTimeRef.current >= 1000) {
        setFps(framesCountRef.current);
        framesCountRef.current = 0;
        lastFpsTimeRef.current = nowPerf;
    }

    if (nowPerf - lastUiUpdateRef.current > 150) {
        setHudScore(state.score);
        setHudMass(Math.floor(totalMass));
        
        // Timer
        const msRemaining = Math.max(0, state.gameEndTime - Date.now());
        const secs = Math.floor(msRemaining / 1000);
        const mins = Math.floor(secs / 60);
        const secDisplay = (secs % 60).toString().padStart(2, '0');
        setHudTime(`${mins}:${secDisplay}`);

        // Respawn Countdown
        if (state.playerCells.length === 0 && playerDeadAtRef.current) {
            const passed = Date.now() - playerDeadAtRef.current;
            const remaining = Math.max(0, Math.ceil((RESPAWN_DELAY_MS - passed) / 1000));
            setRespawnCountdown(remaining);
        } else {
            setRespawnCountdown(null);
        }

        // Leaderboard Calculation
        const entries: LeaderboardEntry[] = [];
        
        // Player
        entries.push({ name: playerName, mass: totalMass, isMe: true });
        
        // Bots
        state.bots.forEach(b => {
            let m = 0;
            b.cells.forEach(c => m += c.mass);
            // Even if bot is dead (mass 0), we show them on leaderboard temporarily until they respawn
            entries.push({ name: b.name, mass: Math.floor(m), isMe: false });
        });
        
        // Sort and Take Top 10
        entries.sort((a, b) => b.mass - a.mass);
        setLeaderboard(entries.slice(0, 10));

        lastUiUpdateRef.current = nowPerf;
    }

  }, [onGameOver, actionRef, spawnBot, spawnPlayer, playerName]);

  // RENDER LOOP
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const state = stateRef.current;

    const width = canvas.width;
    const height = canvas.height;

    // Clear Screen
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    
    // Apply Camera Transform
    ctx.translate(width / 2, height / 2);
    ctx.scale(state.scale, state.scale);
    ctx.translate(-state.camera.x, -state.camera.y);

    // Draw Grid (Viewport Culled)
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const viewL = state.camera.x - (width/2)/state.scale;
    const viewR = state.camera.x + (width/2)/state.scale;
    const viewT = state.camera.y - (height/2)/state.scale;
    const viewB = state.camera.y + (height/2)/state.scale;

    const startX = Math.floor(Math.max(0, viewL) / 100) * 100;
    const endX = Math.ceil(Math.min(MAP_WIDTH, viewR) / 100) * 100;
    const startY = Math.floor(Math.max(0, viewT) / 100) * 100;
    const endY = Math.ceil(Math.min(MAP_HEIGHT, viewB) / 100) * 100;

    for (let x = startX; x <= endX; x += 100) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, MAP_HEIGHT);
    }
    for (let y = startY; y <= endY; y += 100) {
      ctx.moveTo(0, y);
      ctx.lineTo(MAP_WIDTH, y);
    }
    ctx.stroke();

    // Draw Foods - Culled
    const cullDistX = (width/state.scale)/1.5;
    const cullDistY = (height/state.scale)/1.5;
    
    for (let i = 0; i < state.foods.length; i++) {
      const food = state.foods[i];
      if (Math.abs(food.x - state.camera.x) < cullDistX && 
          Math.abs(food.y - state.camera.y) < cullDistY) {
        ctx.fillStyle = food.color;
        ctx.beginPath();
        // Use integer coordinates for rendering to help performance slightly
        ctx.arc(Math.floor(food.x), Math.floor(food.y), Math.floor(food.radius), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw Ejected Mass
    for (let i = 0; i < state.ejectedMass.length; i++) {
      const blob = state.ejectedMass[i];
      // Simple Cull
      if (Math.abs(blob.x - state.camera.x) < cullDistX && 
          Math.abs(blob.y - state.camera.y) < cullDistY) {
        ctx.fillStyle = blob.color;
        ctx.strokeStyle = '#ffffffaa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(Math.floor(blob.x), Math.floor(blob.y), Math.floor(blob.radius), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Draw Viruses
    ctx.fillStyle = '#33ff33';
    ctx.strokeStyle = '#22cc22';
    ctx.lineWidth = 4;
    for (let i = 0; i < state.viruses.length; i++) {
      const virus = state.viruses[i];
      // Simple Cull
      if (Math.abs(virus.x - state.camera.x) < cullDistX && 
          Math.abs(virus.y - state.camera.y) < cullDistY) {
        ctx.beginPath();
        for (let j = 0; j < virus.spikes * 2; j++) {
          const angle = (Math.PI * 2 * j) / (virus.spikes * 2);
          const r = (j % 2 === 0) ? virus.radius : virus.radius * 0.9;
          const vx = virus.x + Math.cos(angle) * r;
          const vy = virus.y + Math.sin(angle) * r;
          if (j === 0) ctx.moveTo(vx, vy);
          else ctx.lineTo(vx, vy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // Draw Bots
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (let i = 0; i < state.bots.length; i++) {
      const bot = state.bots[i];
      // Optimize: Only draw bots near camera
      let visible = false;
      for(const c of bot.cells) {
           if (Math.abs(c.x - state.camera.x) < cullDistX && Math.abs(c.y - state.camera.y) < cullDistY) {
               visible = true;
               break;
           }
      }
      if (!visible) continue;

      ctx.fillStyle = bot.color;
      ctx.strokeStyle = '#00000033'; 
      ctx.lineWidth = 4;
      
      for(const cell of bot.cells) {
          ctx.beginPath();
          ctx.arc(Math.floor(cell.x), Math.floor(cell.y), Math.floor(cell.radius), 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          
          if (cell.radius > 15) {
              ctx.fillStyle = '#fff';
              ctx.font = `bold ${Math.floor(cell.radius/2)}px Arial`;
              ctx.fillText(bot.name, Math.floor(cell.x), Math.floor(cell.y));
              ctx.fillStyle = bot.color; // Reset for next loop
          }
      }
    }

    // Draw Player Cells
    for (let i = 0; i < state.playerCells.length; i++) {
      const cell = state.playerCells[i];
      ctx.fillStyle = cell.color;
      ctx.strokeStyle = '#00000033'; 
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(Math.floor(cell.x), Math.floor(cell.y), Math.floor(cell.radius), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (cell.radius > 10) {
        ctx.fillStyle = '#fff';
        const fontSize = Math.floor(Math.max(10, cell.radius / 2));
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.fillText(playerName, Math.floor(cell.x), Math.floor(cell.y));
      }
    }

    ctx.restore();
  }, [playerName]);

  // Loop Integration
  useEffect(() => {
    if (gameStarted && !stateRef.current.gameStarted) {
      initWorld();
      audio.init(); 
    }

    const loop = () => {
      update();
      draw();
      requestRef.current = requestAnimationFrame(loop);
    };

    if (gameStarted) {
      requestRef.current = requestAnimationFrame(loop);
    }

    return () => cancelAnimationFrame(requestRef.current);
  }, [gameStarted, initWorld, update, draw]);

  // Window Resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Event Listeners (Keyboard)
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed top-0 left-0 w-full h-full"
      />
      {gameStarted && (
        <>
          {/* Leaderboard - Top Left */}
          <div className="fixed top-4 left-4 bg-black/40 p-3 rounded-lg text-white font-mono pointer-events-none select-none z-10 w-48">
             <h3 className="text-center font-bold border-b border-white/20 pb-1 mb-2 text-yellow-400">Leaderboard</h3>
             <ol className="text-sm space-y-1">
                 {leaderboard.map((entry, idx) => (
                     <li key={idx} className={`flex justify-between ${entry.isMe ? 'text-teal-400 font-bold' : 'text-gray-300'}`}>
                         <span>{idx + 1}. {entry.name.slice(0, 10)}</span>
                         <span>{Math.floor(entry.mass)}</span>
                     </li>
                 ))}
             </ol>
          </div>

          {/* Timer - Top Center */}
          <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-black/40 px-4 py-2 rounded-lg text-white font-mono pointer-events-none select-none z-10">
             <span className="text-2xl font-bold tracking-widest">{hudTime}</span>
          </div>

          {/* FPS - Top Right */}
          <div className="fixed top-4 right-4 text-green-400 font-mono pointer-events-none select-none drop-shadow-md z-10 text-right">
             <div className="text-lg font-bold">{fps} FPS</div>
          </div>

          {/* Stats - Bottom Left */}
          <div className="fixed bottom-4 left-4 text-white font-mono pointer-events-none select-none drop-shadow-md z-10 bg-black/30 p-2 rounded">
            <div className="text-xl font-bold">Score: {hudScore}</div>
            <div className="text-sm opacity-80">Mass: {hudMass}</div>
            <div className="text-xs opacity-50 mt-1">
              Pos: {Math.floor(stateRef.current.camera.x)}, {Math.floor(stateRef.current.camera.y)}
            </div>
          </div>

          {/* Respawn Overlay */}
          {respawnCountdown !== null && (
             <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-20">
                <div className="bg-black/70 p-6 rounded-xl text-center backdrop-blur-sm animate-pulse">
                    <h2 className="text-red-500 font-black text-4xl mb-2">YOU DIED</h2>
                    <p className="text-white text-xl">Respawning in {respawnCountdown}...</p>
                </div>
             </div>
          )}
        </>
      )}
    </>
  );
};

export default GameCanvas;
