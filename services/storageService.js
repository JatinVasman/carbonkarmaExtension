import browser from 'webextension-polyfill';
import CompressionService from './compressionService';

class StorageError extends Error {
    constructor(message) {
        super(message);
        this.name = 'StorageError';
    }
}

class StorageService {
    static COMPRESSION_THRESHOLD = 1024; // 1KB
    static CACHE_DURATION = 3600000; // 1 hour
    static MAX_HISTORY_DAYS = 30;
    static MAX_CACHE_SIZE = 1000; // items
    static CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
    static BATCH_SIZE = 100; // items per batch for bulk operations
    static CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    static cache = new Map();
    static cacheTimestamps = new Map();

    static defaultData = {
        stats: {
            totalEmissions: 0,
            pagesVisited: 0,
            emissionsSaved: 0,
            impactScore: 0,
            lastUpdate: Date.now()
        },
        dailyStats: {},
        streak: {
            current: 0,
            longest: 0,
            lastActive: null
        },
        badges: [],
        settings: {
            dailyGoal: 1000,
            selectedRegion: 'IN-NO',
            notifications: true,
            theme: 'light'
        },
        history: [],
        version: 1
    };

    constructor() {
        // Constants for data management
        this.MAX_HISTORY_DAYS = 30;
        this.MAX_CACHE_SIZE = 1000; // items
        this.CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
        this.BATCH_SIZE = 100; // items per batch for bulk operations

        // Memory cache for frequently accessed data
        this.cache = new Map();
        this.cacheTimestamps = new Map();
        this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes

        this.defaultData = {
            stats: {
                totalEmissions: 0,        // in grams CO2
                pagesVisited: 0,
                emissionsSaved: 0,
                impactScore: 0,
                lastUpdate: Date.now()
            },
            dailyStats: {},              // keyed by date YYYY-MM-DD
            streak: {
                current: 0,
                longest: 0,
                lastActive: null
            },
            badges: [],
            settings: {
                dailyGoal: 1000,         // in grams CO2
                selectedRegion: 'IN-NO',
                notifications: true,
                theme: 'light'
            },
            history: [],                 // limited to last 30 days
            version: 1                   // For data schema versioning
        };

        // Start periodic cleanup
        setInterval(() => this.cleanupOldData(), this.CLEANUP_INTERVAL);
    }

    validateData(data) {
        if (!data || typeof data !== 'object') {
            throw new StorageError('Invalid data structure');
        }

        // Check required top-level properties
        const requiredProps = ['stats', 'dailyStats', 'streak', 'badges', 'settings', 'history'];
        for (const prop of requiredProps) {
            if (!(prop in data)) {
                throw new StorageError(`Missing required property: ${prop}`);
            }
        }

        // Validate stats structure
        const requiredStats = ['totalEmissions', 'pagesVisited', 'emissionsSaved', 'impactScore'];
        for (const stat of requiredStats) {
            if (typeof data.stats[stat] !== 'number') {
                throw new StorageError(`Invalid stats property: ${stat}`);
            }
        }

        return true;
    }

    async initialize() {
        try {
            const data = await this.getAllData();
            
            // Initialize with defaults if empty
            if (!data || Object.keys(data).length === 0) {
                await this.resetData();
                return;
            }

            // Validate existing data
            try {
                this.validateData(data);
            } catch (error) {
                console.warn('Invalid data structure found, resetting:', error);
                await this.resetData();
                return;
            }

            // Perform data cleanup
            await this.cleanupOldData();

            // Cache frequently accessed data
            this.cacheData('stats', data.stats);
            this.cacheData('settings', data.settings);

        } catch (error) {
            console.error('Failed to initialize storage:', error);
            throw new StorageError('Storage initialization failed');
        }
    }

    cacheData(key, data) {
        // Implement LRU cache - remove oldest items if cache is full
        if (this.cache.size >= this.MAX_CACHE_SIZE) {
            const oldestKey = Array.from(this.cacheTimestamps.keys())[0];
            this.cache.delete(oldestKey);
            this.cacheTimestamps.delete(oldestKey);
        }

        this.cache.set(key, data);
        this.cacheTimestamps.set(key, Date.now());
    }

    getCachedData(key) {
        const timestamp = this.cacheTimestamps.get(key);
        if (timestamp && Date.now() - timestamp < this.CACHE_TTL) {
            return this.cache.get(key);
        }
        return null;
    }

    async getAllData() {
        try {
            // Try cache first
            const cachedStats = this.getCachedData('stats');
            const cachedSettings = this.getCachedData('settings');

            if (cachedStats && cachedSettings) {
                return {
                    ...this.defaultData,
                    stats: cachedStats,
                    settings: cachedSettings
                };
            }

            // If not in cache, get from storage
            const result = await browser.storage.local.get(null);
            const data = result || this.defaultData;

            // Cache the results
            this.cacheData('stats', data.stats);
            this.cacheData('settings', data.settings);

            return data;

        } catch (error) {
            console.error('Error getting data:', error);
            throw new StorageError('Failed to retrieve data');
        }
    }

