import browser from 'webextension-polyfill';
import electricityMapService from './electricityMapService';
import config from '../config/config';

class AIService {
    constructor() {
        this.CACHE_KEY = 'ai_suggestions_cache';
        this.CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
        this.analyticsEndpoint = config.analyticsEndpoint;
        this.initAnalytics();
    }

    async initAnalytics() {
        try {
            // Initialize analytics tracking
            await this.trackEvent('ai_service_init', {
                version: browser.runtime.getManifest().version,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Analytics initialization failed:', error);
        }
    }

    async getSuggestions(userStats) {
        try {
            // Check cache first
            const cachedSuggestions = await this.getCachedSuggestions();
            if (cachedSuggestions && !this.isCacheExpired(cachedSuggestions.timestamp)) {
                await this.trackEvent('suggestions_served_from_cache');
                return cachedSuggestions.data;
            }

            // Get local carbon intensity
            const carbonIntensity = await this.getLocalCarbonIntensity();

            // Generate personalized suggestions
            const suggestions = await this.generateSuggestions(userStats, carbonIntensity);
            
            // Cache the suggestions with timestamp
            await this.cacheSuggestions({
                data: suggestions,
                timestamp: Date.now()
            });

            await this.trackEvent('new_suggestions_generated', {
                suggestionCount: suggestions.length,
                carbonIntensity
            });
            
            return suggestions;
        } catch (error) {
            console.error('Error getting AI suggestions:', error);
            await this.trackEvent('suggestions_error', { error: error.message });
            return this.getFallbackSuggestions();
        }
    }

    async generateSuggestions(userStats, carbonIntensity) {
        const { dailyEmissions, weeklyTrend, mostVisitedSites, activeHours, browserSettings } = userStats;
        
        const suggestions = [];

        // Real-time carbon intensity based suggestions
        if (carbonIntensity > 400) { // High carbon intensity
            suggestions.push({
                type: 'urgent',
                message: 'High grid carbon intensity! Consider postponing non-essential browsing',
                impact: 'critical',
                actionable: true,
                action: {
                    type: 'SCHEDULE_LATER',
                    params: { delayHours: 2 }
                }
            });
        }

        // Analyze browsing patterns
        const highEmissionSites = mostVisitedSites.filter(site => site.emissions > 100);
        if (highEmissionSites.length > 0) {
            suggestions.push({
                type: 'optimization',
                message: `Consider using lightweight alternatives for: ${highEmissionSites.map(s => s.domain).join(', ')}`,
                impact: 'high',
                actionable: true,
                action: {
                    type: 'SHOW_ALTERNATIVES',
                    params: { sites: highEmissionSites }
                }
            });
        }

        // Analyze active hours vs grid intensity
        const peakHours = activeHours.filter(hour => hour.intensity > 350);
        if (peakHours.length > 0) {
            suggestions.push({
                type: 'scheduling',
                message: 'Your peak browsing hours coincide with high grid carbon intensity',
                impact: 'medium',
                actionable: true,
                action: {
                    type: 'SUGGEST_SCHEDULE',
                    params: { currentHours: peakHours }
                }
            });
        }

        // Browser settings optimization
        if (!browserSettings.darkMode) {
            suggestions.push({
                type: 'settings',
                message: 'Enable dark mode to reduce screen energy consumption',
                impact: 'low',
                actionable: true,
                action: {
                    type: 'ENABLE_DARK_MODE'
                }
            });
        }

        // Analyze video consumption
        if (mostVisitedSites.some(site => site.domain.includes('video') || site.domain.includes('stream'))) {
            suggestions.push({
                type: 'video',
                message: 'Consider watching videos in lower quality to save energy',
                impact: 'high',
                actionable: true,
                action: {
                    type: 'SUGGEST_VIDEO_QUALITY',
                    params: { quality: '720p' }
                }
            });
        }

        // Check for resource-intensive tabs
        if (mostVisitedSites.length > 20) {
            suggestions.push({
                type: 'maintenance',
                message: 'Large number of tabs may be consuming extra resources',
                impact: 'medium',
                actionable: true,
                action: {
                    type: 'SUGGEST_TAB_CLEANUP',
                    params: { threshold: 20 }
                }
            });
        }

        return suggestions;
    }

    async getLocalCarbonIntensity() {
        try {
            // Get user's location from browser
            const position = await this.getUserLocation();
            if (!position) return null;

            // Get zone based on coordinates
            const zone = await this.getZoneFromCoordinates(position.coords);
            if (!zone) return null;

            // Get carbon intensity from Electricity Map
            const intensity = await electricityMapService.getCarbonIntensity(zone);
            return intensity.carbonIntensity;

        } catch (error) {
            console.error('Error getting local carbon intensity:', error);
            return null;
        }
    }

    async getUserLocation() {
        try {
            const permission = await browser.permissions.request({ permissions: ['geolocation'] });
            if (!permission) return null;

            return new Promise((resolve) => {
                navigator.geolocation.getCurrentPosition(resolve, () => resolve(null));
            });
        } catch (error) {
            console.error('Error getting user location:', error);
            return null;
        }
    }

    async getZoneFromCoordinates(coords) {
        try {
            const response = await fetch(`${config.geocodingApiUrl}?lat=${coords.latitude}&lon=${coords.longitude}`);
            const data = await response.json();
            return data.zone || 'IN-NO'; // Default to North India if zone not found
        } catch (error) {
            console.error('Error getting zone from coordinates:', error);
            return 'IN-NO';
        }
    }

    async getCachedSuggestions() {
        try {
            const cache = await browser.storage.local.get(this.CACHE_KEY);
            return cache[this.CACHE_KEY];
        } catch (error) {
            console.error('Error reading cache:', error);
            return null;
        }
    }

    isCacheExpired(timestamp) {
        return Date.now() - timestamp > this.CACHE_DURATION;
    }

    async cacheSuggestions(suggestions) {
        try {
            await browser.storage.local.set({
                [this.CACHE_KEY]: suggestions
            });
        } catch (error) {
            console.error('Error caching suggestions:', error);
        }
    }

    getFallbackSuggestions() {
        return [
            {
                type: 'general',
                message: 'Use browser bookmarks to reduce repeated searches',
                impact: 'medium',
                actionable: false
            },
            {
                type: 'general',
                message: 'Close inactive tabs to save resources',
                impact: 'medium',
                actionable: false
            },
            {
                type: 'general',
                message: 'Bookmark frequently visited sites instead of keeping tabs open',
                impact: 'low',
                actionable: false
            }
        ];
    }

    async trackEvent(eventName, eventData = {}) {
        try {
            if (!this.analyticsEndpoint) return;

            const payload = {
                event: eventName,
                timestamp: new Date().toISOString(),
                extensionVersion: browser.runtime.getManifest().version,
                ...eventData
            };

            await fetch(this.analyticsEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
        } catch (error) {
            console.error('Error tracking event:', error);
        }
    }
}

const aiService = new AIService();
export default aiService;
