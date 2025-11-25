
import React, { useState, useRef, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import { audio } from './audio';

enum GameStage {
  MENU,
  PLAYING,
  GAME_OVER
}

const App: React.FC = () => {
  const [stage, setStage] = useState<GameStage>(GameStage.MENU);
  const [playerName, setPlayerName] = useState('');
  const [finalScore, setFinalScore] = useState(0);

  // We use a ref for actions to avoid re-rendering the GameCanvas constantly for button presses
  const actionRef = useRef({ split: false, eject: false });

  const handleStart = () => {
    if (playerName.trim().length > 0) {
      audio.init(); // Unlock Audio Context
      setStage(GameStage.PLAYING);
    }
  };

  const handleGameOver = (score: number) => {
    setFinalScore(score);
    setStage(GameStage.GAME_OVER);
  };

  const handleRestart = () => {
    setStage(GameStage.MENU);
  };

  // Keyboard controls for Actions (Movement is handled in GameCanvas)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (stage !== GameStage.PLAYING) return;
      
      // D key to Split
      if (e.code === 'KeyD') {
        actionRef.current.split = true;
      } 
      // A key to Eject (Spit energy)
      else if (e.code === 'KeyA') {
        actionRef.current.eject = true;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stage]);

  // Mobile/UI Button handlers
  const triggerSplit = () => { actionRef.current.split = true; };
  const triggerEject = () => { actionRef.current.eject = true; };

  return (
    <div className="relative w-full h-screen bg-gray-900 overflow-hidden font-sans">
      
      {/* Game Layer */}
      <GameCanvas 
        playerName={playerName} 
        gameStarted={stage === GameStage.PLAYING} 
        onGameOver={handleGameOver}
        actionRef={actionRef}
      />

      {/* Main Menu Overlay */}
      {stage === GameStage.MENU && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50">
          <div className="bg-white/10 p-8 rounded-2xl border border-white/20 shadow-2xl backdrop-blur-md max-w-md w-full text-center">
            <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-500 mb-6 tracking-tight">
              EVOLUTION.IO
            </h1>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Enter Nickname"
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-400 transition-all text-center text-lg"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                maxLength={12}
              />
              <button
                onClick={handleStart}
                disabled={!playerName.trim()}
                className="w-full px-6 py-3 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-white font-bold rounded-lg shadow-lg transform transition hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                PLAY NOW
              </button>
            </div>
            
            <div className="mt-8 text-xs text-gray-400 border-t border-white/10 pt-4 grid grid-cols-2 gap-4 text-left">
              <div>
                <span className="block font-bold text-teal-400">Controls:</span>
                Arrow Keys to Move
              </div>
              <div className="text-right">
                <span className="block text-white">D - Split</span>
                <span className="block text-white">A - Eject Mass</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {stage === GameStage.GAME_OVER && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900/40 backdrop-blur-md z-50">
          <div className="text-center p-8">
            <h2 className="text-6xl font-black text-white mb-4 drop-shadow-lg">WASTED</h2>
            <p className="text-2xl text-white/80 mb-8">Final Mass: <span className="text-teal-400 font-bold">{finalScore}</span></p>
            <button
              onClick={handleRestart}
              className="px-8 py-3 bg-white text-red-900 font-bold rounded-full text-xl hover:bg-gray-200 transition shadow-xl"
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* In-Game Touch Controls (Visible mostly on mobile, but helpful visual aid) */}
      {stage === GameStage.PLAYING && (
        <div className="absolute bottom-8 right-8 z-40 flex gap-4">
          <button 
            className="w-16 h-16 rounded-full bg-blue-500/50 border-2 border-blue-400 text-white font-bold backdrop-blur-sm active:bg-blue-600/80 flex items-center justify-center shadow-lg transition-transform active:scale-95"
            onClick={triggerSplit}
          >
            D
          </button>
          <button 
            className="w-16 h-16 rounded-full bg-teal-500/50 border-2 border-teal-400 text-white font-bold backdrop-blur-sm active:bg-teal-600/80 flex items-center justify-center shadow-lg transition-transform active:scale-95"
            onClick={triggerEject}
          >
            A
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
