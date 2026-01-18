
import React, { useEffect, useState } from 'react';
import { generateMilestoneVideo } from '../services/geminiService';

interface MilestoneVisualProps {
  milestoneId: string;
  imageUrl?: string;
  onComplete: () => void;
}

const MILESTONE_PROMPTS: { [key: string]: string } = {
  basic_physics: "Abstract representation of the laws of physics, glowing mathematical formulas floating in a nebula.",
  star_formation: "A massive star igniting for the first time, shockwaves of light and gas expanding.",
  planetary_accretion: "Molten rocks colliding and fusing to form a glowing planetoid in space.",
  eukaryotic_evolution: "Microscopic view of cells merging and evolving into complex life forms, glowing bioluminescence.",
  collective_intelligence: "A planet covered in a neural network of glowing light, pulse of a global mind.",
  quantum_computing: "A futuristic quantum computer core, floating in void, glowing with cyan and magenta qubits.",
  quantum_tunneling: "A spaceship distorting space and disappearing into a wormhole, warp drive effect.",
  the_great_zoom_out: "The universe zooming out to reveal it is a network of neurons.",
  spark_of_life: "A spark of lightning hitting a primordial soup, creating glowing DNA strands.",
  panspermia: "Comets carrying glowing seeds of life crashing into a barren planet.",
};

const MilestoneVisual: React.FC<MilestoneVisualProps> = ({ milestoneId, imageUrl, onComplete }) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusText, setStatusText] = useState("Initializing Simulation...");

  useEffect(() => {
    let isMounted = true;
    const loadVideo = async () => {
        const prompt = MILESTONE_PROMPTS[milestoneId];
        if (prompt) {
            setStatusText("Generating Cinematic Visualization (Veo)...");
            const url = await generateMilestoneVideo(prompt);
            if (isMounted && url) {
                setVideoUrl(url);
                setIsLoading(false);
                return;
            }
        }
        // Fallback or if generation failed/took too long
        if (isMounted) setIsLoading(false);
    };

    loadVideo();

    return () => { isMounted = false; };
  }, [milestoneId]);

  return (
    <div className="milestone-container flex flex-col items-center justify-center bg-black/95 text-white z-[200]">
      {isLoading ? (
          <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-cyan-300 font-mono animate-pulse">{statusText}</p>
              <button className="text-gray-500 text-sm hover:text-white mt-4" onClick={onComplete}>Skip Generation</button>
          </div>
      ) : videoUrl ? (
          <div className="relative w-full h-full flex items-center justify-center bg-black">
              <video 
                src={videoUrl} 
                autoPlay 
                onEnded={onComplete} 
                className="max-w-full max-h-full object-contain"
                controls={false}
              />
              <button className="absolute bottom-8 right-8 neon-button px-6 py-2 rounded" onClick={onComplete}>Continue</button>
          </div>
      ) : (
          // Fallback visual if video fails
          <div className="text-center animate-fade-in-slow">
              <h1 className="text-4xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 mb-4 font-['Orbitron']">
                  EVOLUTION ACHIEVED
              </h1>
              {imageUrl && <img src={imageUrl} className="w-64 h-64 rounded-full mx-auto my-8 border-4 border-white/10 shadow-[0_0_50px_rgba(0,243,255,0.3)] object-cover" />}
              <button className="neon-button primary px-8 py-3 rounded text-xl" onClick={onComplete}>Proceed</button>
          </div>
      )}
    </div>
  );
};

export default MilestoneVisual;
