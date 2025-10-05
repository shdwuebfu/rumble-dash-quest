import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Position {
  x: number;
  y: number;
}

interface Obstacle {
  id: number;
  x: number;
  y: number;
  lane: number;
}

const GAME_WIDTH = 400;
const GAME_HEIGHT = 600;
const BIKE_WIDTH = 40;
const BIKE_HEIGHT = 60;
const OBSTACLE_WIDTH = 40;
const OBSTACLE_HEIGHT = 60;
const LANES = [100, 180, 260];
const SPEED = 5;

export const Game = () => {
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [bikePosition, setBikePosition] = useState({ x: LANES[1], y: 500 });
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [currentLane, setCurrentLane] = useState(1);
  
  const gameLoopRef = useRef<number>();
  const obstacleIdRef = useRef(0);
  const scoreIntervalRef = useRef<number>();

  const moveBike = (direction: 'left' | 'right') => {
    if (!gameStarted || gameOver) return;
    
    setCurrentLane(prev => {
      if (direction === 'left' && prev > 0) {
        const newLane = prev - 1;
        setBikePosition({ x: LANES[newLane], y: 500 });
        return newLane;
      }
      if (direction === 'right' && prev < LANES.length - 1) {
        const newLane = prev + 1;
        setBikePosition({ x: LANES[newLane], y: 500 });
        return newLane;
      }
      return prev;
    });
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        moveBike('left');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        moveBike('right');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameStarted, gameOver]);

  const checkCollision = (bike: Position, obstacle: Obstacle): boolean => {
    return (
      bike.x < obstacle.x + OBSTACLE_WIDTH &&
      bike.x + BIKE_WIDTH > obstacle.x &&
      bike.y < obstacle.y + OBSTACLE_HEIGHT &&
      bike.y + BIKE_HEIGHT > obstacle.y
    );
  };

  const startGame = () => {
    setGameStarted(true);
    setGameOver(false);
    setScore(0);
    setObstacles([]);
    setBikePosition({ x: LANES[1], y: 500 });
    setCurrentLane(1);
    obstacleIdRef.current = 0;

    // Score increment
    scoreIntervalRef.current = window.setInterval(() => {
      setScore(prev => prev + 1);
    }, 100);

    // Game loop
    const gameLoop = () => {
      // Move obstacles
      setObstacles(prev => {
        const updated = prev
          .map(obs => ({ ...obs, y: obs.y + SPEED }))
          .filter(obs => obs.y < GAME_HEIGHT + 100);

        // Add new obstacles
        if (Math.random() < 0.02) {
          const lane = Math.floor(Math.random() * LANES.length);
          updated.push({
            id: obstacleIdRef.current++,
            x: LANES[lane],
            y: -OBSTACLE_HEIGHT,
            lane
          });
        }

        // Check collisions
        const bike = bikePosition;
        for (const obstacle of updated) {
          if (checkCollision(bike, obstacle)) {
            setGameOver(true);
            setGameStarted(false);
            if (scoreIntervalRef.current) clearInterval(scoreIntervalRef.current);
            return prev;
          }
        }

        return updated;
      });

      if (!gameOver) {
        gameLoopRef.current = requestAnimationFrame(gameLoop);
      }
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
      if (scoreIntervalRef.current) clearInterval(scoreIntervalRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-4">
      <div className="text-center space-y-2">
        <h1 className="text-6xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent animate-pulse">
          NEON RIDER
        </h1>
        <p className="text-muted-foreground text-lg">Usa las flechas ← → o A/D para moverte</p>
      </div>

      <Card className="relative overflow-hidden border-2 border-primary/50" 
            style={{ width: GAME_WIDTH, height: GAME_HEIGHT, background: 'linear-gradient(to bottom, hsl(240 20% 10%), hsl(240 20% 5%))' }}>
        
        {/* Road lanes */}
        <div className="absolute inset-0">
          <div className="absolute left-[133px] top-0 w-0.5 h-full bg-gradient-to-b from-transparent via-muted to-transparent opacity-50" />
          <div className="absolute left-[266px] top-0 w-0.5 h-full bg-gradient-to-b from-transparent via-muted to-transparent opacity-50" />
        </div>

        {/* Road animation lines */}
        <div className="absolute left-[66px] top-0 w-1 h-full overflow-hidden">
          <div className="road-line" />
        </div>
        <div className="absolute left-[200px] top-0 w-1 h-full overflow-hidden">
          <div className="road-line" />
        </div>
        <div className="absolute left-[333px] top-0 w-1 h-full overflow-hidden">
          <div className="road-line" />
        </div>

        {/* Bike */}
        {gameStarted && (
          <div
            className="absolute transition-all duration-200 ease-out"
            style={{
              left: bikePosition.x,
              top: bikePosition.y,
              width: BIKE_WIDTH,
              height: BIKE_HEIGHT,
            }}
          >
            <div className="w-full h-full bg-gradient-to-b from-primary to-primary/60 rounded-lg shadow-[0_0_20px_hsl(var(--primary))]">
              <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-2 h-2 bg-secondary rounded-full shadow-[0_0_10px_hsl(var(--secondary))]" />
              <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-2 h-2 bg-secondary rounded-full shadow-[0_0_10px_hsl(var(--secondary))]" />
            </div>
          </div>
        )}

        {/* Obstacles */}
        {obstacles.map(obstacle => (
          <div
            key={obstacle.id}
            className="absolute"
            style={{
              left: obstacle.x,
              top: obstacle.y,
              width: OBSTACLE_WIDTH,
              height: OBSTACLE_HEIGHT,
            }}
          >
            <div className="w-full h-full bg-gradient-to-b from-destructive to-destructive/60 rounded-lg shadow-[0_0_15px_hsl(var(--destructive))]" />
          </div>
        ))}

        {/* Score */}
        {gameStarted && (
          <div className="absolute top-4 right-4 text-2xl font-bold text-primary shadow-[0_0_10px_hsl(var(--primary))]">
            {score}
          </div>
        )}

        {/* Start/Game Over overlay */}
        {!gameStarted && (
          <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center">
            <div className="text-center space-y-4">
              {gameOver && (
                <div className="space-y-2">
                  <h2 className="text-4xl font-bold text-destructive animate-pulse">¡GAME OVER!</h2>
                  <p className="text-xl text-foreground">Puntuación: <span className="text-primary font-bold">{score}</span></p>
                </div>
              )}
              <Button 
                onClick={startGame}
                className="bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80 text-background font-bold text-xl px-8 py-6 shadow-[0_0_20px_hsl(var(--primary))] hover:shadow-[0_0_30px_hsl(var(--primary))] transition-all"
              >
                {gameOver ? 'REINTENTAR' : 'JUGAR'}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <style>{`
        @keyframes roadScroll {
          0% { transform: translateY(-40px); }
          100% { transform: translateY(0); }
        }
        .road-line {
          width: 4px;
          height: 40px;
          background: hsl(var(--muted));
          animation: roadScroll 0.5s linear infinite;
          box-shadow: 0 0 5px hsl(var(--muted));
        }
      `}</style>
    </div>
  );
};
