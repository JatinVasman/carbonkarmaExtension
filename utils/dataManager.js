class DataManager {
    constructor() {
        this.db = null;
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;

        // Initialize IndexedDB
        const request = indexedDB.open('CarbonKarma', 1);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Create stores if they don't exist
            if (!db.objectStoreNames.contains('emissions')) {
                db.createObjectStore('emissions', { keyPath: 'date' });
            }
            if (!db.objectStoreNames.contains('streaks')) {
                db.createObjectStore('streaks', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('achievements')) {
                db.createObjectStore('achievements', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('stats')) {
                db.createObjectStore('stats', { keyPath: 'id' });
            }
        };

        return new Promise((resolve, reject) => {
            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.initialized = true;
                resolve();
            };
            request.onerror = (event) => {
                reject('Database error: ' + event.target.error);
            };
        });
    }

    // Emissions
    async addEmission(date, value) {
        const store = this.db.transaction('emissions', 'readwrite').objectStore('emissions');
        await store.put({ date, value });
    }

    async getEmissionsForDate(date) {
        const store = this.db.transaction('emissions', 'readonly').objectStore('emissions');
        return new Promise((resolve) => {
            const request = store.get(date);
            request.onsuccess = () => resolve(request.result ? request.result.value : 0);
        });
    }

    async getEmissionsHistory(days = 30) {
        const store = this.db.transaction('emissions', 'readonly').objectStore('emissions');
        return new Promise((resolve) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const emissions = request.result || [];
                // Sort by date and take last N days
                emissions.sort((a, b) => new Date(a.date) - new Date(b.date));
                resolve(emissions.slice(-days));
            };
        });
    }

    // Streaks
    async updateStreak(streak) {
        const store = this.db.transaction('streaks', 'readwrite').objectStore('streaks');
        await store.put({ id: 'current', ...streak });
    }

    async getCurrentStreak() {
        const store = this.db.transaction('streaks', 'readonly').objectStore('streaks');
        return new Promise((resolve) => {
            const request = store.get('current');
            request.onsuccess = () => resolve(request.result || null);
        });
    }

    // Achievements
    async addAchievement(achievement) {
        const store = this.db.transaction('achievements', 'readwrite').objectStore('achievements');
        await store.put(achievement);
    }

    async getAchievements() {
        const store = this.db.transaction('achievements', 'readonly').objectStore('achievements');
        return new Promise((resolve) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
        });
    }

    // Stats
    async updateStats(stats) {
        const store = this.db.transaction('stats', 'readwrite').objectStore('stats');
        await store.put({ id: 'global', ...stats });
    }

    async getStats() {
        const store = this.db.transaction('stats', 'readonly').objectStore('stats');
        return new Promise((resolve) => {
            const request = store.get('global');
            request.onsuccess = () => resolve(request.result || {
                totalEmissions: 0,
                totalSaved: 0,
                bestStreak: 0,
                achievementsCount: 0
            });
        });
    }

    // Helper method to clear a store
    async clearStore(storeName) {
        const store = this.db.transaction(storeName, 'readwrite').objectStore(storeName);
        return new Promise((resolve) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
        });
    }

    // Reset all data
    async resetData() {
        await this.init();
        await this.clearStore('emissions');
        await this.clearStore('streaks');
        await this.clearStore('achievements');
        await this.clearStore('stats');
    }
}

// Create and export singleton instance
const dataManager = new DataManager();
export default dataManager;
