// Configuration management for the extension
const config = {
    // API Keys
    geminiApiKey: process.env.GEMINI_API_KEY,
    electricityMapApiKey: process.env.ELECTRICITY_MAP_API_KEY,
    
    // API Endpoints
    electricityMapApiUrl: process.env.ELECTRICITY_MAP_API_URL || 'https://api.electricitymap.org/v3',
    
    // Default values
    defaultEmissionPerPage: 1.76, // g CO2 per page view
    
    // Update intervals
    carbonIntensityUpdateInterval: 15 * 60 * 1000, // 15 minutes
    
    // Feature flags
    enableRealTimeIntensity: true,
    enableAISuggestions: true,
    
    // Electricity Map specific settings
    defaultZone: 'IN-KL', // Default zone (Kerala, India) - can be changed based on user's location
    emissionTypes: {
        carbonIntensity: 'carbonIntensity', // gCO2eq/kWh
        fossilFuelPercentage: 'fossilFuelPercentage'
    }
};

export default config;
