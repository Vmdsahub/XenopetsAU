import React, { useState, useRef, useEffect } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { MapPoint } from "./MapPoint";
import { PlayerShip } from "./PlayerShip";
import { playBarrierCollisionSound } from "../../utils/soundManager";
import { useGameStore } from "../../store/gameStore";

interface GalaxyMapProps {
  onPointClick: (pointId: string, pointData: any) => void;
}

interface MapPointData {
  id: string;
  x: number;
  y: number;
  name: string;
  type: "planet" | "station" | "nebula" | "asteroid";
  description: string;
  image?: string;
}

const mapPoints: MapPointData[] = [
  {
    id: "terra-nova",
    x: 20,
    y: 30,
    name: "Terra Nova",
    type: "planet",
    description: "Um planeta verdejante cheio de vida",
    image:
      "https://images.pexels.com/photos/87651/earth-blue-planet-globe-planet-87651.jpeg",
  },
  {
    id: "estacao-omega",
    x: 60,
    y: 20,
    name: "Estação Omega",
    type: "station",
    description: "Uma estação espacial comercial movimentada",
    image:
      "https://images.pexels.com/photos/586063/pexels-photo-586063.jpeg",
  },
  {
    id: "nebulosa-crimson",
    x: 80,
    y: 70,
    name: "Nebulosa Crimson",
    type: "nebula",
    description: "Uma nebulosa misteriosa com energia estranha",
    image:
      "https://images.pexels.com/photos/1169754/pexels-photo-1169754.jpeg",
  },
  {
    id: "campo-asteroides",
    x: 40,
    y: 80,
    name: "Campo de Asteroides",
    type: "asteroid",
    description: "Uma região perigosa cheia de rochas espaciais",
    image:
      "https://images.pexels.com/photos/73873/asteroid-meteorite-space-rock-73873.jpeg",
  },
];

const BOUNDARY_MARGIN = 50;
const COLLISION_THRESHOLD = 25;

