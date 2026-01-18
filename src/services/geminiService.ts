
import { GoogleGenAI } from "@google/genai";
import { GameNode, Chapter } from '../types';

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API_KEY environment variable not set. Gemini features will be unavailable.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

const handleApiError = async (error: any) => {
    const msg = (error.toString() || '').toLowerCase();
    const isPermissionError = msg.includes('403') || msg.includes('permission_denied');
    const isNotFoundError = msg.includes('requested entity was not found') || msg.includes('404');
    
    if (isPermissionError || isNotFoundError) {
        console.warn("API Key permission issue or not found. Prompting user to re-select key.");
        const aistudio = (window as any).aistudio;
        if (aistudio && aistudio.openSelectKey) {
            await aistudio.openSelectKey();
        }
    }
};

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 5000;

// Generic retry wrapper
async function retryWithBackoff<T>(operation: () => Promise<T>, fallbackValue: T | null = null): Promise<T | null> {
    let retries = 0;
    while (retries < MAX_RETRIES) {
        try {
            return await operation();
        } catch (error: any) {
            const errorMessage = (error.toString() || '').toLowerCase();
            const isRateLimit = errorMessage.includes('429') || errorMessage.includes('resource_exhausted');
            
            if (isRateLimit) {
                retries++;
                if (retries >= MAX_RETRIES) {
                    console.warn(`Max retries reached for operation. Error: ${errorMessage}`);
                    break;
                }
                const delay = INITIAL_BACKOFF_MS * Math.pow(2, retries - 1);
                console.warn(`Quota hit (429). Retrying in ${delay/1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                await handleApiError(error);
                console.error("Gemini API Error:", error);
                return fallbackValue;
            }
        }
    }
    return fallbackValue;
}

export const getGeminiFlavorText = async (concept: string): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return '"The archives are silent on this matter..."';

  return (await retryWithBackoff(async () => {
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
  }, '"The cosmos is not a collection of isolated objects but a vast and intricate web of interconnectedness."'))!;
};


export const getGeminiLoreForNode = async (node: GameNode, chapter: Chapter): Promise<string> => {
    const ai = getAiClient();
    if (!ai) return "The connection is weak... The future is clouded.";

    return (await retryWithBackoff(async () => {
        const nodeDescription = `${node.label} (${node.type.replace(/_/g, ' ')})`;
        const prompt = `You are the Universal Consciousness. A player is observing: ${nodeDescription}. Chapter: "${chapter.name}". Provide a short (under 50 words), profound, and slightly cryptic observation about this object's deeper role in the cosmos.`;

        // Using gemini-3-pro-preview with thinking mode for complex creative reasoning
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: 32768 },
                systemInstruction: "You are the narrator of a profound cosmic simulation game, speaking with wisdom and a touch of mystery.",
                temperature: 0.9,
                // maxOutputTokens must not be set when using thinkingConfig
            }
        });
        
        return response.text?.trim() || "The connection is weak... The future is clouded.";
    }, "The connection is weak... The future is clouded."))!;
};

export const generateNodeImage = async (prompt: string): Promise<string | null> => {
    const ai = getAiClient();
    if (!ai) return null;
    
    return retryWithBackoff(async () => {
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
    });
};

export const generateMilestoneVideo = async (prompt: string): Promise<string | null> => {
  const ai = getAiClient();
  const apiKey = process.env.API_KEY; // Needed for the URL suffix
  if (!ai || !apiKey) return null;
  
  return retryWithBackoff(async () => {
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
  });
};
