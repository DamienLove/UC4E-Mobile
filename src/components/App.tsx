
import React, { useReducer, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GameState, GameAction, Upgrade, EnergyOrb, GameNode, QuantumPhage, CollectionEffect, CosmicEvent, AnomalyParticle, ConnectionParticle, WorldTransform, ProjectionState, CollectedItem, Satellite, SpaceDust, Shockwave, FloatingText, VisualEffect } from '../types';
import { UPGRADES, CHAPTERS, TUTORIAL_STEPS, CROSSROADS_EVENTS, NODE_IMAGE_MAP } from './constants';
import { useGameLoop } from '../hooks/useGameLoop';
import { audioService } from '../services/AudioService';
import { generateNodeImage, getGeminiLoreForNode } from '../services/geminiService';
import { useWorldScale } from '../hooks/useWorldScale';

import Simulation from './Simulation';
import UpgradeModal from './UpgradeModal';
import Notification from './Notification';
import Tutorial from './Tutorial';
import MilestoneVisual from './MilestoneVisual';
import SplashScreen from './SplashScreen';
import KarmaParticles from '../hooks/KarmaParticles';
import BackgroundEffects from './BackgroundEffects';
import CrossroadsModal from './CrossroadsModal';
import NodeInspector from './NodeInspector';
import ChapterTransition from './ChapterTransition';
import LevelTransition from './LevelTransition';
import SettingsModal from './SettingsModal';
import { getNodeImagePrompt } from '../services/promptService';


// Constants for game balance
const BASE_KNOWLEDGE_RATE = 0.1;
const STAR_ENERGY_RATE = 0.5;
const LIFE_BIOMASS_RATE = 0.2;
const COLLECTIVE_UNITY_RATE = 0.1;
const DATA_GENERATION_RATE = 0.2;
const STAR_ORB_SPAWN_CHANCE = 0.005;
const PHAGE_SPAWN_CHANCE = 0.0001;
const PHAGE_ATTRACTION = 0.01;
const PHAGE_DRAIN_RATE = 0.5;
const PLAYER_HUNT_RANGE = 150;
const SUPERNOVA_WARNING_TICKS = 1800; 
const SUPERNOVA_EXPLOSION_TICKS = 120; 
const ANOMALY_DURATION_TICKS = 1200; 
const ANOMALY_PULL_STRENGTH = 0.1;
const BLOOM_DURATION_TICKS = 2400; 
const BLOOM_SPAWN_MULTIPLIER = 20;
const BLACK_HOLE_SPAWN_CHANCE = 0.00005;
const BLACK_HOLE_DURATION_TICKS = 3600; 
const BLACK_HOLE_PULL_STRENGTH = 100;

const AIM_ROTATION_SPEED = 0.05; 
const POWER_OSCILLATION_SPEED = 1.5; 
const MAX_LAUNCH_POWER = 40; // Increased power
const PROJECTILE_FRICTION = 0.99; // Less friction for pinball feel
const REFORM_DURATION = 80; // Faster recovery

const ORB_COLLECTION_LEEWAY = 25; 
const AIM_ASSIST_ANGLE = 0.2; 

const SAVE_GAME_KEY = 'universe-connected-save';

const initialProjectionState: ProjectionState = {
  playerState: 'IDLE',
  aimAngle: 0,
  power: 0,
  reformTimer: 0,
};

const createSpaceDust = (count: number, width: number, height: number): SpaceDust[] => {
    return Array.from({length: count}).map((_, i) => ({
        id: `dust_${Date.now()}_${i}`,
        x: (Math.random() - 0.5) * width * 2,
        y: (Math.random() - 0.5) * height * 2,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        size: Math.random() * 2 + 1,
        color: Math.random() > 0.8 ? '#a5f3fc' : '#ffffff'
    }));
};

// Generate a dense, interesting playfield
const createInitialNodes = (): GameNode[] => {
    const nodes: GameNode[] = [
        {
            id: 'player_consciousness',
            label: 'You',
            type: 'player_consciousness',
            x: 0,
            y: 300, // Start slightly lower
            vx: 0,
            vy: 0,
            radius: 20,
            connections: [],
            hasLife: false,
            imageUrl: NODE_IMAGE_MAP.player_consciousness[0], 
            maxIntegrity: 100, currentIntegrity: 100, integrityCooldown: 0,
        },
        {
            id: 'tutorial_planet',
            label: 'Silent World',
            type: 'rocky_planet',
            x: 0,
            y: -150,
            vx: 0,
            vy: 0,
            radius: 25,
            connections: [],
            hasLife: false,
            imageUrl: NODE_IMAGE_MAP.rocky_planet[0], 
            maxIntegrity: 2, currentIntegrity: 2, integrityCooldown: 0,
        },
        {
            id: 'central_star',
            label: 'Prime Star',
            type: 'star',
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            radius: 40,
            connections: [],
            hasLife: false,
            imageUrl: NODE_IMAGE_MAP.star[0],
            maxIntegrity: 2, currentIntegrity: 2, integrityCooldown: 0,
        }
    ];

    // Add asteroid bumpers in a ring
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const radius = 350;
        nodes.push({
            id: `asteroid_ring_${i}`,
            label: 'Asteroid',
            type: 'asteroid',
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
            vx: 0, vy: 0,
            radius: 15,
            connections: [],
            hasLife: false,
            maxIntegrity: 1000, currentIntegrity: 1000, integrityCooldown: 0,
        });
    }
    
    // Add extra planets
    nodes.push({
        id: 'planet_left', label: 'Barren Rock', type: 'rocky_planet',
        x: -250, y: -50, vx: 0, vy: 0, radius: 20, connections: [], hasLife: false,
        imageUrl: NODE_IMAGE_MAP.rocky_planet[0], maxIntegrity: 2, currentIntegrity: 2, integrityCooldown: 0
    });
    nodes.push({
        id: 'planet_right', label: 'Ice Giant', type: 'rocky_planet',
        x: 250, y: -50, vx: 0, vy: 0, radius: 22, connections: [], hasLife: false,
        imageUrl: NODE_IMAGE_MAP.rocky_planet[0], maxIntegrity: 2, currentIntegrity: 2, integrityCooldown: 0
    });

    return nodes;
};

