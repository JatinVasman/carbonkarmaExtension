import browser from 'webextension-polyfill';
import analyticsService from './analyticsService';

class SyncService {
    constructor() {
        this.STATUS_MESSAGES = {
            SYNCING: 'Syncing changes...',
            SUCCESS: 'All changes saved',
            ERROR: 'Sync failed',
            OFFLINE: 'Working offline',
            CONFLICT: 'Resolving conflicts...',
            RETRY: 'Retrying sync...',
            INITIALIZING: 'Initializing sync...',
            MIGRATING: 'Migrating data...',
        };

        this.statusElement = null;
        this.statusIconElement = null;
        this.statusTextElement = null;
        this.retryButtonElement = null;

        this.SYNC_KEYS = {
            SETTINGS: 'settings',
            STATS: 'stats',
            SUGGESTIONS: 'suggestions',
            PREFERENCES: 'preferences'
        };

        this.setupSyncListeners();
    }

    initStatusElements() {
        this.statusElement = document.querySelector('.sync-status');
        this.statusIconElement = document.querySelector('.sync-icon');
        this.statusTextElement = document.querySelector('.sync-text');
        this.retryButtonElement = document.querySelector('.sync-retry');

        if (this.retryButtonElement) {
            this.retryButtonElement.addEventListener('click', () => this.handleRetry());
        }

        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
    }

    updateStatus(status, message = '') {
        if (!this.statusElement) {
            this.initStatusElements();
        }

        if (this.statusElement) {
            // Remove all status classes
            this.statusElement.classList.remove('syncing', 'success', 'error', 'offline');
            
            // Add new status class
            this.statusElement.classList.add(status);

            // Update message
            if (this.statusTextElement) {
                this.statusTextElement.textContent = message || this.STATUS_MESSAGES[status.toUpperCase()];
            }

            // Show/hide retry button
            if (this.retryButtonElement) {
                this.retryButtonElement.classList.toggle('hidden', status !== 'error');
            }

            // Show status
            this.statusElement.classList.remove('hidden');

            // Auto-hide success status after 3 seconds
            if (status === 'success') {
                setTimeout(() => {
                    this.statusElement.classList.add('hidden');
                }, 3000);
            }
        }
    }

    async handleRetry() {
        this.updateStatus('syncing', this.STATUS_MESSAGES.RETRY);
        try {
            await this.forceSync();
            this.updateStatus('success');
        } catch (error) {
            console.error('Retry sync failed:', error);
            this.updateStatus('error');
            analyticsService.trackError(error, { context: 'sync_retry' });
        }
    }

    async handleOnline() {
        this.updateStatus('syncing');
        try {
            await this.forceSync();
            this.updateStatus('success');
        } catch (error) {
            console.error('Online sync failed:', error);
            this.updateStatus('error');
            analyticsService.trackError(error, { context: 'online_sync' });
        }
    }

    handleOffline() {
        this.updateStatus('offline');
    }

    async setupSyncListeners() {
        // Listen for changes in sync storage
        browser.storage.onChanged.addListener((changes, areaName) => {
            if (areaName === 'sync') {
                this.handleSyncChanges(changes);
            }
        });

        // Initialize sync if not already done
        await this.initializeSync();
    }

    async initializeSync() {
        this.updateStatus('syncing', this.STATUS_MESSAGES.INITIALIZING);
        try {
            const { initialized } = await browser.storage.sync.get('initialized');
            if (!initialized) {
                // First time setup - migrate local data to sync
                await this.migrateLocalToSync();
                await browser.storage.sync.set({ initialized: true });
                analyticsService.trackEvent('sync_initialized');
            }
        } catch (error) {
            console.error('Failed to initialize sync:', error);
            analyticsService.trackError(error, { context: 'sync_initialization' });
        }
    }

    async migrateLocalToSync() {
        this.updateStatus('syncing', this.STATUS_MESSAGES.MIGRATING);
        try {
            // Get all local data
            const localData = await browser.storage.local.get(null);
            
            // Filter and prepare data for sync
            const syncData = this.prepareSyncData(localData);

            // Store in sync storage
            await browser.storage.sync.set(syncData);

            analyticsService.trackEvent('data_migrated_to_sync', {
                dataSize: JSON.stringify(syncData).length
            });
        } catch (error) {
            console.error('Failed to migrate data to sync:', error);
            analyticsService.trackError(error, { context: 'sync_migration' });
        }
    }

