import browser from 'webextension-polyfill';
import syncService from './syncService';
import analyticsService from './analyticsService';

class SettingsError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SettingsError';
    }
}

class SettingsService {
    constructor() {
        this.defaults = {
            dailyEmissionGoal: 1000, // in grams CO2
            notifications: {
                enabled: true,
                achievements: true,
                tips: true,
                dailyReport: true
            },
            display: {
                theme: 'auto', // 'light', 'dark', or 'auto'
                colorScheme: 'default', // 'default', 'eco', 'ocean'
                compactMode: false
            },
            tracking: {
                inactiveTabs: true,
                videoQuality: true,
                socialMedia: true,
                workHours: {
                    enabled: false,
                    start: '09:00',
                    end: '17:00'
                }
            },
            privacy: {
                dataRetention: 90, // days
                anonymousStats: true,
                detailedTracking: true
            },
            accessibility: {
                highContrast: false,
                reducedMotion: false,
                largeText: false
            }
        };

        this.validThemes = ['light', 'dark', 'auto'];
        this.validColorSchemes = ['default', 'eco', 'ocean'];
        this.minDataRetention = 7; // Minimum 7 days
        this.maxDataRetention = 365; // Maximum 1 year
    }

    validateSettings(settings) {
        if (!settings || typeof settings !== 'object') {
            throw new SettingsError('Invalid settings object');
        }

        // Validate dailyEmissionGoal
        if (typeof settings.dailyEmissionGoal !== 'number' || 
            settings.dailyEmissionGoal < 100 || 
            settings.dailyEmissionGoal > 5000) {
            throw new SettingsError('Invalid daily emission goal');
        }

        // Validate notifications
        if (!settings.notifications || typeof settings.notifications !== 'object') {
            throw new SettingsError('Invalid notifications settings');
        }

        // Validate display settings
        if (!settings.display || typeof settings.display !== 'object') {
            throw new SettingsError('Invalid display settings');
        }
        if (!this.validThemes.includes(settings.display.theme)) {
            throw new SettingsError('Invalid theme');
        }
        if (!this.validColorSchemes.includes(settings.display.colorScheme)) {
            throw new SettingsError('Invalid color scheme');
        }

        // Validate tracking settings
        if (!settings.tracking || typeof settings.tracking !== 'object') {
            throw new SettingsError('Invalid tracking settings');
        }
        if (settings.tracking.workHours.enabled) {
            const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (!timeRegex.test(settings.tracking.workHours.start) || 
                !timeRegex.test(settings.tracking.workHours.end)) {
                throw new SettingsError('Invalid work hours format');
            }
        }

        // Validate privacy settings
        if (!settings.privacy || typeof settings.privacy !== 'object') {
            throw new SettingsError('Invalid privacy settings');
        }
        if (settings.privacy.dataRetention < this.minDataRetention || 
            settings.privacy.dataRetention > this.maxDataRetention) {
            throw new SettingsError('Invalid data retention period');
        }

        return true;
    }

    async initialize() {
        try {
            const settings = await browser.storage.local.get('settings');
            if (!settings.settings) {
                await this.resetToDefaults();
            } else {
                // Validate existing settings
                try {
                    this.validateSettings(settings.settings);
                } catch (error) {
                    console.warn('Invalid settings found, resetting to defaults:', error);
                    await this.resetToDefaults();
                }
            }
        } catch (error) {
            console.error('Failed to initialize settings:', error);
            throw error;
        }
    }

    async getSettings() {
        try {
            const data = await browser.storage.sync.get('settings');
            const settings = data.settings || this.defaults;
            this.validateSettings(settings);
            return settings;
        } catch (error) {
            console.error('Failed to get settings:', error);
            return this.defaults;
        }
    }

    async updateSettings(newSettings) {
        try {
            // Get and validate current settings
            const currentSettings = await this.getSettings();
            
            // Create merged settings
            const updatedSettings = { ...currentSettings, ...newSettings };
            
            // Validate the merged settings
            this.validateSettings(updatedSettings);
            
            // Save if validation passes
            await browser.storage.local.set({ settings: updatedSettings });
            return updatedSettings;
            
        } catch (error) {
            console.error('Failed to update settings:', error);
            throw new SettingsError('Failed to update settings: ' + error.message);
        }
    }

    async resetToDefaults() {
        try {
            await browser.storage.local.set({ settings: this.defaults });
            return this.defaults;
        } catch (error) {
            console.error('Failed to reset settings:', error);
            throw new SettingsError('Failed to reset settings to defaults');
        }
    }

    async updateDailyGoal(newGoal) {
        try {
            if (typeof newGoal !== 'number' || newGoal < 100 || newGoal > 5000) {
                throw new SettingsError('Invalid daily goal value');
            }

            const settings = await this.getSettings();
            settings.dailyEmissionGoal = newGoal;
            return await this.updateSettings(settings);
        } catch (error) {
            console.error('Failed to update daily goal:', error);
            throw new SettingsError('Failed to update daily goal: ' + error.message);
        }
    }

    async toggleNotifications(type, enabled) {
        try {
            if (!['enabled', 'achievements', 'tips', 'dailyReport'].includes(type)) {
                throw new SettingsError('Invalid notification type');
            }
            if (typeof enabled !== 'boolean') {
                throw new SettingsError('Invalid enabled value');
            }

            const settings = await this.getSettings();
            settings.notifications[type] = enabled;
            return await this.updateSettings(settings);
        } catch (error) {
            console.error('Failed to toggle notifications:', error);
            throw new SettingsError('Failed to toggle notifications: ' + error.message);
        }
    }

