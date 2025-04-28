import settingsService from '../services/settingsService.js';

class SettingsPage {
    constructor() {
        this.initializeElements();
        this.loadSettings();
        this.setupEventListeners();
    }

    initializeElements() {
        // Daily Emission Goal
        this.dailyEmissionGoalInput = document.getElementById('dailyEmissionGoal');

        // Notifications
        this.notificationsEnabledCheckbox = document.getElementById('notificationsEnabled');
        this.achievementNotificationsCheckbox = document.getElementById('achievementNotifications');
        this.dailyReportCheckbox = document.getElementById('dailyReport');

        // Display
        this.themeSelect = document.getElementById('theme');
        this.colorSchemeSelect = document.getElementById('colorScheme');
        this.compactModeCheckbox = document.getElementById('compactMode');

        // Privacy
        this.dataRetentionInput = document.getElementById('dataRetention');
        this.anonymousStatsCheckbox = document.getElementById('anonymousStats');

        // Accessibility
        this.highContrastCheckbox = document.getElementById('highContrast');
        this.reducedMotionCheckbox = document.getElementById('reducedMotion');
        this.largeTextCheckbox = document.getElementById('largeText');

        // Buttons
        this.resetButton = document.getElementById('resetButton');
        this.saveButton = document.getElementById('saveButton');
    }

    async loadSettings() {
        const settings = await settingsService.getSettings();
        
        // Daily Emission Goal
        this.dailyEmissionGoalInput.value = settings.dailyEmissionGoal;

        // Notifications
        this.notificationsEnabledCheckbox.checked = settings.notifications.enabled;
        this.achievementNotificationsCheckbox.checked = settings.notifications.achievements;
        this.dailyReportCheckbox.checked = settings.notifications.dailyReport;

        // Display
        this.themeSelect.value = settings.display.theme;
        this.colorSchemeSelect.value = settings.display.colorScheme;
        this.compactModeCheckbox.checked = settings.display.compactMode;

        // Privacy
        this.dataRetentionInput.value = settings.privacy.dataRetention;
        this.anonymousStatsCheckbox.checked = settings.privacy.anonymousStats;

        // Accessibility
        this.highContrastCheckbox.checked = settings.accessibility.highContrast;
        this.reducedMotionCheckbox.checked = settings.accessibility.reducedMotion;
        this.largeTextCheckbox.checked = settings.accessibility.largeText;
    }

    setupEventListeners() {
        // Save button
        this.saveButton.addEventListener('click', () => this.saveSettings());

        // Reset button
        this.resetButton.addEventListener('click', () => this.resetSettings());

        // Theme change
        this.themeSelect.addEventListener('change', () => this.applyTheme());
    }

    async saveSettings() {
        const settings = {
            dailyEmissionGoal: parseInt(this.dailyEmissionGoalInput.value),
            notifications: {
                enabled: this.notificationsEnabledCheckbox.checked,
                achievements: this.achievementNotificationsCheckbox.checked,
                dailyReport: this.dailyReportCheckbox.checked
            },
            display: {
                theme: this.themeSelect.value,
                colorScheme: this.colorSchemeSelect.value,
                compactMode: this.compactModeCheckbox.checked
            },
            privacy: {
                dataRetention: parseInt(this.dataRetentionInput.value),
                anonymousStats: this.anonymousStatsCheckbox.checked
            },
            accessibility: {
                highContrast: this.highContrastCheckbox.checked,
                reducedMotion: this.reducedMotionCheckbox.checked,
                largeText: this.largeTextCheckbox.checked
            }
        };

        const validation = await settingsService.validateSettings(settings);
        if (!validation.valid) {
            alert('Please fix the following errors:\n' + validation.errors.join('\n'));
            return;
        }

        await settingsService.updateSettings(settings);
        this.showSaveConfirmation();
    }

    async resetSettings() {
        if (confirm('Are you sure you want to reset all settings to their default values?')) {
            await settingsService.resetToDefaults();
            await this.loadSettings();
            this.showResetConfirmation();
        }
    }

    async applyTheme() {
        const settings = await settingsService.getSettings();
        settings.display.theme = this.themeSelect.value;
        await settingsService.applySettings(settings);
    }

    showSaveConfirmation() {
        const originalText = this.saveButton.textContent;
        this.saveButton.textContent = 'Saved!';
        this.saveButton.classList.add('bg-green-600', 'hover:bg-green-700');
        this.saveButton.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        
        setTimeout(() => {
            this.saveButton.textContent = originalText;
            this.saveButton.classList.remove('bg-green-600', 'hover:bg-green-700');
            this.saveButton.classList.add('bg-blue-600', 'hover:bg-blue-700');
        }, 2000);
    }

    showResetConfirmation() {
        const originalText = this.resetButton.textContent;
        this.resetButton.textContent = 'Reset Complete!';
        this.resetButton.classList.add('bg-green-600', 'hover:bg-green-700', 'text-white');
        this.resetButton.classList.remove('bg-gray-200', 'hover:bg-gray-300', 'text-gray-700');
        
        setTimeout(() => {
            this.resetButton.textContent = originalText;
            this.resetButton.classList.remove('bg-green-600', 'hover:bg-green-700', 'text-white');
            this.resetButton.classList.add('bg-gray-200', 'hover:bg-gray-300', 'text-gray-700');
        }, 2000);
    }
}

// Initialize the settings page when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SettingsPage();
}); 