const initialState: GameState = {
  gameStarted: false,
  isPaused: false,
  energy: 50,
  knowledge: 10,
  biomass: 0,
  unity: 0,
  complexity: 0,
  data: 0,
  karma: 0,
  inventory: [
    { id: 'stabilizer_1', name: 'Quantum Stabilizer', description: 'Temporarily boosts resource gain from anomalies.', icon: 'stabilizer' }
  ],
  unlockedUpgrades: new Set(),
  currentChapter: 0,
  tutorialStep: 0,
  activeMilestone: null,
  activeCrossroadsEvent: null,
  activeChapterTransition: null,
  zoomLevel: 0,
  levelTransitionState: 'none',
  nodes: createInitialNodes(),
  satellites: [],
  spaceDust: [],
  phages: [],
  cosmicEvents: [],
  notifications: [],
  connectMode: { active: false, sourceNodeId: null },
  projection: initialProjectionState,
  turnHitIds: new Set(),
  connectionParticles: [],
  energyOrbs: [],
  collectionEffects: [],
  collectionBlooms: [],
  collectionFlares: [],
  projectileTrailParticles: [],
  shockwaves: [],
  floatingTexts: [],
  visualEffects: [],
  selectedNodeId: null,
  aimAssistTargetId: null,
  loreState: { nodeId: null, text: '', isLoading: false },
  screenShake: { intensity: 0, duration: 0 },
  anomalyParticles: [],
  settings: {
    sfxVolume: 1.0,
    musicVolume: 0.3,
    colorblindMode: 'none',
    aimAssist: true,
  }
};