    async updateStats(newStats) {
        try {
            const data = await this.getAllData();
            const updatedStats = {
                ...data.stats,
                ...newStats,
                lastUpdate: Date.now()
            };

            // Validate numbers
            for (const [key, value] of Object.entries(updatedStats)) {
                if (typeof value === 'number' && !isFinite(value)) {
                    throw new StorageError(`Invalid numeric value for ${key}`);
                }
            }

            // Update storage
            await browser.storage.local.set({ stats: updatedStats });

            // Update cache
            this.cacheData('stats', updatedStats);

            return updatedStats;

        } catch (error) {
            console.error('Error updating stats:', error);
            throw new StorageError('Failed to update stats');
        }
    }

    async updateDailyStats(date, stats) {
        try {
            if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                throw new StorageError('Invalid date format');
            }

            // Validate stats object
            if (!stats || typeof stats !== 'object') {
                throw new StorageError('Invalid stats object');
            }

            const data = await this.getAllData();
            const dailyStats = data.dailyStats || {};

            // Merge with existing stats
            dailyStats[date] = {
                ...dailyStats[date],
                ...stats,
                lastUpdate: Date.now()
            };

            // Validate numeric values
            for (const [key, value] of Object.entries(dailyStats[date])) {
                if (typeof value === 'number' && !isFinite(value)) {
                    throw new StorageError(`Invalid numeric value for ${key}`);
                }
            }

            // Update storage in batches if needed
            const entries = Object.entries(dailyStats);
            if (entries.length > this.BATCH_SIZE) {
                const chunks = this.chunkArray(entries, this.BATCH_SIZE);
                for (const chunk of chunks) {
                    const batchUpdate = Object.fromEntries(chunk);
                    await browser.storage.local.set({ dailyStats: batchUpdate });
                }
            } else {
                await browser.storage.local.set({ dailyStats });
            }

            return dailyStats[date];

        } catch (error) {
            console.error('Error updating daily stats:', error);
            throw new StorageError('Failed to update daily stats');
        }
    }

    async updateStreak() {
        try {
            const data = await this.getAllData();
            const today = new Date().toISOString().split('T')[0];
            
            if (data.streak.lastActive === today) {
                return data.streak;
            }

            const streak = {
                ...data.streak,
                lastUpdate: Date.now()
            };

            if (data.streak.lastActive === this.getYesterday()) {
                streak.current++;
                if (streak.current > streak.longest) {
                    streak.longest = streak.current;
                }
            } else {
                streak.current = 1;
            }

            streak.lastActive = today;

            // Update storage and cache
            await browser.storage.local.set({ streak });
            this.cacheData('streak', streak);

            return streak;

        } catch (error) {
            console.error('Error updating streak:', error);
            throw new StorageError('Failed to update streak');
        }
    }

    async addBadge(badge) {
        try {
            if (!badge || !badge.id || typeof badge !== 'object') {
                throw new StorageError('Invalid badge object');
            }

            const data = await this.getAllData();
            const badges = data.badges || [];

            // Check for duplicates
            if (!badges.some(b => b.id === badge.id)) {
                badge.timestamp = Date.now();
                badges.push(badge);

                // Sort by timestamp
                badges.sort((a, b) => b.timestamp - a.timestamp);

                // Update storage
                await browser.storage.local.set({ badges });
                this.cacheData('badges', badges);
            }

            return badges;

        } catch (error) {
            console.error('Error adding badge:', error);
            throw new StorageError('Failed to add badge');
        }
    }

    async addToHistory(entry) {
        try {
            if (!entry || typeof entry !== 'object' || !entry.timestamp) {
                throw new StorageError('Invalid history entry');
            }

            const data = await this.getAllData();
            const history = data.history || [];

            // Add new entry at the beginning
            history.unshift({
                ...entry,
                timestamp: Date.now()
            });

            // Maintain history size limit
            if (history.length > this.MAX_HISTORY_DAYS) {
                history.length = this.MAX_HISTORY_DAYS;
            }

            // Update storage
            await browser.storage.local.set({ history });
            this.cacheData('history', history);

            return history;

        } catch (error) {
            console.error('Error adding to history:', error);
            throw new StorageError('Failed to add history entry');
        }
    }

    async resetData() {
        try {
            // Clear storage and cache
            await browser.storage.local.clear();
            this.cache.clear();
            this.cacheTimestamps.clear();

            // Set defaults
            const defaults = {
                ...this.defaultData,
                version: 1,
                resetTimestamp: Date.now()
            };

            await browser.storage.local.set(defaults);
            return defaults;

        } catch (error) {
            console.error('Error resetting data:', error);
            throw new StorageError('Failed to reset data');
        }
    }

    async cleanupOldData() {
        try {
            const data = await this.getAllData();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - this.MAX_HISTORY_DAYS);

            // Cleanup daily stats
            const dailyStats = {};
            Object.entries(data.dailyStats || {}).forEach(([date, stats]) => {
                if (new Date(date) >= thirtyDaysAgo) {
                    dailyStats[date] = stats;
                }
            });

            // Cleanup history
            const history = (data.history || []).filter(entry => 
                new Date(entry.timestamp) >= thirtyDaysAgo
            );

            // Batch update storage
            await browser.storage.local.set({
                dailyStats,
                history,
                lastCleanup: Date.now()
            });

            // Update cache
            this.cacheData('dailyStats', dailyStats);
            this.cacheData('history', history);

            return true;

        } catch (error) {
            console.error('Error cleaning up old data:', error);
            throw new StorageError('Failed to clean up old data');
        }
    }

    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    getYesterday() {
        const date = new Date();
        date.setDate(date.getDate() - 1);
        return date.toISOString().split('T')[0];
    }

    async exportData() {
        try {
            const data = await this.getAllData();
            const exportData = {
                ...data,
                exportDate: new Date().toISOString(),
                version: '1.0'
            };
            return JSON.stringify(exportData, null, 2);
        } catch (error) {
            console.error('Error exporting data:', error);
            throw new StorageError('Failed to export data: ' + error.message);
        }
    }

    async importData(jsonData) {
        try {
            let importedData;

            // Parse and validate input
            try {
                importedData = typeof jsonData === 'string' ? 
                    JSON.parse(jsonData) : jsonData;
            } catch (error) {
                throw new StorageError('Invalid JSON format');
            }

            // Validate backup structure
            if (!importedData.metadata || !importedData.data) {
                throw new StorageError('Invalid backup format');
            }

            // Check version compatibility
            if (importedData.metadata.version > 1) {
                throw new StorageError('Unsupported backup version');
            }

            // Validate data structure
            this.validateData(importedData.data);

            // Merge with defaults to ensure all required fields
            const mergedData = {
                ...this.defaultData,
                ...importedData.data,
                importTimestamp: Date.now()
            };

            // Clear existing data and cache
            await browser.storage.local.clear();
            this.cache.clear();
            this.cacheTimestamps.clear();

            // Import in batches if data is large
            const entries = Object.entries(mergedData);
            if (entries.length > this.BATCH_SIZE) {
                const chunks = this.chunkArray(entries, this.BATCH_SIZE);
                for (const chunk of chunks) {
                    const batchData = Object.fromEntries(chunk);
                    await browser.storage.local.set(batchData);
                }
            } else {
                await browser.storage.local.set(mergedData);
            }

            // Update cache with imported data
            this.cacheData('stats', mergedData.stats);
            this.cacheData('settings', mergedData.settings);

            return {
                success: true,
                timestamp: mergedData.importTimestamp,
                data: mergedData
            };

        } catch (error) {
            console.error('Error importing data:', error);
            throw new StorageError('Failed to import data: ' + error.message);
        }
    }

    async validateBackup(jsonData) {
        try {
            const data = typeof jsonData === 'string' ? 
                JSON.parse(jsonData) : jsonData;

            // Basic structure check
            if (!data.metadata || !data.data) {
                return {
                    valid: false,
                    error: 'Invalid backup format'
                };
            }

            // Version check
            if (data.metadata.version > 1) {
                return {
                    valid: false,
                    error: 'Unsupported backup version'
                };
            }

            // Data validation
            this.validateData(data.data);

            return {
                valid: true,
                metadata: data.metadata,
                stats: {
                    totalEmissions: data.data.stats.totalEmissions,
                    pagesVisited: data.data.stats.pagesVisited,
                    badges: data.data.badges.length
                }
            };

        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }

    validateData(data) {
        if (!data || typeof data !== 'object') {
            throw new StorageError('Invalid data structure');
        }

        // Check required top-level properties
        const requiredProps = ['stats', 'dailyStats', 'streak', 'badges', 'settings', 'history'];
        for (const prop of requiredProps) {
            if (!(prop in data)) {
                throw new StorageError(`Missing required property: ${prop}`);
            }
        }

        // Validate stats structure
        const requiredStats = ['totalEmissions', 'pagesVisited', 'emissionsSaved', 'impactScore'];
        for (const stat of requiredStats) {
            if (typeof data.stats[stat] !== 'number') {
                throw new StorageError(`Invalid stats property: ${stat}`);
            }
        }

        // Validate settings
        if (!data.settings || typeof data.settings !== 'object') {
            throw new StorageError('Invalid settings structure');
        }

        // Validate history entries
        if (!Array.isArray(data.history)) {
            throw new StorageError('Invalid history structure');
        }

        // Validate daily stats
        if (typeof data.dailyStats !== 'object') {
            throw new StorageError('Invalid daily stats structure');
        }

        return true;
    }
}

export default StorageService;
