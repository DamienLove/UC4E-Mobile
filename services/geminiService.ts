
import { GoogleGenAI } from "@google/genai";
import { GameNode, Chapter } from '../types';

const apiKey = process.env.API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  try {
    ai = new GoogleGenAI({ apiKey });
  } catch (error) {
    console.error("Failed to initialize GoogleGenAI:", error);
  }
} else {
  console.warn("API_KEY environment variable not set. Gemini features will be unavailable.");
}

export const getGeminiFlavorText = async (concept: string): Promise<string> => {
  if (!ai) return '"The archives are silent on this matter..."';
  try {
    const prompt = `Create a short, poetic, and evocative flavor text for a concept in a cosmic evolution game. The concept is "${concept.replace(/_/g, ' ')}". The text should be a single sentence, enclosed in double quotes, and feel profound, like a line from a science fiction novel.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: prompt,
      config: {
        systemInstruction: "You are a creative writer for a video game, specializing in cryptic and beautiful flavor text.",
        temperature: 0.8,
        topP: 0.9,
        maxOutputTokens: 60, 
      },
    });

    const flavorText = response.text;
    if (!flavorText) return '"The universal archives on this topic are mysteriously empty."';
    const trimmedText = flavorText.trim();
    if (trimmedText.startsWith('"') && trimmedText.endsWith('"')) return trimmedText;
    return `"${trimmedText}"`;

  } catch (error) {
    console.error(`Error fetching flavor text for "${concept}":`, error);
    return '"The cosmos is not a collection of isolated objects but a vast and intricate web of interconnectedness."';
  }
};


export const getGeminiLoreForNode = async (node: GameNode, chapter: Chapter): Promise<string> => {
    if (!ai) return "The connection is weak... The future is clouded.";
    try {
        const nodeDescription = `${node.label} (${node.type.replace(/_/g, ' ')})`;
        const prompt = `You are the Universal Consciousness. A player is observing: ${nodeDescription}. Chapter: "${chapter.name}". Provide a short, profound, and slightly cryptic observation.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                systemInstruction: "You are the narrator of a profound cosmic simulation game, speaking with wisdom and a touch of mystery.",
                temperature: 0.9,
                maxOutputTokens: 80,
            }
        });
        
        return response.text?.trim() || "The connection is weak... The future is clouded.";

    } catch (error) {
        console.error(`Error fetching lore for "${node.label}":`, error);
        return "The connection is weak... The future is clouded.";
    }
};

export const generateNodeImage = async (prompt: string): Promise<string | null> => {
    if (!ai) return null;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: {
                parts: [{ text: prompt }]
            },
            config: {
                imageConfig: {
                    aspectRatio: "1:1",
                    imageSize: "1K"
                }
            },
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
        return null;
    } catch (error) {
        console.error("Error generating node image:", error);
        return null;
    }
};

export const generateMilestoneVideo = async (prompt: string): Promise<string | null> => {
  if (!ai) return null;
  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: `Cinematic, photorealistic video of: ${prompt}. Slow motion, epic lighting, 4k resolution feel.`,
      config: {
        numberOfVideos: 1,
        resolution: '1080p',
        aspectRatio: '16:9'
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({operation: operation});
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (videoUri) {
        return `${videoUri}&key=${apiKey}`;
    }
    return null;
  } catch (error) {
    console.error("Video generation failed:", error);
    return null;
  }
};