const HARMONY_THRESHOLD = 50;
const CHAOS_THRESHOLD = -50;

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START_GAME': {
      audioService.userInteraction().then(() => audioService.playBackgroundMusic());
      const playerNode = state.nodes.find(n => n.type === 'player_consciousness');
      if (!playerNode) return state; 

      const updatedNodes = state.nodes.map(n => 
        n.id === playerNode.id ? { ...n, imageUrl: action.payload.playerImageUrl } : n
      );

      // Initialize dust
      const initialDust = createSpaceDust(80, 2000, 2000);

      return { 
        ...initialState, 
        gameStarted: true, 
        nodes: updatedNodes,
        spaceDust: initialDust,
        notifications: ['The cosmos awakens to your presence.'] 
      };
    }
    case 'TICK': {
      if (state.isPaused) return state;
      let nextState = { ...state };
      const { width, height, transform } = action.payload;
      const worldRadius = (Math.min(width, height) * 1.5) / (state.zoomLevel + 1);
      
      let mutableNodes = nextState.nodes.map(n => ({...n}));
      let playerNode = mutableNodes.find(n => n.type === 'player_consciousness');
      let newShockwaves = [...nextState.shockwaves];
      let newFloatingTexts = [...nextState.floatingTexts];
      let newVisualEffects = [...nextState.visualEffects];

      // --- PROJECTION STATE MACHINE & COLLISION ---
      if (playerNode) {
          switch (nextState.projection.playerState) {
            case 'AIMING_DIRECTION': {
              const selectedId = nextState.selectedNodeId;
              let potentialTarget: string | null = null;
              let newAngle = nextState.projection.aimAngle + AIM_ROTATION_SPEED;

              // Priority: Lock onto user-selected target
              if (selectedId) {
                  const targetNode = mutableNodes.find(n => n.id === selectedId);
                  if (targetNode) {
                      potentialTarget = selectedId;
                      // Instantly aim at the selected target
                      const dx = targetNode.x - playerNode.x;
                      const dy = targetNode.y - playerNode.y;
                      newAngle = Math.atan2(dy, dx);
                  }
              } 
              
              // Fallback: Scan for targets if aim assist is enabled and no valid selection
              if (!potentialTarget && nextState.settings.aimAssist) {
                  for (const node of mutableNodes) {
                      if (node.id === playerNode.id) continue;
                      const angleToNode = Math.atan2(node.y - playerNode.y, node.x - playerNode.x);
                      let angleDiff = Math.abs(newAngle - angleToNode);
                      if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff; 
                      if (angleDiff < AIM_ASSIST_ANGLE) {
                          potentialTarget = node.id;
                          newAngle = angleToNode + (angleDiff * 0.1 * (newAngle > angleToNode ? -1 : 1)); // Magnetic snap
                          break;
                      }
                  }
              }
              
              nextState.aimAssistTargetId = potentialTarget;
              nextState.projection.aimAngle = newAngle;
              break;
            }
            case 'AIMING_POWER':
              nextState.projection.power = (Math.sin(Date.now() / (1000 / POWER_OSCILLATION_SPEED)) + 1) * 50;
              break;
            case 'PROJECTING': {
              // 1. Dust Collision (Satisfying Pop)
              const dustToRemove = new Set<string>();
              nextState.spaceDust.forEach(dust => {
                  const dist = Math.hypot(playerNode!.x - dust.x, playerNode!.y - dust.y);
                  if (dist < playerNode!.radius + dust.size + 10) {
                      dustToRemove.add(dust.id);
                      nextState.knowledge += 0.5; // Small reward
                  }
              });
              if (dustToRemove.size > 0) {
                  nextState.spaceDust = nextState.spaceDust.filter(d => !dustToRemove.has(d.id));
                  nextState.spaceDust.push(...createSpaceDust(dustToRemove.size, width * 3, height * 3));
              }

              // 2. Node Collision
              for (const node of mutableNodes) {
                  if (node.id === playerNode.id) continue;
                  const dist = Math.hypot(playerNode.x - node.x, playerNode.y - node.y);
                  
                  if (dist < playerNode.radius + node.radius) {
                      
                      // COLLISION HANDLER
                      if (node.integrityCooldown <= 0) {
                          if (node.type !== 'asteroid') {
                              node.currentIntegrity -= 1;
                          }
                          node.integrityCooldown = 20; // Short invulnerability frames
                          
                          // BOUNCE PHYSICS
                          const angle = Math.atan2(playerNode.y - node.y, playerNode.x - node.x);
                          const speed = Math.hypot(playerNode.vx, playerNode.vy);
                          
                          // Bumpers bounce harder
                          let bounceFactor = 0.85;
                          if (node.type === 'asteroid') bounceFactor = 1.3;
                          if (node.type === 'star') bounceFactor = 1.1;

                          playerNode.vx = Math.cos(angle) * speed * bounceFactor;
                          playerNode.vy = Math.sin(angle) * speed * bounceFactor;

                          // Check Integrity Death
                          if (node.currentIntegrity <= 0 && node.type !== 'asteroid') {
                              // --- DESTABILIZATION / ASSIMILATION ---
                              if (node.type === 'star') {
                                  // Solar Super-Charge (Supernova)
                                  playerNode.vx *= 1.5; playerNode.vy *= 1.5;
                                  
                                  nextState.energy += 1000;
                                  newFloatingTexts.push({
                                      id: `ft_${Date.now()}`, x: node.x, y: node.y - 40,
                                      text: "SUPERNOVA!", color: "#fde047", life: 80, vy: -1
                                  });
                                  
                                  nextState.screenShake = { intensity: 30, duration: 30 };
                                  newShockwaves.push({ id: `shock_${Date.now()}`, x: node.x, y: node.y, maxRadius: 500, life: 0 });
                                  audioService.playSound('phage_spawn');
                                  nextState.notifications.push("SOLAR SUPER-CHARGE!");
                                  
                                  // Reset Star
                                  node.currentIntegrity = node.maxIntegrity;
                                  node.integrityCooldown = 600; // 10 seconds downtime

                                  // Spawn Eruption
                                  for(let i=0; i<15; i++) {
                                      const orbAngle = Math.random() * Math.PI * 2;
                                      nextState.energyOrbs.push({
                                          id: `erupt_${Date.now()}_${i}`,
                                          x: node.x, y: node.y,
                                          vx: Math.cos(orbAngle) * 9, vy: Math.sin(orbAngle) * 9,
                                          radius: 8, value: 50
                                      });
                                  }
                              } else if (node.type === 'rocky_planet' || node.type === 'life_seed' || node.type === 'sentient_colony') {
                                  // Planet Assimilation
                                  playerNode.vx *= 0.6; playerNode.vy *= 0.6; // Slow down a bit on capture
                                  
                                  nextState.nodes = nextState.nodes.filter(n => n.id !== node.id);
                                  mutableNodes = mutableNodes.filter(n => n.id !== node.id);
                                  
                                  nextState.satellites.push({
                                      id: node.id, type: node.type, imageUrl: node.imageUrl, label: node.label,
                                      orbitRadius: 60 + (nextState.satellites.length * 20),
                                      orbitSpeed: 0.02 + (Math.random() * 0.01), angle: Math.random() * Math.PI * 2,
                                  });
                                  
                                  nextState.biomass += 200;
                                  newFloatingTexts.push({
                                      id: `ft_${Date.now()}`, x: node.x, y: node.y - 40,
                                      text: "ASSIMILATED", color: "#67e8f9", life: 60, vy: -1
                                  });

                                  nextState.screenShake = { intensity: 15, duration: 15 };
                                  newShockwaves.push({ id: `shock_${Date.now()}`, x: node.x, y: node.y, maxRadius: 150, life: 0 });
                                  audioService.playSound('connection_bounce');
                              }
                          } else {
                              // --- STANDARD HIT / COMBO ---
                              const isCombo = nextState.turnHitIds.has(node.id);
                              
                              let reward = 0;
                              let color = "#fff";
                              let rewardText = "";
                              
                              if (node.type === 'star') { 
                                  reward = isCombo ? 200 : 100; 
                                  color = "#fde047"; 
                                  nextState.energy += reward; 
                                  rewardText = isCombo ? `DOUBLE FLAME! +${reward}` : `FLARE +${reward}`;
                                  
                                  // Solar Flare Visual
                                  newVisualEffects.push({
                                      id: `flare_${Date.now()}`, x: node.x, y: node.y, type: 'flare', life: 30, scale: 1.5
                                  });
                              }
                              else if (node.type === 'asteroid') { 
                                  reward = isCombo ? 20 : 10; 
                                  color = "#9ca3af"; 
                                  nextState.knowledge += reward; 
                                  rewardText = "BUMP"; 
                              }
                              else { 
                                  reward = isCombo ? 100 : 50; 
                                  color = "#86efac"; 
                                  nextState.biomass += reward; 
                                  rewardText = isCombo ? `CRACK! +${reward}` : `HIT +${reward}`;
                              }
                              
                              // Add to combo tracker
                              nextState.turnHitIds.add(node.id);

                              // Visuals
                              newFloatingTexts.push({
                                  id: `ft_${Date.now()}`, x: node.x, y: node.y - 30,
                                  text: rewardText, color: color, life: 40, vy: -1.5
                              });
                              
                              if (isCombo) {
                                  // Sparks!
                                  for(let k=0; k<8; k++) {
                                      newVisualEffects.push({
                                          id: `spark_${Date.now()}_${k}`, 
                                          x: node.x + (Math.random()-0.5)*node.radius, 
                                          y: node.y + (Math.random()-0.5)*node.radius, 
                                          type: 'spark', life: 20, 
                                          angle: Math.random() * Math.PI * 2
                                      });
                                  }
                                  audioService.playSound('collect_orb_good');
                              } else {
                                  audioService.playSound(node.type === 'asteroid' ? 'pinball_bounce' : 'node_bounce');
                              }
                              
                              nextState.screenShake = { intensity: 5, duration: 5 };
                          }
                      }
                      
                      break; 
                  }
              }

              // Reform if too slow
              if (Math.hypot(playerNode.vx, playerNode.vy) < 0.8) {
                  playerNode.vx = 0;
                  playerNode.vy = 0;
                  nextState.projection.playerState = 'REFORMING';
                  nextState.projection.reformTimer = REFORM_DURATION;
              }
              break;
            }
            case 'REFORMING':
              nextState.projection.reformTimer--;
              if (nextState.projection.reformTimer <= 0) {
                nextState.projection.playerState = 'IDLE';
              }
              break;
          }
      }

      // --- SATELLITE LOGIC ---
      if (playerNode) {
          nextState.satellites = nextState.satellites.map(sat => {
              sat.angle += sat.orbitSpeed;
              nextState.energy += 0.1; 
              if (sat.type === 'life_seed') nextState.biomass += 0.1;
              return sat;
          });
      }

      // --- DUST PHYSICS ---
      nextState.spaceDust = nextState.spaceDust.map(d => ({
          ...d,
          x: d.x + d.vx,
          y: d.y + d.vy
      }));

      // --- SHOCKWAVE UPDATES ---
      nextState.shockwaves = newShockwaves.map(s => ({
          ...s,
          life: s.life + 0.05
      })).filter(s => s.life < 1);
      
      // --- FLOATING TEXT UPDATES ---
      nextState.floatingTexts = newFloatingTexts.map(t => ({
          ...t,
          y: t.y + t.vy,
          life: t.life - 1
      })).filter(t => t.life > 0);
      
      // --- VISUAL EFFECTS UPDATES ---
      nextState.visualEffects = newVisualEffects.map(e => ({
          ...e, life: e.life - 1
      })).filter(e => e.life > 0);


      // Resources & Karma logic
      let harmonyBonus = nextState.karma > HARMONY_THRESHOLD ? 1.25 : 1.0;
      nextState.knowledge += BASE_KNOWLEDGE_RATE;
      nextState.nodes.forEach(node => {
        // Cooldown recovery
        if (node.integrityCooldown > 0) node.integrityCooldown--;
        
        if (node.type === 'star') nextState.energy += STAR_ENERGY_RATE;
      });
      
      
      // Node Physics (Asteroids move slowly)
      mutableNodes.forEach(node => {
        // Player is only moved by projectile physics
        if (node.type === 'player_consciousness') {
             if (nextState.projection.playerState === 'PROJECTING') {
                 node.x += node.vx;
                 node.y += node.vy;
                 node.vx *= PROJECTILE_FRICTION;
                 node.vy *= PROJECTILE_FRICTION;
             }
        } else {
            // Other node physics
             mutableNodes.forEach(otherNode => {
              if (node.id === otherNode.id || otherNode.type === 'player_consciousness') return;
              const dx = otherNode.x - node.x;
              const dy = otherNode.y - node.y;
              const distSq = dx * dx + dy * dy;
              if (distSq > 100) {
                const dist = Math.sqrt(distSq);
                const force = (otherNode.type === 'star' ? 0.2 : 0.05) * otherNode.radius / distSq;
                node.vx += (dx / dist) * force;
                node.vy += (dy / dist) * force;
              }
            });
            node.x += node.vx;
            node.y += node.vy;
            node.vx *= 0.99;
            node.vy *= 0.99;
        }
        
        // Boundary checks (Sidewalls)
        const distFromCenter = Math.sqrt(node.x * node.x + node.y * node.y);
        if (distFromCenter > worldRadius - node.radius) {
            const angle = Math.atan2(node.y, node.x);
            node.x = Math.cos(angle) * (worldRadius - node.radius);
            node.y = Math.sin(angle) * (worldRadius - node.radius);
            // Bounce
            if (node.type === 'player_consciousness') {
                 const dot = node.vx * Math.cos(angle) + node.vy * Math.sin(angle);
                 node.vx -= 2.2 * dot * Math.cos(angle); 
                 node.vy -= 2.2 * dot * Math.sin(angle);
                 
                 // Wall Bounce Effect
                 nextState.screenShake = { intensity: 3, duration: 5 };
                 newVisualEffects.push({
                     id: `wall_hit_${Date.now()}`,
                     x: node.x, y: node.y, type: 'spark', life: 10, scale: 2
                 });
            } else {
                 node.vx *= -0.5;
                 node.vy *= -0.5;
            }
        }
        
        // Star Orb Logic
        if (node.type === 'star' && Math.random() < STAR_ORB_SPAWN_CHANCE) {
            nextState.energyOrbs.push({
                id: `orb_${Date.now()}_${Math.random()}`,
                x: node.x + (Math.random() - 0.5) * node.radius,
                y: node.y + (Math.random() - 0.5) * node.radius,
                vx: (Math.random() - 0.5) * 1,
                vy: (Math.random() - 0.5) * 1,
                radius: 4, value: 10
            });
        }
      });

      if (playerNode) {
          nextState.energyOrbs = nextState.energyOrbs.filter(orb => {
              const dx = playerNode.x - orb.x;
              const dy = playerNode.y - orb.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < playerNode.radius + orb.radius + ORB_COLLECTION_LEEWAY) {
                  nextState.energy += orb.value; // variable value
                  audioService.playSound('collect_orb_standard');
                  return false;
              }
              return true;
          });
      }

      nextState.projectileTrailParticles = nextState.projectileTrailParticles
        .map(p => ({ ...p, life: p.life - 1 }))
        .filter(p => p.life > 0);
      
      if (playerNode && nextState.projection.playerState === 'PROJECTING') {
          nextState.projectileTrailParticles.push({
              id: `trail_${Date.now()}`,
              x: playerNode.x,
              y: playerNode.y,
              life: 25, 
          });
      }

      nextState.nodes = mutableNodes;
      return nextState;
    }
    case 'PURCHASE_UPGRADE': {
      const { upgrade, imageUrl } = action.payload;
      let nextState = { ...state };
      for (const resource of Object.keys(upgrade.cost) as Array<keyof typeof upgrade.cost>) {
        const value = upgrade.cost[resource];
        if (value !== undefined) {
          (nextState as any)[resource] -= value;
        }
      }
      nextState.unlockedUpgrades = new Set(nextState.unlockedUpgrades).add(upgrade.id);
      nextState = upgrade.effect(nextState, imageUrl);
      if (upgrade.animationId) nextState.activeMilestone = { id: upgrade.animationId, imageUrl };
      audioService.playSound('purchase_upgrade');
      return nextState;
    }
    case 'ADVANCE_TUTORIAL':
      if (action.payload?.forceEnd || state.tutorialStep >= TUTORIAL_STEPS.length - 1) return { ...state, tutorialStep: -1 };
      return { ...state, tutorialStep: state.tutorialStep + 1 };
    case 'DISMISS_NOTIFICATION':
      return { ...state, notifications: state.notifications.filter((_, i) => i !== action.payload.index) };
    case 'MILESTONE_COMPLETE':
      return { ...state, activeMilestone: null };
    case 'START_LEVEL_TRANSITION':
      return { ...state, levelTransitionState: 'zooming' };
    case 'COMPLETE_LEVEL_TRANSITION': {
       const playerNode = state.nodes.find(n => n.type === 'player_consciousness');
       return { 
         ...state, 
         levelTransitionState: 'none', 
         zoomLevel: state.zoomLevel + 1,
         nodes: playerNode ? [playerNode] : [], 
         satellites: [], // Satellites consumed for level up
         energyOrbs: [],
         cosmicEvents: [],
         spaceDust: createSpaceDust(80, 2000, 2000), // Refresh dust
       };
    }
    case 'END_CHAPTER_TRANSITION':
      return { ...state, activeChapterTransition: null };
    case 'SELECT_NODE':
      let newState = { ...state, selectedNodeId: action.payload.nodeId };
      
      // Update Aim Assist to target the selected node
      if (action.payload.nodeId) {
          newState.aimAssistTargetId = action.payload.nodeId;
      }
      
      if (state.tutorialStep === 2 && action.payload.nodeId === 'tutorial_planet') {
          newState.tutorialStep = 3;
      }
      return newState;
    case 'SET_LORE_LOADING':
      if (state.tutorialStep === 3 && action.payload.nodeId === 'tutorial_planet') return { ...state, loreState: { nodeId: action.payload.nodeId, text: '', isLoading: true }, tutorialStep: 4 };
      return { ...state, loreState: { nodeId: action.payload.nodeId, text: '', isLoading: true } };
    case 'SET_LORE_RESULT':
      if (state.loreState.nodeId !== action.payload.nodeId) return state; 
      return { ...state, loreState: { ...state.loreState, text: action.payload.text, isLoading: false } };
    case 'CLEAR_LORE':
      return { ...state, loreState: { nodeId: null, text: '', isLoading: false } };
    case 'SET_PAUSED':
      return { ...state, isPaused: action.payload };
    case 'START_AIMING':
        if (state.projection.playerState !== 'IDLE') return state;
        let nextTutorialStep = state.tutorialStep;
        if (state.tutorialStep === 0) nextTutorialStep = 1;
        return { ...state, tutorialStep: nextTutorialStep, projection: { ...state.projection, playerState: 'AIMING_DIRECTION' } };
    case 'SET_DIRECTION':
        if (state.projection.playerState !== 'AIMING_DIRECTION') return state;
         let nextTutorialStep2 = state.tutorialStep;
        if (state.tutorialStep === 1) nextTutorialStep2 = 2;
        const player = state.nodes.find(n => n.type === 'player_consciousness');
        const target = state.nodes.find(n => n.id === state.aimAssistTargetId);
        let finalAimAngle = state.projection.aimAngle;
        if (player && target) finalAimAngle = Math.atan2(target.y - player.y, target.x - player.x);
        return { ...state, tutorialStep: nextTutorialStep2, projection: { ...state.projection, playerState: 'AIMING_POWER', aimAngle: finalAimAngle } };
    case 'LAUNCH_PLAYER':
        if (state.projection.playerState !== 'AIMING_POWER') return state;
        const p = state.nodes.find(n => n.type === 'player_consciousness');
        if (!p) return state;
        const launchStrength = (state.projection.power / 100) * MAX_LAUNCH_POWER;
        const newNodes = state.nodes.map(n => n.id === p.id ? { ...n, vx: Math.cos(state.projection.aimAngle) * launchStrength, vy: Math.sin(state.projection.aimAngle) * launchStrength } : n);
         let nextTutorialStep3 = state.tutorialStep;
        if (state.tutorialStep === 2) nextTutorialStep3 = 3;
        
        // Add initial trail particle
        const newTrail = {
            id: `trail_${Date.now()}`,
            x: p.x,
            y: p.y,
            life: 15
        };

        return { 
            ...state, 
            tutorialStep: nextTutorialStep3, 
            nodes: newNodes, 
            projection: { ...state.projection, playerState: 'PROJECTING', power: 0 },
            projectileTrailParticles: [...state.projectileTrailParticles, newTrail],
            turnHitIds: new Set(), // Reset combos for new launch
        };

     case 'UPDATE_NODE_IMAGE':
        return { ...state, nodes: state.nodes.map(node => node.id === action.payload.nodeId ? { ...node, imageUrl: action.payload.imageUrl } : node) };
    case 'CHANGE_SETTING':
        const { key, value } = action.payload;
        const newSettings = { ...state.settings, [key]: value };
        if (key === 'sfxVolume') audioService.setSfxVolume(value as number);
        if (key === 'musicVolume') audioService.setMusicVolume(value as number);
        return { ...state, settings: newSettings };
    case 'USE_ITEM':
        const { itemId } = action.payload;
        const item = state.inventory.find(i => i.id === itemId);
        if (!item) return state;
        let ns = { ...state };
        if (item.name === 'Quantum Stabilizer') ns.notifications = [...ns.notifications, 'Quantum fields stabilized!'];
        ns.inventory = state.inventory.filter(i => i.id !== itemId);
        return ns;
    case 'SAVE_GAME':
        try {
            const stateToSave = { ...state, unlockedUpgrades: Array.from(state.unlockedUpgrades) };
            localStorage.setItem(SAVE_GAME_KEY, JSON.stringify(stateToSave));
            return { ...state, notifications: [...state.notifications, 'Game Saved!'] };
        } catch (e) {
            console.error("Failed to save game", e);
            return { ...state, notifications: [...state.notifications, 'Error: Could not save game.'] };
        }
    case 'LOAD_GAME':
      try {
        const loadedState = action.payload;
        loadedState.unlockedUpgrades = new Set(loadedState.unlockedUpgrades);
        audioService.userInteraction().then(() => audioService.playBackgroundMusic());
        return { ...loadedState, isPaused: false, gameStarted: true, notifications: [...loadedState.notifications, 'Game Loaded!']};
      } catch (e) {
          console.error("Failed to load game", e);
          return state;
      }
    default:
      return state;
  }
}

