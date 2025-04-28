// Emissions calculation utility
const EMISSIONS_FACTORS = {
    // Base factors (gCO2/minute)
    BASE_BROWSING: 0.2,          // Regular browsing
    VIDEO_480P: 0.3,             // SD video streaming
    VIDEO_720P: 0.5,             // HD video streaming
    VIDEO_1080P: 0.7,            // Full HD video streaming
    VIDEO_4K: 1.2,               // 4K video streaming
    
    // Site-specific factors
    YOUTUBE_MULTIPLIER: 1.2,     // YouTube's CDN and processing
    NETFLIX_MULTIPLIER: 1.3,     // Netflix's higher bitrate
};

/**
 * Calculate carbon emissions for a browsing session
 * @param {Object} params
 * @param {string} params.domain - Website domain
 * @param {number} params.duration - Duration in minutes
 * @param {string} [params.resolution] - Video resolution if applicable
 * @returns {number} - CO2 emissions in grams
 */
export function calculateEmissions({ domain, duration, resolution }) {
    let baseFactor = EMISSIONS_FACTORS.BASE_BROWSING;
    let multiplier = 1;

    // Determine if it's a video streaming site
    if (domain.includes('youtube.com')) {
        multiplier = EMISSIONS_FACTORS.YOUTUBE_MULTIPLIER;
        baseFactor = getVideoEmissionFactor(resolution);
    } else if (domain.includes('netflix.com')) {
        multiplier = EMISSIONS_FACTORS.NETFLIX_MULTIPLIER;
        baseFactor = getVideoEmissionFactor(resolution);
    }

    return baseFactor * multiplier * duration;
}

/**
 * Get emission factor based on video resolution
 * @param {string} resolution 
 * @returns {number}
 */
function getVideoEmissionFactor(resolution) {
    switch(resolution?.toLowerCase()) {
        case '4k':
        case '2160p':
            return EMISSIONS_FACTORS.VIDEO_4K;
        case '1080p':
        case 'fullhd':
            return EMISSIONS_FACTORS.VIDEO_1080P;
        case '720p':
        case 'hd':
            return EMISSIONS_FACTORS.VIDEO_720P;
        case '480p':
        case 'sd':
            return EMISSIONS_FACTORS.VIDEO_480P;
        default:
            return EMISSIONS_FACTORS.VIDEO_720P; // Default to HD
    }
}

/**
 * Format emissions for display
 * @param {number} grams - Emissions in grams
 * @returns {string}
 */
export function formatEmissions(grams) {
    if (grams >= 1000) {
        return `${(grams / 1000).toFixed(2)} kg CO₂`;
    }
    return `${Math.round(grams)} g CO₂`;
}