    prepareSyncData(localData) {
        const syncData = {};

        // Settings
        if (localData.settings) {
            syncData[this.SYNC_KEYS.SETTINGS] = {
                theme: localData.settings.theme,
                selectedRegion: localData.settings.selectedRegion,
                notifications: localData.settings.notifications,
                privacyPreferences: localData.settings.privacyPreferences
            };
        }

        // Stats (only aggregate data, not detailed history)
        if (localData.stats) {
            syncData[this.SYNC_KEYS.STATS] = {
                totalEmissions: localData.stats.totalEmissions,
                emissionsSaved: localData.stats.emissionsSaved,
                achievementsUnlocked: localData.stats.achievementsUnlocked
            };
        }

        // Active suggestions
        if (localData.suggestions) {
            syncData[this.SYNC_KEYS.SUGGESTIONS] = localData.suggestions.filter(s => !s.expired);
        }

        // User preferences
        if (localData.preferences) {
            syncData[this.SYNC_KEYS.PREFERENCES] = {
                customGoals: localData.preferences.customGoals,
                favoriteActions: localData.preferences.favoriteActions,
                dismissedTips: localData.preferences.dismissedTips
            };
        }

        return syncData;
    }

    async handleSyncChanges(changes) {
        try {
            const updates = {};

            // Process each changed key
            for (const [key, { newValue }] of Object.entries(changes)) {
                if (newValue) {
                    updates[key] = newValue;
                }
            }

            // Update local storage with synced changes
            if (Object.keys(updates).length > 0) {
                await browser.storage.local.set(updates);
                analyticsService.trackEvent('sync_data_updated', {
                    updatedKeys: Object.keys(updates)
                });
            }
        } catch (error) {
            console.error('Failed to handle sync changes:', error);
            analyticsService.trackError(error, { context: 'sync_update' });
        }
    }

    async syncSettings() {
        try {
            const { settings } = await browser.storage.local.get('settings');
            if (settings) {
                await browser.storage.sync.set({
                    [this.SYNC_KEYS.SETTINGS]: settings
                });
                analyticsService.trackEvent('settings_synced');
            }
        } catch (error) {
            console.error('Failed to sync settings:', error);
            analyticsService.trackError(error, { context: 'settings_sync' });
        }
    }

    async syncStats() {
        try {
            const { stats } = await browser.storage.local.get('stats');
            if (stats) {
                const syncedStats = {
                    totalEmissions: stats.totalEmissions,
                    emissionsSaved: stats.emissionsSaved,
                    achievementsUnlocked: stats.achievementsUnlocked
                };
                await browser.storage.sync.set({
                    [this.SYNC_KEYS.STATS]: syncedStats
                });
                analyticsService.trackEvent('stats_synced');
            }
        } catch (error) {
            console.error('Failed to sync stats:', error);
            analyticsService.trackError(error, { context: 'stats_sync' });
        }
    }

    async syncPreferences() {
        try {
            const { preferences } = await browser.storage.local.get('preferences');
            if (preferences) {
                await browser.storage.sync.set({
                    [this.SYNC_KEYS.PREFERENCES]: preferences
                });
                analyticsService.trackEvent('preferences_synced');
            }
        } catch (error) {
            console.error('Failed to sync preferences:', error);
            analyticsService.trackError(error, { context: 'preferences_sync' });
        }
    }

    async resolveConflicts(localData, syncedData) {
        this.updateStatus('syncing', this.STATUS_MESSAGES.CONFLICT);
        const resolved = {};

        for (const key of Object.keys(this.SYNC_KEYS)) {
            const local = localData[key];
            const synced = syncedData[key];

            if (!local || !synced) {
                resolved[key] = local || synced;
                continue;
            }

            // Use the most recent data based on timestamps
            if (local.lastModified && synced.lastModified) {
                resolved[key] = new Date(local.lastModified) > new Date(synced.lastModified)
                    ? local
                    : synced;
            } else {
                // If no timestamps, merge the data
                resolved[key] = this.mergeData(local, synced);
            }
        }

        return resolved;
    }

    mergeData(local, synced) {
        // Deep merge objects
        if (typeof local === 'object' && typeof synced === 'object') {
            return {
                ...synced,
                ...local,
                ...Object.keys(local)
                    .filter(key => typeof local[key] === 'object')
                    .reduce((acc, key) => ({
                        ...acc,
                        [key]: this.mergeData(local[key], synced[key] || {})
                    }), {})
            };
        }

        // For arrays, concatenate and remove duplicates
        if (Array.isArray(local) && Array.isArray(synced)) {
            return [...new Set([...synced, ...local])];
        }

        // For primitive values, prefer local
        return local;
    }

    async forceSync() {
        try {
            // Get all sync data
            const syncedData = await browser.storage.sync.get(null);
            const localData = await browser.storage.local.get(null);

            // Resolve any conflicts
            const resolvedData = await this.resolveConflicts(localData, syncedData);

            // Update both storages
            await Promise.all([
                browser.storage.local.set(resolvedData),
                browser.storage.sync.set(resolvedData)
            ]);

            analyticsService.trackEvent('force_sync_completed');
        } catch (error) {
            console.error('Failed to force sync:', error);
            analyticsService.trackError(error, { context: 'force_sync' });
            throw error;
        }
    }
}

const syncService = new SyncService();
export default syncService;
