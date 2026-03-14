/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { Sparkles, X, Image as ImageIcon, Zap, Volume2, VolumeX } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

// --- Types ---
declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

type AspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "9:16" | "16:9" | "21:9";
type FaceState = 'NORMAL' | 'HURT' | 'EXCITED' | 'HAPPY' | 'DISAPPOINTED';

interface Position {
  x: number;
  y: number;
}

interface Velocity {
  dx: number;
  dy: number;
}

// --- Constants ---
const FACE_SIZE = 80;
const SPEED = 4;
const EXCITEMENT_ZONE = 150; // Distance to corner to trigger EXCITED
const YIPPEE_SOUND_URL = "https://www.myinstants.com/media/sounds/yippee-confetti.mp3";

const FACE_EMOJIS: Record<FaceState, string> = {
  NORMAL: '🙂',
  HURT: '🤕',
  EXCITED: '🤩',
  HAPPY: '🥰',
  DISAPPOINTED: '😞'
};

export default function App() {
  // --- State ---
  const [faceState, setFaceState] = useState<FaceState>('NORMAL');
  const [showGenerator, setShowGenerator] = useState(false);
  const [prompt, setPrompt] = useState("A cute confetti kid meme character shouting Yippee!");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // --- Refs ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const posRef = useRef<Position>({ x: 100, y: 100 });
  const velRef = useRef<Velocity>({ dx: SPEED, dy: SPEED });
  const stateRef = useRef<FaceState>('NORMAL');
  const stateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestRef = useRef<number>(null);

  // --- Helper: Set Temporary State ---
  const setTempState = (newState: FaceState, duration: number) => {
    if (stateTimerRef.current) clearTimeout(stateTimerRef.current);
    stateRef.current = newState;
    setFaceState(newState);
    stateTimerRef.current = setTimeout(() => {
      stateRef.current = 'NORMAL';
      setFaceState('NORMAL');
    }, duration);
  };

  // --- Animation Logic ---
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    let { x, y } = posRef.current;
    let { dx, dy } = velRef.current;

    let hitX = false;
    let hitY = false;

    // Boundary check X
    if (x + dx <= 0 || x + dx + FACE_SIZE >= width) {
      dx = -dx;
      hitX = true;
    }

    // Boundary check Y
    if (y + dy <= 0 || y + dy + FACE_SIZE >= height) {
      dy = -dy;
      hitY = true;
    }

    // Corner Distance Calculation (Pythagorean Theorem)
    const corners = [
      { x: 0, y: 0 },
      { x: width - FACE_SIZE, y: 0 },
      { x: 0, y: height - FACE_SIZE },
      { x: width - FACE_SIZE, y: height - FACE_SIZE }
    ];

    let minDistance = Infinity;
    corners.forEach(corner => {
      const dist = Math.sqrt(Math.pow(x - corner.x, 2) + Math.pow(y - corner.y, 2));
      if (dist < minDistance) minDistance = dist;
    });

    // State Machine Logic
    if (hitX && hitY) {
      // HAPPY (Perfect Corner)
      setTempState('HAPPY', 2000);
      triggerYippee();
    } else if (hitX || hitY) {
      if (minDistance < EXCITEMENT_ZONE) {
        // DISAPPOINTED (Hit wall in excitement zone but missed corner)
        setTempState('DISAPPOINTED', 1000);
      } else if (stateRef.current !== 'HAPPY' && stateRef.current !== 'DISAPPOINTED') {
        // HURT (Normal wall hit)
        setTempState('HURT', 500);
      }
    } else if (stateRef.current === 'NORMAL' || stateRef.current === 'EXCITED') {
      // Transition between NORMAL and EXCITED
      if (minDistance < EXCITEMENT_ZONE) {
        stateRef.current = 'EXCITED';
        setFaceState('EXCITED');
      } else {
        stateRef.current = 'NORMAL';
        setFaceState('NORMAL');
      }
    }

    x += dx;
    y += dy;

    posRef.current = { x, y };
    velRef.current = { dx, dy };

    // --- Draw ---
    ctx.clearRect(0, 0, width, height);

    // Draw Face
    ctx.save();
    ctx.translate(x + FACE_SIZE / 2, y + FACE_SIZE / 2);
    
    // Rotation/Flip based on direction
    const rotation = (dx * dy) * 0.05;
    ctx.rotate(rotation);
    if (dx < 0) ctx.scale(-1, 1);

    ctx.font = `${FACE_SIZE * 0.8}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Use generated image if available and in HAPPY state
    if (stateRef.current === 'HAPPY' && generatedImage) {
      // We'll draw the generated image in the center if it's happy
      // But for the bouncing face itself, let's stick to emojis for consistency
      // or maybe draw the image as the face? Let's draw the emoji.
      ctx.fillText(FACE_EMOJIS[stateRef.current], 0, 0);
    } else {
      ctx.fillText(FACE_EMOJIS[stateRef.current], 0, 0);
    }
    
    ctx.restore();

    requestRef.current = requestAnimationFrame(animate);
  }, [generatedImage]);

  const triggerYippee = () => {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 }
    });
    
    if (audioRef.current && !isMuted) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => {
        console.warn("Audio playback failed:", err);
      });
    }
  };

  // --- Resize Handler ---
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

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  useEffect(() => {
    const checkApiKey = async () => {
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(selected);
    };
    checkApiKey();
  }, []);

  const handleOpenKeySelector = async () => {
    await window.aistudio.openSelectKey();
    setHasApiKey(true);
  };

  const forceYippee = () => {
    // Instantly move near (0,0) corner
    posRef.current = { x: 10, y: 10 };
    // Set identical velocity to guarantee corner hit
    velRef.current = { dx: -SPEED, dy: -SPEED };
    stateRef.current = 'EXCITED';
    setFaceState('EXCITED');
  };

  // --- AI Image Generation ---
  const generateImage = async () => {
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: "1K"
          },
        },
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64EncodeString = part.inlineData.data;
          setGeneratedImage(`data:image/png;base64,${base64EncodeString}`);
          break;
        }
      }
    } catch (error) {
      console.error("Generation failed:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans">
      <audio ref={audioRef} src={YIPPEE_SOUND_URL} preload="auto" />

      <canvas
        ref={canvasRef}
        className="block w-full h-full"
      />

      {/* Yippee Overlay (Happy State) */}
      <AnimatePresence>
        {faceState === 'HAPPY' && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-50 pointer-events-none"
          >
            <div className="bg-white/10 backdrop-blur-md p-8 rounded-3xl border border-white/20 shadow-2xl flex flex-col items-center">
              {generatedImage ? (
                <img 
                  src={generatedImage} 
                  alt="Yippee!" 
                  className="w-64 h-64 object-cover rounded-2xl mb-4"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="text-8xl mb-4">🎉</div>
              )}
              <h1 className="text-white text-7xl font-black italic tracking-tighter drop-shadow-lg">
                YIPPEE!
              </h1>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* UI Controls */}
      <div className="absolute top-4 right-4 flex gap-2">
        <button
          onClick={() => setIsMuted(!isMuted)}
          className={`p-3 rounded-full backdrop-blur-md border transition-all active:scale-95 shadow-lg ${
            isMuted ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'bg-white/10 border-white/10 text-white hover:bg-white/20'
          }`}
          title={isMuted ? "Unmute Sound" : "Mute Sound"}
        >
          {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
        </button>
        <button
          onClick={forceYippee}
          className="flex items-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full backdrop-blur-md border border-emerald-400/30 transition-all active:scale-95 font-bold text-sm shadow-lg shadow-emerald-900/20"
          title="Force Yippee"
        >
          <Zap size={20} fill="currentColor" />
          Force Yippee
        </button>
        <button
          onClick={() => setShowGenerator(!showGenerator)}
          className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md border border-white/10 transition-all active:scale-95 shadow-lg"
          title="AI Image Generator"
        >
          <Sparkles size={24} />
        </button>
      </div>

      {/* AI Image Generator Panel */}
      <AnimatePresence>
        {showGenerator && (
          <motion.div
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            className="absolute top-0 right-0 h-full w-80 bg-zinc-900 border-l border-white/10 p-6 shadow-2xl z-40 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-white text-xl font-bold flex items-center gap-2">
                <ImageIcon size={20} /> AI Generator
              </h2>
              <button onClick={() => setShowGenerator(false)} className="text-zinc-500 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">Prompt</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-emerald-500/50 min-h-[100px]"
                  placeholder="Describe your Yippee image..."
                />
              </div>

              <div>
                <label className="block text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">Aspect Ratio</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"] as AspectRatio[]).map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      className={`py-2 text-xs rounded-lg border transition-all ${
                        aspectRatio === ratio
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                          : "bg-black border-white/10 text-zinc-500 hover:border-white/20"
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={hasApiKey ? generateImage : handleOpenKeySelector}
                disabled={isGenerating}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
              >
                {isGenerating ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>{hasApiKey ? "Generate Image" : "Select API Key to Generate"}</>
                )}
              </button>

              {generatedImage && (
                <div className="mt-8">
                  <label className="block text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">Result</label>
                  <img
                    src={generatedImage}
                    alt="Generated"
                    className="w-full rounded-xl border border-white/10 shadow-2xl"
                    referrerPolicy="no-referrer"
                  />
                  <p className="text-zinc-500 text-[10px] mt-2 italic text-center">
                    This image will be used for the Yippee! effect.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Indicator */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-1 pointer-events-none">
        <div className="text-zinc-600 text-[10px] uppercase tracking-widest">
          Bouncing Face • State Machine
        </div>
        <div className={`text-xs font-bold tracking-tighter transition-colors duration-300 ${
          faceState === 'HAPPY' ? 'text-emerald-400' :
          faceState === 'EXCITED' ? 'text-yellow-400' :
          faceState === 'HURT' ? 'text-red-400' :
          faceState === 'DISAPPOINTED' ? 'text-blue-400' : 'text-zinc-400'
        }`}>
          STATUS: {faceState} {isMuted ? '(MUTED)' : ''}
        </div>
      </div>
    </div>
  );
}
