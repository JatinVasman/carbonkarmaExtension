import browser from 'webextension-polyfill';
import config from '../config/config';

class ElectricityMapError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'ElectricityMapError';
        this.code = code;
    }
}

class ElectricityMapService {
    constructor() {
        this.apiKey = config.electricityMapApiKey;
        this.baseUrl = config.electricityMapApiUrl;
        this.CACHE_KEY = 'electricity_map_cache';
        this.CACHE_DURATION = {
            INTENSITY: 15 * 60 * 1000, // 15 minutes
            FORECAST: 60 * 60 * 1000,  // 1 hour
            HISTORY: 24 * 60 * 60 * 1000 // 24 hours
        };
        this.initCache();
    }

    async initCache() {
        try {
            const cache = await browser.storage.local.get(this.CACHE_KEY);
            this.cache = cache[this.CACHE_KEY] || {};
        } catch (error) {
            console.error('Failed to initialize cache:', error);
            this.cache = {};
        }
    }

    async getCarbonIntensity(zone = 'IN-NO', options = {}) {
        const { skipCache = false, timeout = 5000 } = options;

        // Check cache first unless skipCache is true
        if (!skipCache) {
            const cachedData = await this.getCachedData('intensity', zone);
            if (cachedData) return cachedData;
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(`${this.baseUrl}/carbon-intensity/latest?zone=${zone}`, {
                method: 'GET',
                headers: {
                    'auth-token': this.apiKey,
                    'Accept': 'application/json'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new ElectricityMapError(
                    `Failed to fetch carbon intensity: ${response.statusText}`,
                    response.status
                );
            }

            const data = await response.json();
            
            // Validate response data
            if (!this.validateIntensityData(data)) {
                throw new ElectricityMapError('Invalid data format', 'INVALID_FORMAT');
            }

            // Cache the validated data
            await this.cacheData('intensity', zone, data);

            return data;

        } catch (error) {
            if (error.name === 'AbortError') {
                throw new ElectricityMapError('Request timed out', 'TIMEOUT');
            }
            // Return cached data as fallback if available
            const cachedData = await this.getCachedData('intensity', zone);
            if (cachedData) {
                console.warn('Using cached data due to API error:', error);
                return cachedData;
            }
            throw error;
        }
    }

    async getFossilFuelPercentage(zone = 'IN-NO') {
        try {
            const data = await this.getCarbonIntensity(zone);
            if (!data.fossilFuelPercentage && data.powerBreakdown) {
                // Calculate from power breakdown if direct percentage not available
                return this.calculateFossilFuelPercentage(data.powerBreakdown);
            }
            return data.fossilFuelPercentage || null;
        } catch (error) {
            console.error('Error getting fossil fuel percentage:', error);
            return null;
        }
    }

    async getCarbonForecast(zone = 'IN-NO', hours = 24) {
        try {
            const cachedData = await this.getCachedData('forecast', zone);
            if (cachedData) return cachedData;

            const response = await fetch(
                `${this.baseUrl}/carbon-intensity/forecast?zone=${zone}&hours=${hours}`,
                {
                    method: 'GET',
                    headers: {
                        'auth-token': this.apiKey
                    }
                }
            );

            if (!response.ok) {
                throw new ElectricityMapError(
                    `Failed to fetch forecast: ${response.statusText}`,
                    response.status
                );
            }

            const data = await response.json();
            await this.cacheData('forecast', zone, data);
            return data;

        } catch (error) {
            console.error('Error fetching carbon forecast:', error);
            throw error;
        }
    }

    validateIntensityData(data) {
        return (
            data &&
            typeof data === 'object' &&
            typeof data.carbonIntensity === 'number' &&
            data.zone &&
            data.datetime
        );
    }

    calculateFossilFuelPercentage(powerBreakdown) {
        const fossilSources = ['coal', 'gas', 'oil'];
        const fossilTotal = fossilSources.reduce(
            (sum, source) => sum + (powerBreakdown[source] || 0),
            0
        );
        const total = Object.values(powerBreakdown).reduce((sum, value) => sum + value, 0);
        return total > 0 ? (fossilTotal / total) * 100 : null;
    }

    async getCachedData(type, zone) {
        const key = `${type}-${zone}`;
        const cachedItem = this.cache[key];

        if (
            cachedItem &&
            Date.now() - cachedItem.timestamp < this.CACHE_DURATION[type.toUpperCase()]
        ) {
            return cachedItem.data;
        }

        return null;
    }

    async cacheData(type, zone, data) {
        const key = `${type}-${zone}`;
        this.cache[key] = {
            data,
            timestamp: Date.now()
        };

        try {
            await browser.storage.local.set({
                [this.CACHE_KEY]: this.cache
            });
        } catch (error) {
            console.error('Failed to persist cache:', error);
        }
    }

    async clearCache() {
        this.cache = {};
        try {
            await browser.storage.local.remove(this.CACHE_KEY);
        } catch (error) {
            console.error('Failed to clear cache:', error);
        }
    }
}


const electricityMapService = new ElectricityMapService();
export default electricityMapService;
