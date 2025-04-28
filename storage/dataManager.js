// Cross-browser storage manager using webextension-polyfill
const browser = window.browser || window.chrome;

class DataManager {
    static KEY_PREFIX = 'carbonkarma_';
    static KEYS = {
        DAILY_EMISSIONS: 'daily_emissions',
        STREAK: 'streak',
        BADGES: 'badges',
        SUGGESTIONS: 'suggestions',
        SETTINGS: 'settings'
    };

    /**
     * Save data to browser storage
     * @param {string} key 
     * @param {any} value 
     */
    static async save(key, value) {
        const storageKey = this.KEY_PREFIX + key;
        await browser.storage.local.set({ [storageKey]: value });
    }

    /**
     * Get data from browser storage
     * @param {string} key 
     * @returns {Promise<any>}
     */
    static async get(key) {
        const storageKey = this.KEY_PREFIX + key;
        const result = await browser.storage.local.get(storageKey);
        return result[storageKey];
    }

    /**
     * Update daily emissions
     * @param {number} grams 
     */
    static async updateDailyEmissions(grams) {
        const today = new Date().toISOString().split('T')[0];
        const emissions = await this.get(this.KEYS.DAILY_EMISSIONS) || {};
        
        emissions[today] = (emissions[today] || 0) + grams;
        await this.save(this.KEYS.DAILY_EMISSIONS, emissions);
        
        // Update streak if under daily target
        if (emissions[today] < 1000) { // Less than 1kg CO2
            await this.incrementStreak();
        } else {
            await this.resetStreak();
        }
    }

    /**
     * Get emissions for a specific date
     * @param {string} date - ISO date string
     */
    static async getEmissionsForDate(date) {
        const emissions = await this.get(this.KEYS.DAILY_EMISSIONS) || {};
        return emissions[date] || 0;
    }

    /**
     * Increment user's eco-streak
     */
    static async incrementStreak() {
        const streak = (await this.get(this.KEYS.STREAK) || 0) + 1;
        await this.save(this.KEYS.STREAK, streak);
        return streak;
    }

    /**
     * Reset user's eco-streak
     */
    static async resetStreak() {
        await this.save(this.KEYS.STREAK, 0);
    }

    /**
     * Save AI suggestion
     * @param {string} suggestion 
     */
    static async saveSuggestion(suggestion) {
        const suggestions = await this.get(this.KEYS.SUGGESTIONS) || [];
        suggestions.unshift(suggestion);
        // Keep last 10 suggestions
        suggestions.splice(10);
        await this.save(this.KEYS.SUGGESTIONS, suggestions);
    }

    /**
     * Get recent AI suggestions
     * @returns {Promise<string[]>}
     */
    static async getRecentSuggestions() {
        return await this.get(this.KEYS.SUGGESTIONS) || [];
    }

    /**
     * Save earned badge
     * @param {Object} badge 
     */
    static async saveBadge(badge) {
        const badges = await this.get(this.KEYS.BADGES) || [];
        if (!badges.some(b => b.id === badge.id)) {
            badges.push(badge);
            await this.save(this.KEYS.BADGES, badges);
        }
    }
}

export default DataManager;
