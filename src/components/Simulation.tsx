
import React, { useEffect } from 'react';
import { GameAction, GameState, WorldTransform } from '../types';
import LoreTooltip from './LoreTooltip';

interface SimulationProps {
  gameState: GameState;
  dispatch: React.Dispatch<GameAction>;
  dimensions: { width: number; height: number };
  isZoomingOut: boolean;
  transform: WorldTransform;
  worldScaleHandlers: {
    handleWheel: (event: React.WheelEvent) => void;
    handleMouseDown: (event: React.MouseEvent) => void;
    handleMouseUp: () => void;
    handleMouseMove: (event: React.MouseEvent) => void;
  };
  screenToWorld: (screenX: number, screenY: number) => { x: number; y: number };
  isPanningRef: React.MutableRefObject<boolean>;
  setCameraTarget?: (x: number, y: number, scale: number) => void; // New prop
}

const PLAYER_HUNT_RANGE = 150;

const Simulation: React.FC<SimulationProps> = ({ 
    gameState, dispatch, dimensions, isZoomingOut, transform, 
    worldScaleHandlers, screenToWorld, isPanningRef, setCameraTarget 
}) => {
  const { width, height } = dimensions;
  const playerNode = gameState.nodes.find(n => n.type === 'player_consciousness');

  // --- CAMERA DIRECTOR LOGIC ---
  useEffect(() => {
      if (!setCameraTarget || !playerNode) return;

      const state = gameState.projection.playerState;
      let targetScale = 1.0;
      let targetX = -playerNode.x * targetScale;
      let targetY = -playerNode.y * targetScale;

      // Dynamic Zoom based on gameplay state
      if (state === 'AIMING_DIRECTION') {
          // Zoom out to see the battlefield
          targetScale = 0.7;
          targetX = -playerNode.x * targetScale;
          targetY = -playerNode.y * targetScale;
      } else if (state === 'AIMING_POWER') {
          // Tight focus on player for power timing
          targetScale = 1.8;
          targetX = -playerNode.x * targetScale;
          targetY = -playerNode.y * targetScale;
      } else if (state === 'PROJECTING') {
          // Speed-based Zoom
          const speed = Math.hypot(playerNode.vx, playerNode.vy);
          targetScale = Math.max(0.6, 1.2 - (speed / 30)); // Faster = Zoom out more
          
          // Look Ahead: Pan slightly in front of the player
          const lookAheadX = playerNode.vx * 15;
          const lookAheadY = playerNode.vy * 15;
          
          targetX = -(playerNode.x + lookAheadX) * targetScale;
          targetY = -(playerNode.y + lookAheadY) * targetScale;
      } else {
          // Idle state
          targetScale = 1.2;
          targetX = -playerNode.x * targetScale;
          targetY = -playerNode.y * targetScale;
      }
      
      setCameraTarget(targetX, targetY, targetScale);

  }, [gameState.projection.playerState, playerNode?.x, playerNode?.y, playerNode?.vx, playerNode?.vy, setCameraTarget]);


  const handleNodeClick = (nodeId: string) => {
    dispatch({ type: 'SELECT_NODE', payload: { nodeId } });
  };
  
  const handlePlayerInteraction = (e: React.MouseEvent) => {
    switch (gameState.projection.playerState) {
        case 'IDLE':
            dispatch({ type: 'START_AIMING' });
            break;
        case 'AIMING_DIRECTION':
            dispatch({ type: 'SET_DIRECTION' });
            break;
        case 'AIMING_POWER':
            dispatch({ type: 'LAUNCH_PLAYER' });
            break;
        default:
            break;
    }
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isPanningRef.current) {
        if(gameState.projection.playerState === 'IDLE' && gameState.selectedNodeId) {
             dispatch({ type: 'SELECT_NODE', payload: { nodeId: null } });
        } else {
             handlePlayerInteraction(e);
        }
    }
  };

  const selectedNode = gameState.nodes.find(n => n.id === gameState.selectedNodeId);
  const worldRadius = (Math.min(width, height) * 1.5) / (gameState.zoomLevel + 1);
  const lockedOnTarget = gameState.nodes.find(n => n.id === gameState.aimAssistTargetId);
  
  let aimAngle = gameState.projection.aimAngle;
  if (playerNode && lockedOnTarget) {
      aimAngle = Math.atan2(lockedOnTarget.y - playerNode.y, lockedOnTarget.x - playerNode.x);
  }

  // Calculate SVG arc for Power Meter
  const powerRadius = 40;
  const circumference = 2 * Math.PI * powerRadius;
  const powerOffset = circumference - (gameState.projection.power / 100) * circumference;
  const powerColor = gameState.projection.power > 90 ? '#ff0055' : gameState.projection.power > 50 ? '#ffd700' : '#00f3ff';

  return (
    <div
      className="simulation-container"
      onWheel={worldScaleHandlers.handleWheel}
      onMouseDown={worldScaleHandlers.handleMouseDown}
      onMouseUp={worldScaleHandlers.handleMouseUp}
      onMouseMove={worldScaleHandlers.handleMouseMove}
      onMouseLeave={worldScaleHandlers.handleMouseUp}
      onClick={handleContainerClick}
      style={{ cursor: isPanningRef.current ? 'grabbing' : 'crosshair' }}
    >
      <div
        className={`world-container ${isZoomingOut ? 'level-zoom-out' : ''}`}
        style={{
          transform: `translate(${width / 2}px, ${height / 2}px) translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`
        }}
      >
        <div 
            className="playable-area-boundary"
            style={{ width: `${worldRadius * 2}px`, height: `${worldRadius * 2}px`, left: '0', top: '0' }}
        />

        {/* Space Dust */}
        {gameState.spaceDust.map(d => (
            <div key={d.id} className="space-dust" style={{
                left: d.x, top: d.y,
                width: d.size, height: d.size,
                backgroundColor: d.color
            }} />
        ))}

        <svg className="connections-svg">
          {gameState.nodes.map(node =>
            node.connections.map(connId => {
              const target = gameState.nodes.find(n => n.id === connId);
              if (!target) return null;
              return (
                <line
                  key={`${node.id}-${connId}`}
                  className="connection-line"
                  x1={node.x}
                  y1={node.y}
                  x2={target.x}
                  y2={target.y}
                  stroke="rgba(100, 180, 255, 0.2)"
                  strokeWidth={2 / transform.scale}
                />
              );
            })
          )}
        </svg>

        {/* Shockwaves */}
        {gameState.shockwaves.map(wave => (
            <div key={wave.id} className="impact-shockwave" style={{
                left: wave.x, top: wave.y,
                width: wave.maxRadius * 2, height: wave.maxRadius * 2,
                opacity: 1 - wave.life,
                transform: `translate(-50%, -50%) scale(${wave.life})`
            }} />
        ))}

        {/* AIMING VISUALS */}
        {playerNode && gameState.projection.playerState === 'AIMING_DIRECTION' && (
             <div
                className={`aim-line-container ${lockedOnTarget ? 'locked' : ''}`}
                style={{
                    left: `${playerNode.x}px`, top: `${playerNode.y}px`,
                    transform: `rotate(${aimAngle}rad)`,
                }}
            >
                <div className="aim-line-laser" />
            </div>
        )}

        {/* POWER METER VISUALS */}
         {playerNode && gameState.projection.playerState === 'AIMING_POWER' && (
            <div className="power-arc-container" style={{ left: `${playerNode.x}px`, top: `${playerNode.y}px` }}>
                <svg width="100" height="100" viewBox="0 0 100 100">
                    {/* Background Ring */}
                    <circle cx="50" cy="50" r={powerRadius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                    {/* Active Ring */}
                    <circle
                        cx="50" cy="50" r={powerRadius}
                        fill="none"
                        stroke={powerColor}
                        strokeWidth="8"
                        strokeDasharray={circumference}
                        strokeDashoffset={powerOffset}
                        strokeLinecap="round"
                        className="power-arc"
                    />
                </svg>
            </div>
        )}

        {/* Projectile Trails */}
        {gameState.projectileTrailParticles.map(p => (
            <div key={p.id} className="projectile-trail-particle" style={{
                left: p.x, top: p.y,
                opacity: p.life / 20, 
                transform: `scale(${p.life / 20})`,
            }} />
        ))}

        {/* Visual Effects (Sparks/Flares) */}
        {gameState.visualEffects.map(effect => {
            if (effect.type === 'spark') {
                return (
                    <div key={effect.id} className="collection-flare" style={{
                        left: effect.x, top: effect.y,
                        height: `${8 * (effect.scale || 1)}px`,
                        transform: `rotate(${effect.angle || 0}rad)`,
                        backgroundColor: '#fff',
                        width: '2px', opacity: effect.life / 20
                    }} />
                );
            }
            if (effect.type === 'flare') {
                return (
                    <div key={effect.id} className="collection-bloom" style={{
                        left: effect.x, top: effect.y,
                        width: `${40 * (effect.scale || 1)}px`, height: `${40 * (effect.scale || 1)}px`,
                        opacity: effect.life / 30,
                        backgroundColor: '#fde047'
                    }} />
                );
            }
            return null;
        })}

        {/* Cosmic Events (Supernova, etc) - Keep existing structure */}
        {gameState.cosmicEvents.map(event => {
            if (event.type === 'supernova' && event.phase === 'active') {
                const baseSize = event.radius * 2;
                return (
                    <div key={event.id} className="supernova-container" style={{ left: `${event.x}px`, top: `${event.y}px`, width: `${baseSize}px`, height: `${baseSize}px` }}>
                        <div className="supernova-flash" style={{ inset: 0 }} />
                        <div className="supernova-shockwave" style={{ inset: 0 }} />
                        <div className="supernova-nebula" style={{ inset: 0 }} />
                    </div>
                );
            }
            if (event.type === 'gravitational_anomaly') {
                return <div key={event.id} className="anomaly-vortex" style={{ left: `${event.x}px`, top: `${event.y}px`, width: `${event.radius * 2}px`, height: `${event.radius * 2}px` }} />;
            }
            if (event.type === 'black_hole') {
                 return (
                     <div key={event.id} style={{ left: `${event.x}px`, top: `${event.y}px`, pointerEvents: 'none' }}>
                         <div className="black-hole-core" style={{ width: `${event.radius * 2}px`, height: `${event.radius * 2}px` }} />
                         <div className="black-hole-accretion-disk" style={{ width: `${event.radius * 4}px`, height: `${event.radius * 4}px` }} />
                     </div>
                 );
            }
            return null;
        })}

        {/* Energy Orbs */}
        {gameState.energyOrbs.map(orb => (
            <div key={orb.id} className={`energy-orb ${orb.isFromBloom ? 'bloom-orb' : ''}`} style={{ left: `${orb.x}px`, top: `${orb.y}px`, width: `${orb.radius * 2}px`, height: `${orb.radius * 2}px` }} />
        ))}

        {/* Satellites */}
        {playerNode && gameState.satellites.map(sat => {
            const x = playerNode.x + Math.cos(sat.angle) * sat.orbitRadius;
            const y = playerNode.y + Math.sin(sat.angle) * sat.orbitRadius;
            return (
                <div key={sat.id} className="node-container satellite" style={{ left: `${x}px`, top: `${y}px`, width: '20px', height: '20px' }}>
                    <div className={`node-image ${sat.type}`} style={sat.imageUrl ? { backgroundImage: `url(${sat.imageUrl})` } : {}} />
                </div>
            );
        })}

        {/* Render Game Nodes */}
        {gameState.nodes.map(node => {
            const isPlayer = node.type === 'player_consciousness';
            const blackHoles = gameState.cosmicEvents.filter(e => e.type === 'black_hole');
            let warpingClassName = '';
            // ... (keep warping logic)

            const otherClasses = [
                node.id === gameState.aimAssistTargetId ? 'aim-assist-target' : '',
                node.type,
                node.id === gameState.selectedNodeId ? 'selected' : '',
            ].join(' ');
            
            return (
                <div
                    key={node.id}
                    data-node-id={node.id}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (isPlayer) handlePlayerInteraction(e);
                        else handleNodeClick(node.id);
                    }}
                    className={`node-container ${otherClasses} ${warpingClassName}`}
                    style={{
                        left: `${node.x}px`, top: `${node.y}px`,
                        width: `${node.radius * 2}px`, height: `${node.radius * 2}px`,
                        cursor: 'pointer',
                        zIndex: isPlayer ? 100 : 1,
                    } as React.CSSProperties}
                >
                 {isPlayer ? (
                     <div className="player-core-container">
                         <div className="player-core" />
                         <div className="player-ring-inner" />
                         <div className="player-ring-outer" />
                         {gameState.projection.playerState === 'PROJECTING' && (
                             <div className="player-trail" style={{ transform: `rotate(${Math.atan2(node.vy, node.vx)}rad)` }} />
                         )}
                     </div>
                 ) : (
                     node.imageUrl ? (
                        <div className={`node-image ${node.type} ${node.hasLife ? 'hasLife' : ''}`} style={{ backgroundImage: `url(${node.imageUrl})`}} />
                     ) : (
                        <div className={`node-image ${node.type} ${node.hasLife ? 'hasLife' : ''}`} />
                     )
                 )}
                </div>
            )
        })}
        
        {gameState.floatingTexts.map(ft => (
            <div key={ft.id} className="floating-text" style={{ left: ft.x, top: ft.y, color: ft.color, opacity: ft.life / 60 }}>
                {ft.text}
            </div>
        ))}
        
        {gameState.loreState.nodeId && (
            <LoreTooltip gameState={gameState} onClose={() => dispatch({ type: 'CLEAR_LORE' })} />
        )}
      </div>
    </div>
  );
};

export default Simulation;
