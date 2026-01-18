
import { NodeType } from '../types';

const BASE_STYLE = "8k resolution, photorealistic, cinematic lighting, ultra-detailed, depth of field, cosmic scale, view from deep space, national geographic space photography style.";

export const getNodeImagePrompt = (nodeType: NodeType): string => {
    switch (nodeType) {
        case 'player_consciousness':
            return `A hyper-realistic core of a nascent universal consciousness. A swirling vortex of pure psionic energy and liquid starlight, pure thought given form. A beautiful, impossibly intricate fractal of cyan and magenta light, casting long shadows against the void. ${BASE_STYLE}`;
        case 'star':
            return `A magnificent, hyper-realistic main sequence star, glowing with blinding yellow and orange plasma. Coronal loops arcing into space, solar flares erupting, dynamic surface granulation visible. ${BASE_STYLE}`;
        case 'rocky_planet':
            return `A barren, photorealistic exoplanet. The surface is textured with massive impact craters, jagged mountain ranges, and deep canyons. The lighting is harsh, casting long shadows across the dusty, rust-colored terrain. ${BASE_STYLE}`;
        case 'life_seed':
            return `A primordial exoplanet teeming with early life. Swirling clouds cover vast oceans that glow with bioluminescent algae. Continents are covered in strange, alien mosses and ferns. A sense of vibrant, untamed growth. ${BASE_STYLE}`;
        case 'sentient_colony':
            return `A planet transformed by a high-tech civilization. From orbit, you see glowing geometric megastructures, orbital rings, and city lights spanning continents. The planet pulses with a soft, intelligent purple energy. ${BASE_STYLE}`;
        default:
            return `A mysterious cosmic anomaly, shimmering with unknown energy in deep space. ${BASE_STYLE}`;
    }
}