const App: React.FC = () => {
  const [gameState, dispatch] = useReducer(gameReducer, initialState);
  const [isUpgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [energyPulse, setEnergyPulse] = useState(false);
  const [knowledgePulse, setKnowledgePulse] = useState(false);
  const prevResources = useRef({ energy: gameState.energy, knowledge: gameState.knowledge });

  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  useEffect(() => {
    if (gameState.energy > prevResources.current.energy) {
        setEnergyPulse(true); setTimeout(() => setEnergyPulse(false), 500);
    }
    if (gameState.knowledge > prevResources.current.knowledge) {
        setKnowledgePulse(true); setTimeout(() => setKnowledgePulse(false), 500);
    }
    prevResources.current = { energy: gameState.energy, knowledge: gameState.knowledge };
  }, [gameState.energy, gameState.knowledge]);

  const { transform, handleWheel, handleMouseDown, handleMouseUp, handleMouseMove, screenToWorld: rawScreenToWorld, zoom, isPanningRef } = useWorldScale(0.4);
  const screenToWorld = useCallback((x: number, y: number) => rawScreenToWorld(x, y, dimensions), [rawScreenToWorld, dimensions]);

  useGameLoop(dispatch, dimensions, gameState.isPaused, transform);

  const startGame = useCallback(async () => {
    // Initiate high-quality image generation for game start
    const playerImagePromise = generateNodeImage(getNodeImagePrompt('player_consciousness'));
    const planetImagePromise = generateNodeImage(getNodeImagePrompt('rocky_planet'));
    const [playerImageUrl, planetImageUrl] = await Promise.all([playerImagePromise, planetImagePromise]);
    dispatch({ type: 'START_GAME', payload: { playerImageUrl: playerImageUrl || NODE_IMAGE_MAP.player_consciousness[0] } });
    setTimeout(() => {
      if (planetImageUrl) dispatch({ type: 'UPDATE_NODE_IMAGE', payload: { nodeId: 'tutorial_planet', imageUrl: planetImageUrl } });
    }, 10);
  }, []);

  const loadGame = useCallback(() => {
    const savedGame = localStorage.getItem(SAVE_GAME_KEY);
    if (savedGame) dispatch({ type: 'LOAD_GAME', payload: JSON.parse(savedGame) });
  }, []);
  
  const chapterInfo = useMemo(() => CHAPTERS[gameState.currentChapter], [gameState.currentChapter]);
  const karmaIndicatorPosition = useMemo(() => `${(gameState.karma + 100) / 2}%`, [gameState.karma]);
  const chapterUpgrades = useMemo(() => UPGRADES.filter(u => u.chapter === gameState.currentChapter), [gameState.currentChapter]);
  const unlockedChapterUpgrades = useMemo(() => chapterUpgrades.filter(u => gameState.unlockedUpgrades.has(u.id)).length, [chapterUpgrades, gameState.unlockedUpgrades]);
  const chapterProgress = useMemo(() => chapterUpgrades.length > 0 ? (unlockedChapterUpgrades / chapterUpgrades.length) * 100 : 0, [unlockedChapterUpgrades, chapterUpgrades.length]);

  if (!gameState.gameStarted) {
    return <SplashScreen onStartGame={startGame} onLoadGame={loadGame} dispatch={dispatch} settings={gameState.settings} />;
  }

  return (
    <>
      <div className={`app-container colorblind-${gameState.settings.colorblindMode} ${gameState.screenShake.duration > 0 ? 'screen-shake' : ''}`} style={{'--shake-intensity': `${gameState.screenShake.intensity}px`} as React.CSSProperties}>
        <BackgroundEffects gameState={gameState} dimensions={dimensions} />
        <KarmaParticles karma={gameState.karma} width={dimensions.width} height={dimensions.height} />
        <Simulation 
          gameState={gameState} 
          dispatch={dispatch} 
          dimensions={dimensions} 
          isZoomingOut={gameState.levelTransitionState === 'zooming'}
          transform={transform}
          worldScaleHandlers={{handleWheel, handleMouseDown, handleMouseUp, handleMouseMove}}
          screenToWorld={screenToWorld}
          isPanningRef={isPanningRef}
        />
      </div>
      
      {/* --- HUD --- */}
      <div className="hud-container absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-4">
          
          {/* Top Status Bar */}
          <div className="flex justify-between items-start w-full">
              {/* Left: Resources */}
              <div className="flex gap-4 pointer-events-auto">
                  <div className={`hud-resource-pill glass-panel ${energyPulse ? 'border-yellow-400' : 'border-white/10'}`}>
                      <span className="text-yellow-400 font-bold text-lg drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]">⚡</span>
                      <span className="font-mono text-lg tracking-wider">{Math.floor(gameState.energy).toLocaleString()}</span>
                  </div>
                  <div className={`hud-resource-pill glass-panel ${knowledgePulse ? 'border-purple-400' : 'border-white/10'}`}>
                      <span className="text-purple-400 font-bold text-lg drop-shadow-[0_0_5px_rgba(192,132,252,0.5)]">◈</span>
                      <span className="font-mono text-lg tracking-wider">{Math.floor(gameState.knowledge).toLocaleString()}</span>
                  </div>
                  <div className="hud-resource-pill glass-panel border-white/10">
                      <span className="text-green-400 font-bold text-lg drop-shadow-[0_0_5px_rgba(74,222,128,0.5)]">🌱</span>
                      <span className="font-mono text-lg tracking-wider">{Math.floor(gameState.biomass).toLocaleString()}</span>
                  </div>
              </div>

              {/* Center: Objective & Karma */}
              <div className="flex flex-col items-center glass-panel px-8 py-2 pointer-events-auto bg-black/40 backdrop-blur-md rounded-b-2xl border-t-0">
                  <div className="text-xs text-cyan-400 uppercase tracking-[0.2em] font-bold mb-1">{chapterInfo.name}</div>
                  <div className="w-64 h-1.5 bg-gray-800 rounded-full overflow-hidden mb-1">
                      <div className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500" style={{ width: `${chapterProgress}%` }}></div>
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono">{chapterInfo.objective}</div>
                  
                  {/* Minimalist Karma Bar */}
                  <div className="w-64 h-1 mt-2 bg-white/10 rounded-full relative overflow-hidden">
                      <div className="absolute top-0 bottom-0 left-0 bg-red-500 w-1/2 opacity-20"></div>
                      <div className="absolute top-0 bottom-0 right-0 bg-cyan-500 w-1/2 opacity-20"></div>
                      <div className="absolute top-0 bottom-0 w-20 bg-white/80 blur-[2px]" style={{ left: karmaIndicatorPosition, transform: 'translateX(-50%)', transition: 'left 0.5s ease' }}></div>
                  </div>
              </div>

              {/* Right: Menu */}
              <div className="flex flex-col items-end gap-2 pointer-events-auto">
                  <button onClick={() => setSettingsModalOpen(true)} className="p-3 rounded-full glass-panel hover:bg-white/10 transition-colors group">
                      <svg className="w-6 h-6 text-gray-400 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                  </button>
                  {gameState.notifications.map((msg, index) => (
                    <Notification key={`${msg}-${index}`} message={msg} onDismiss={() => dispatch({ type: 'DISMISS_NOTIFICATION', payload: { index } })} />
                  ))}
              </div>
          </div>

          {/* Bottom Command Dock */}
          <div className="flex justify-between items-end w-full pb-4">
              {/* Inventory */}
              <div className="flex gap-2 pointer-events-auto">
                  {gameState.inventory.map(item => (
                    <button
                      key={item.id}
                      className="w-14 h-14 rounded-xl glass-panel flex items-center justify-center hover:border-cyan-400/50 hover:bg-cyan-900/20 transition-all active:scale-95"
                      onClick={() => dispatch({ type: 'USE_ITEM', payload: { itemId: item.id }})}
                      title={item.name}
                    >
                        <div className={`w-8 h-8 icon-${item.icon} bg-contain opacity-80`}></div>
                    </button>
                  ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-6 pointer-events-auto">
                  <div className="flex flex-col gap-2">
                      <button onClick={() => zoom(1.2)} className="w-10 h-10 rounded-full glass-panel flex items-center justify-center text-cyan-300 hover:text-white transition-colors text-xl bg-black/40">+</button>
                      <button onClick={() => zoom(1/1.2)} className="w-10 h-10 rounded-full glass-panel flex items-center justify-center text-cyan-300 hover:text-white transition-colors text-xl bg-black/40">-</button>
                  </div>
                  
                  <button 
                    onClick={() => setUpgradeModalOpen(true)} 
                    className="neon-button primary w-20 h-20 rounded-full flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(0,243,255,0.2)]"
                  >
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                  </button>
              </div>
          </div>
      </div>
      
      {gameState.isPaused && (
          <div className="pause-overlay">
            <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400 tracking-widest mb-8 font-['Orbitron']">PAUSED</h1>
            <button onClick={() => dispatch({type: 'SET_PAUSED', payload: false})} className="neon-button h-12 w-48 rounded-lg">RESUME</button>
          </div>
      )}
      
      <NodeInspector gameState={gameState} dispatch={dispatch} />
      
      {isUpgradeModalOpen && <UpgradeModal isOpen={isUpgradeModalOpen} onClose={() => setUpgradeModalOpen(false)} gameState={gameState} onPurchase={(upgrade, imageUrl) => dispatch({type: 'PURCHASE_UPGRADE', payload: {upgrade, imageUrl}})} />}
      {isSettingsModalOpen && <SettingsModal settings={gameState.settings} dispatch={dispatch} onClose={() => setSettingsModalOpen(false)} />}
      {gameState.tutorialStep !== -1 && <Tutorial step={gameState.tutorialStep} dispatch={dispatch} />}
      {gameState.activeMilestone && <MilestoneVisual milestoneId={gameState.activeMilestone.id} imageUrl={gameState.activeMilestone.imageUrl} onComplete={() => dispatch({type: 'MILESTONE_COMPLETE'})} />}
      {gameState.activeCrossroadsEvent && <CrossroadsModal event={gameState.activeCrossroadsEvent} dispatch={dispatch} />}
      {gameState.activeChapterTransition && <ChapterTransition chapterId={gameState.activeChapterTransition} dispatch={dispatch} />}
      {gameState.levelTransitionState !== 'none' && <LevelTransition levelState={gameState.levelTransitionState} zoomLevel={gameState.zoomLevel} dispatch={dispatch} />}
    </>
  );
};

export default App;