export const GalaxyMap: React.FC<GalaxyMapProps> = ({ onPointClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDecelerating, setIsDecelerating] = useState(false);
  const [nearbyPoint, setNearbyPoint] = useState<string | null>(null);

  // Get ship position from store
  const { shipPosition, setShipPosition } = useGameStore();

  // Initialize motion values with stored position
  const x = useMotionValue(shipPosition.x);
  const y = useMotionValue(shipPosition.y);

  // Update motion values when stored position changes
  useEffect(() => {
    x.set(shipPosition.x);
    y.set(shipPosition.y);
  }, [shipPosition.x, shipPosition.y, x, y]);

  // Create rotation transform - fixed to avoid circular dependency
  const rotation = useTransform([x, y], ([currentX, currentY]) => {
    // Simple rotation based on movement direction
    const deltaX = currentX - shipPosition.x;
    const deltaY = currentY - shipPosition.y;
    
    if (Math.abs(deltaX) > 0.1 || Math.abs(deltaY) > 0.1) {
      return Math.atan2(deltaY, deltaX) * (180 / Math.PI) + 90;
    }
    
    return 0;
  });

  const checkBoundaries = (newX: number, newY: number) => {
    if (!containerRef.current) return { x: newX, y: newY };

    const container = containerRef.current.getBoundingClientRect();
    const shipSize = 40;

    const minX = -container.width / 2 + BOUNDARY_MARGIN + shipSize / 2;
    const maxX = container.width / 2 - BOUNDARY_MARGIN - shipSize / 2;
    const minY = -container.height / 2 + BOUNDARY_MARGIN + shipSize / 2;
    const maxY = container.height / 2 - BOUNDARY_MARGIN - shipSize / 2;

    let constrainedX = Math.max(minX, Math.min(maxX, newX));
    let constrainedY = Math.max(minY, Math.min(maxY, newY));

    if (newX !== constrainedX || newY !== constrainedY) {
      playBarrierCollisionSound().catch(() => {});
    }

    return { x: constrainedX, y: constrainedY };
  };

  const checkNearbyPoints = (shipX: number, shipY: number) => {
    if (!containerRef.current) return;

    const container = containerRef.current.getBoundingClientRect();
    const centerX = container.width / 2;
    const centerY = container.height / 2;

    let closestPoint: string | null = null;
    let minDistance = Infinity;

    mapPoints.forEach((point) => {
      const pointX = (point.x / 100) * container.width - centerX;
      const pointY = (point.y / 100) * container.height - centerY;

      const distance = Math.sqrt(
        Math.pow(shipX - pointX, 2) + Math.pow(shipY - pointY, 2),
      );

      if (distance < COLLISION_THRESHOLD && distance < minDistance) {
        minDistance = distance;
        closestPoint = point.id;
      }
    });

    setNearbyPoint(closestPoint);
  };

  const handleDragStart = () => {
    setIsDragging(true);
    setIsDecelerating(false);
  };

  const handleDrag = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const currentX = x.get();
    const currentY = y.get();
    const newX = currentX + info.delta.x;
    const newY = currentY + info.delta.y;

    const constrained = checkBoundaries(newX, newY);
    x.set(constrained.x);
    y.set(constrained.y);

    checkNearbyPoints(constrained.x, constrained.y);
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);

    const velocity = Math.sqrt(info.velocity.x ** 2 + info.velocity.y ** 2);
    if (velocity > 100) {
      setIsDecelerating(true);
      setTimeout(() => setIsDecelerating(false), 1000);
    }

    // Save position to store when drag ends
    const finalX = x.get();
    const finalY = y.get();
    setShipPosition({ x: finalX, y: finalY });
  };

  const handlePointClick = (point: MapPointData) => {
    // Save current position before navigating
    const currentX = x.get();
    const currentY = y.get();
    setShipPosition({ x: currentX, y: currentY });
    
    onPointClick(point.id, point);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-96 bg-gradient-to-br from-indigo-900 via-purple-900 to-black overflow-hidden rounded-2xl"
      style={{
        backgroundImage: `
          radial-gradient(white, rgba(255,255,255,.2) 2px, transparent 2px),
          radial-gradient(white, rgba(255,255,255,.15) 1px, transparent 1px),
          radial-gradient(white, rgba(255,255,255,.1) 1px, transparent 1px)
        `,
        backgroundSize: "550px 550px, 350px 350px, 250px 250px",
        backgroundPosition: "0 0, 40px 60px, 130px 270px",
      }}
    >
      {/* Map Points */}
      {mapPoints.map((point, index) => (
        <MapPoint
          key={point.id}
          point={point}
          isNearby={nearbyPoint === point.id}
          onClick={() => handlePointClick(point)}
          isDragging={isDragging}
          style={{
            left: `${point.x}%`,
            top: `${point.y}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}

      {/* Player Ship */}
      <motion.div
        className="absolute"
        style={{
          x,
          y,
          left: "50%",
          top: "50%",
        }}
        drag
        dragMomentum={true}
        dragElastic={0.1}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        whileDrag={{ scale: 1.1 }}
      >
        <PlayerShip
          rotation={rotation}
          isNearPoint={!!nearbyPoint}
          isDragging={isDragging}
          isDecelerating={isDecelerating}
        />
      </motion.div>

      {/* Boundary Indicators */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute border-2 border-red-500/30 rounded-2xl"
          style={{
            left: `${BOUNDARY_MARGIN}px`,
            top: `${BOUNDARY_MARGIN}px`,
            right: `${BOUNDARY_MARGIN}px`,
            bottom: `${BOUNDARY_MARGIN}px`,
          }}
        />
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 text-white/70 text-sm">
        <p>🚀 Arraste para mover a nave</p>
        {nearbyPoint && (
          <p className="text-yellow-300 font-medium">
            ✨ Clique no ponto próximo para explorar
          </p>
        )}
      </div>
    </div>
  );
};