    async updateTheme(theme) {
        try {
            if (!this.validThemes.includes(theme)) {
                throw new SettingsError('Invalid theme');
            }

            const settings = await this.getSettings();
            settings.display.theme = theme;
            return await this.updateSettings(settings);
        } catch (error) {
            console.error('Failed to update theme:', error);
            throw new SettingsError('Failed to update theme: ' + error.message);
        }
    }

    async updateColorScheme(scheme) {
        try {
            if (!this.validColorSchemes.includes(scheme)) {
                throw new SettingsError('Invalid color scheme');
            }

            const settings = await this.getSettings();
            settings.display.colorScheme = scheme;
            return await this.updateSettings(settings);
        } catch (error) {
            console.error('Failed to update color scheme:', error);
            throw new SettingsError('Failed to update color scheme: ' + error.message);
        }
    }

    async updateWorkHours(start, end) {
        try {
            const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (!timeRegex.test(start) || !timeRegex.test(end)) {
                throw new SettingsError('Invalid time format');
            }

            const settings = await this.getSettings();
            settings.tracking.workHours.start = start;
            settings.tracking.workHours.end = end;
            return await this.updateSettings(settings);
        } catch (error) {
            console.error('Failed to update work hours:', error);
            throw new SettingsError('Failed to update work hours: ' + error.message);
        }
    }

    async updatePrivacySettings(privacySettings) {
        try {
            if (!privacySettings || typeof privacySettings !== 'object') {
                throw new SettingsError('Invalid privacy settings');
            }

            if (privacySettings.dataRetention !== undefined && 
                (privacySettings.dataRetention < this.minDataRetention || 
                 privacySettings.dataRetention > this.maxDataRetention)) {
                throw new SettingsError('Invalid data retention period');
            }

            const settings = await this.getSettings();
            settings.privacy = { ...settings.privacy, ...privacySettings };
            return await this.updateSettings(settings);
        } catch (error) {
            console.error('Failed to update privacy settings:', error);
            throw new SettingsError('Failed to update privacy settings: ' + error.message);
        }
    }

    async updateAccessibilitySettings(accessibilitySettings) {
        try {
            if (!accessibilitySettings || typeof accessibilitySettings !== 'object') {
                throw new SettingsError('Invalid accessibility settings');
            }

            const validBooleanKeys = ['highContrast', 'reducedMotion', 'largeText'];
            for (const key of Object.keys(accessibilitySettings)) {
                if (!validBooleanKeys.includes(key) || typeof accessibilitySettings[key] !== 'boolean') {
                    throw new SettingsError(`Invalid accessibility setting: ${key}`);
                }
            }

            const settings = await this.getSettings();
            settings.accessibility = { ...settings.accessibility, ...accessibilitySettings };
            return await this.updateSettings(settings);
        } catch (error) {
            console.error('Failed to update accessibility settings:', error);
            throw new SettingsError('Failed to update accessibility settings: ' + error.message);
        }
    }

    async applySettings(settings) {
        // Apply theme
        document.documentElement.setAttribute('data-theme', settings.display.theme);
        if (settings.display.theme === 'auto') {
            this.setupAutoTheme();
        }

        // Apply accessibility settings
        document.documentElement.classList.toggle('high-contrast', settings.accessibility.highContrast);
        document.documentElement.classList.toggle('reduced-motion', settings.accessibility.reducedMotion);
        document.documentElement.classList.toggle('large-text', settings.accessibility.largeText);

        // Apply color scheme
        document.documentElement.setAttribute('data-color-scheme', settings.display.colorScheme);

        // Apply compact mode
        document.documentElement.classList.toggle('compact-mode', settings.display.compactMode);

        // Notify background script of settings changes
        await browser.runtime.sendMessage({
            type: 'SETTINGS_UPDATED',
            settings: settings
        });
    }

    setupAutoTheme() {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleThemeChange = (e) => {
            document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        };
        mediaQuery.addEventListener('change', handleThemeChange);
        handleThemeChange(mediaQuery);
    }

    async cleanupOldData() {
        const settings = await this.getSettings();
        const retentionDays = settings.privacy.dataRetention;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        const data = await browser.storage.local.get(null);
        if (data.stats?.dailyEmissions) {
            data.stats.dailyEmissions = data.stats.dailyEmissions.filter(
                entry => new Date(entry.date) > cutoffDate
            );
            await browser.storage.local.set({ stats: data.stats });
        }
    }

    getColorSchemes() {
        return {
            default: {
                green: '#00FF7F',
                yellow: '#FFE600',
                pink: '#FF69B4',
                blue: '#00BFFF'
            },
            eco: {
                green: '#2ECC71',
                yellow: '#F1C40F',
                pink: '#E74C3C',
                blue: '#3498DB'
            },
            ocean: {
                green: '#00BFA5',
                yellow: '#FFD54F',
                pink: '#FF4081',
                blue: '#40C4FF'
            }
        };
    }

    async validateSettings(settings) {
        const errors = [];

        // Validate emission goal
        if (settings.dailyEmissionGoal < 0) {
            errors.push('Daily emission goal cannot be negative');
        }

        // Validate work hours
        if (settings.tracking.workHours.enabled) {
            const start = settings.tracking.workHours.start;
            const end = settings.tracking.workHours.end;
            if (!start.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
                errors.push('Invalid work hours start time format');
            }
            if (!end.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
                errors.push('Invalid work hours end time format');
            }
        }

        // Validate data retention
        if (settings.privacy.dataRetention < 1 || settings.privacy.dataRetention > 365) {
            errors.push('Data retention must be between 1 and 365 days');
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
}

export default new SettingsService();
