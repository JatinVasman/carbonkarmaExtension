import browser from 'webextension-polyfill';
import config from '../config/config';

class AnalyticsService {
    constructor() {
        this.CACHE_KEY = 'analytics_queue';
        this.MAX_RETRY_ATTEMPTS = 3;
        this.RETRY_DELAY = 5000; // 5 seconds
        this.initQueue();
    }

    async initQueue() {
        try {
            const { [this.CACHE_KEY]: queue = [] } = await browser.storage.local.get(this.CACHE_KEY);
            this.queue = queue;
            this.processQueue();
        } catch (error) {
            console.error('Failed to initialize analytics queue:', error);
            this.queue = [];
        }
    }

    async trackEvent(eventName, eventData = {}) {
        const event = {
            id: crypto.randomUUID(),
            name: eventName,
            data: eventData,
            timestamp: new Date().toISOString(),
            retryCount: 0
        };

        // Add to queue
        this.queue.push(event);
        await this.saveQueue();
        this.processQueue();
    }

    async trackPageView(url, duration) {
        await this.trackEvent('page_view', {
            url,
            duration,
            carbonIntensity: await this.getCurrentCarbonIntensity()
        });
    }

    async trackSuggestionInteraction(suggestionId, action) {
        await this.trackEvent('suggestion_interaction', {
            suggestionId,
            action,
            timestamp: new Date().toISOString()
        });
    }

    async trackCarbonSaving(amount, source) {
        await this.trackEvent('carbon_saving', {
            amount,
            source,
            timestamp: new Date().toISOString()
        });
    }

    async trackFeatureUsage(featureName, data = {}) {
        await this.trackEvent('feature_usage', {
            feature: featureName,
            ...data
        });
    }

    async trackError(error, context = {}) {
        await this.trackEvent('error', {
            message: error.message,
            stack: error.stack,
            context,
            timestamp: new Date().toISOString()
        });
    }

    async getCurrentCarbonIntensity() {
        try {
            const { electricityMap_cache: cache = {} } = await browser.storage.local.get('electricityMap_cache');
            const currentZone = await this.getCurrentZone();
            const zoneData = cache[`intensity-${currentZone}`];
            return zoneData?.data?.carbonIntensity || null;
        } catch (error) {
            console.error('Failed to get current carbon intensity:', error);
            return null;
        }
    }

    async getCurrentZone() {
        try {
            const { settings = {} } = await browser.storage.local.get('settings');
            return settings.selectedRegion || 'unknown';
        } catch (error) {
            console.error('Failed to get current zone:', error);
            return 'unknown';
        }
    }

    async processQueue() {
        if (!navigator.onLine) {
            return; // Will retry when online
        }

        while (this.queue.length > 0) {
            const event = this.queue[0];

            try {
                await this.sendEvent(event);
                this.queue.shift(); // Remove sent event
                await this.saveQueue();
            } catch (error) {
                if (event.retryCount >= this.MAX_RETRY_ATTEMPTS) {
                    this.queue.shift(); // Remove failed event
                    await this.saveQueue();
                    console.error('Failed to send event after max retries:', event);
                } else {
                    event.retryCount++;
                    await this.saveQueue();
                    await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
                }
            }
        }
    }

    async sendEvent(event) {
        const response = await fetch(config.ANALYTICS_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.ANALYTICS_API_KEY}`
            },
            body: JSON.stringify(event)
        });

        if (!response.ok) {
            throw new Error(`Failed to send event: ${response.statusText}`);
        }
    }

    async saveQueue() {
        try {
            await browser.storage.local.set({ [this.CACHE_KEY]: this.queue });
        } catch (error) {
            console.error('Failed to save analytics queue:', error);
        }
    }
}

// Initialize analytics service
const analyticsService = new AnalyticsService();

// Add online/offline handlers
window.addEventListener('online', () => {
    analyticsService.processQueue();
});

export default analyticsService;
