import browser from 'webextension-polyfill';
import aiService from '../services/aiService';
import electricityMapService from '../services/electricityMapService';
import storageService from '../services/storageService';

class PopupManager {
    constructor() {
        this.updateInterval = 5000; // Update every 5 seconds
        this.initializeElements();
        this.initializeEventListeners();
        this.startPeriodicUpdates();
        this.showNotification = this.showNotification.bind(this);
        this.suggestions = [];
        this.carbonIntensity = null;
        this.loadingStates = {
            suggestions: true,
            carbonIntensity: true,
            stats: true
        };
        this.loadInitialData();
    }

    initializeElements() {
        // Current session elements
        this.currentSessionElement = document.querySelector('.current-session .value');
        this.dailyGoalElement = document.querySelector('.daily-goal .value');
        this.streakElement = document.querySelector('.streak .value');
        
        // Progress bar
        this.progressBar = document.querySelector('.progress-bar .progress');
        
        // Activities
        this.inactiveTabsElement = document.querySelector('.activity-value');
        
        // Status badge
        this.statusBadge = document.querySelector('.status-active');
        
        // Achievements
        this.achievementsGrid = document.querySelector('.achievements-grid');

        // Data management elements
        this.exportButton = document.querySelector('#exportData');
        this.importButton = document.querySelector('#importData');
        this.importInput = document.querySelector('#importInput');
        this.notification = document.querySelector('.notification');

        // AI suggestions
        this.suggestionsContainer = document.querySelector('.suggestions-container');
        this.carbonIntensityBadge = document.querySelector('.carbon-intensity');
        this.suggestionsList = document.querySelector('.suggestions-list');
    }

    async loadInitialData() {
        this.showLoadingStates();

        try {
            // Load data in parallel
            const [stats, settings] = await Promise.all([
                this.loadStats(),
                storageService.getSettings()
            ]);

            // Get carbon intensity and suggestions in parallel
            const [intensityResult, suggestionsResult] = await Promise.allSettled([
                this.loadCarbonIntensity(settings.selectedRegion),
                this.loadSuggestions(stats, settings)
            ]);

            // Handle results
            if (intensityResult.status === 'fulfilled') {
                this.carbonIntensity = intensityResult.value;
                this.updateCarbonIntensity();
            } else {
                console.error('Error loading carbon intensity:', intensityResult.reason);
                this.showCarbonIntensityError();
            }

            if (suggestionsResult.status === 'fulfilled') {
                this.suggestions = suggestionsResult.value;
                this.updateSuggestions();
            } else {
                console.error('Error loading suggestions:', suggestionsResult.reason);
                this.showSuggestionsError();
            }

        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showNotification('Error loading data', 'error');
        } finally {
            this.hideLoadingStates();
        }
    }

    async loadStats() {
        try {
            const stats = await storageService.getStats();
            this.loadingStates.stats = false;
            return stats;
        } catch (error) {
            console.error('Error loading stats:', error);
            this.showNotification('Error loading statistics', 'error');
            throw error;
        }
    }

    async loadCarbonIntensity(region) {
        try {
            const intensity = await electricityMapService.getCarbonIntensity(region);
            this.loadingStates.carbonIntensity = false;
            return intensity;
        } catch (error) {
            this.loadingStates.carbonIntensity = false;
            throw error;
        }
    }

    async loadSuggestions(stats, settings) {
        try {
            const suggestions = await aiService.getSuggestions({
                stats,
                carbonIntensity: this.carbonIntensity,
                settings
            });
            this.loadingStates.suggestions = false;
            return suggestions;
        } catch (error) {
            this.loadingStates.suggestions = false;
            throw error;
        }
    }

    showLoadingStates() {
        // Update UI to show loading states
        if (this.loadingStates.carbonIntensity) {
            this.carbonIntensityBadge.classList.add('loading');
            this.carbonIntensityBadge.innerHTML = `
                <div class="loading-spinner"></div>
                <span class="intensity-label">Loading carbon intensity...</span>
            `;
        }

        if (this.loadingStates.suggestions) {
            this.suggestionsList.innerHTML = `
                <div class="suggestion-item loading">
                    <div class="loading-spinner"></div>
                    <div class="suggestion-content">
                        <p>Loading suggestions...</p>
                    </div>
                </div>
            `;
        }
    }

    hideLoadingStates() {
        this.carbonIntensityBadge?.classList.remove('loading');
        this.suggestionsList?.querySelector('.loading')?.remove();
    }

    showCarbonIntensityError() {
        if (this.carbonIntensityBadge) {
            this.carbonIntensityBadge.classList.add('error');
            this.carbonIntensityBadge.innerHTML = `
                <span class="intensity-value">⚠️</span>
                <span class="intensity-label">Unable to load carbon intensity</span>
                <button class="retry-button" onclick="this.retryLoadCarbonIntensity()">Retry</button>
            `;
        }
    }

    showSuggestionsError() {
        if (this.suggestionsList) {
            this.suggestionsList.innerHTML = `
                <div class="suggestion-item error">
                    <span class="suggestion-icon">⚠️</span>
                    <div class="suggestion-content">
                        <p>Unable to load suggestions</p>
                        <button class="retry-button" onclick="this.retryLoadSuggestions()">Retry</button>
                    </div>
                </div>
            `;
        }
    }

    async retryLoadCarbonIntensity() {
        this.loadingStates.carbonIntensity = true;
        this.showLoadingStates();
        try {
            const settings = await storageService.getSettings();
            this.carbonIntensity = await this.loadCarbonIntensity(settings.selectedRegion);
            this.updateCarbonIntensity();
        } catch (error) {
            console.error('Error retrying carbon intensity load:', error);
            this.showCarbonIntensityError();
        } finally {
            this.hideLoadingStates();
        }
    }

    async retryLoadSuggestions() {
        this.loadingStates.suggestions = true;
        this.showLoadingStates();
        try {
            const [stats, settings] = await Promise.all([
                this.loadStats(),
                storageService.getSettings()
            ]);
            this.suggestions = await this.loadSuggestions(stats, settings);
            this.updateSuggestions();
        } catch (error) {
            console.error('Error retrying suggestions load:', error);
            this.showSuggestionsError();
        } finally {
            this.hideLoadingStates();
        }
    }

    updateSuggestions() {
        if (!this.suggestionsList) return;

        // Clear existing suggestions
        this.suggestionsList.innerHTML = '';

        // Add new suggestions
        this.suggestions.forEach(suggestion => {
            const item = document.createElement('div');
            item.className = `suggestion-item ${suggestion.type}`;
            
            const icon = document.createElement('span');
            icon.className = `suggestion-icon ${suggestion.type}`;
            icon.innerHTML = this.getSuggestionIcon(suggestion.type);
            
            const content = document.createElement('div');
            content.className = 'suggestion-content';
            
            const message = document.createElement('p');
            message.textContent = suggestion.message;
            
            const impact = document.createElement('span');
            impact.className = `impact-badge ${suggestion.impact}`;
            impact.textContent = `Impact: ${suggestion.impact}`;
            
            content.appendChild(message);
            content.appendChild(impact);
            
            item.appendChild(icon);
            item.appendChild(content);

            if (suggestion.actionable) {
                const actionButton = document.createElement('button');
                actionButton.className = 'action-button';
                actionButton.textContent = 'Apply';
                actionButton.onclick = () => this.handleSuggestionAction(suggestion.action);
                item.appendChild(actionButton);
            }

            this.suggestionsList.appendChild(item);
        });
    }

    updateCarbonIntensity() {
        if (!this.carbonIntensityBadge || !this.carbonIntensity) return;

        const intensity = this.carbonIntensity.carbonIntensity;
        const level = this.getCarbonIntensityLevel(intensity);
        
        this.carbonIntensityBadge.className = `carbon-intensity ${level}`;
        this.carbonIntensityBadge.innerHTML = `
            <span class="intensity-value">${Math.round(intensity)} gCO₂eq/kWh</span>
            <span class="intensity-label">${level} carbon intensity</span>
        `;
    }

    getCarbonIntensityLevel(intensity) {
        if (intensity < 100) return 'low';
        if (intensity < 300) return 'medium';
        return 'high';
    }

    getSuggestionIcon(type) {
        const icons = {
            settings: '⚙️',
            video: '🎥',
            maintenance: '🔧',
            timing: '⏰',
            general: '💡'
        };
        return icons[type] || '💡';
    }

    async handleSuggestionAction(action) {
        try {
            switch (action.type) {
                case 'ENABLE_DARK_MODE':
                    await storageService.updateSettings({ theme: 'dark' });
                    document.body.classList.add('dark-theme');
                    this.showNotification('Dark mode enabled', 'success');
                    break;

                case 'SUGGEST_VIDEO_QUALITY':
                    await browser.storage.local.set({
                        preferredVideoQuality: action.params.quality
                    });
                    this.showNotification(`Video quality set to ${action.params.quality}`, 'success');
                    break;

                case 'SUGGEST_TAB_CLEANUP':
                    const tabs = await browser.tabs.query({});
                    if (tabs.length > action.params.threshold) {
                        this.showNotification(
                            `You have ${tabs.length} tabs open. Consider closing some.`,
                            'warning'
                        );
                    }
                    break;

                default:
                    console.warn('Unknown action type:', action.type);
            }

            // Track the action
            await aiService.trackEvent('suggestion_action', {
                actionType: action.type,
                successful: true
            });
        } catch (error) {
            console.error('Error handling suggestion action:', error);
            this.showNotification('Error applying suggestion', 'error');
            
            await aiService.trackEvent('suggestion_action', {
                actionType: action.type,
                successful: false,
                error: error.message
            });
        }
    }

    initializeEventListeners() {
        // Settings link
        document.querySelector('.settings-link')?.addEventListener('click', () => {
            browser.runtime.openOptionsPage();
        });

        // Achievement badges click for details
        this.achievementsGrid?.addEventListener('click', (e) => {
            const badge = e.target.closest('.achievement-badge');
            if (badge) {
                this.showAchievementDetails(badge.dataset.id);
            }
        });

        // Export data
        this.exportButton?.addEventListener('click', async () => {
            try {
                const result = await browser.runtime.sendMessage({ 
                    type: 'EXPORT_DATA' 
                });
                
                // Create download link
                const a = document.createElement('a');
                a.href = result.url;
                a.download = result.filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(result.url);

                this.showNotification('Data exported successfully!', 'success');

            } catch (error) {
                console.error('Export failed:', error);
                this.showNotification('Failed to export data', 'error');
            }
        });

        // Import data
        this.importButton?.addEventListener('click', () => {
            this.importInput.click();
        });

        this.importInput?.addEventListener('change', async (e) => {
            try {
                const file = e.target.files[0];
                if (!file) return;

                // Validate file type
                if (file.type !== 'application/json') {
                    throw new Error('Invalid file type. Please select a JSON file.');
                }

                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const jsonData = event.target.result;

                        // Validate backup before import
                        const validation = await browser.runtime.sendMessage({
                            type: 'VALIDATE_BACKUP',
                            data: jsonData
                        });

                        if (!validation.valid) {
                            throw new Error(validation.error);
                        }

                        // Confirm import
                        if (!confirm('This will replace your current data. Are you sure?')) {
                            return;
                        }

                        // Import data
                        await browser.runtime.sendMessage({
                            type: 'IMPORT_DATA',
                            data: jsonData
                        });

                        this.showNotification('Data imported successfully!', 'success');
                        setTimeout(() => window.location.reload(), 1500);

                    } catch (error) {
                        console.error('Import failed:', error);
                        this.showNotification(error.message || 'Failed to import data', 'error');
                    }
                };

                reader.readAsText(file);

            } catch (error) {
                console.error('Import failed:', error);
                this.showNotification(error.message || 'Failed to import data', 'error');
            } finally {
                // Reset input
                e.target.value = '';
            }
        });
    }

    async updateStats() {
        try {
            const stats = await browser.runtime.sendMessage({ type: 'GET_STATS' });
            
            // Update current session with animation
            this.animateValue(this.currentSessionElement, stats.currentSession, 'g CO<sub>2</sub>');
            
            // Update daily goal with animation
            this.animateValue(this.dailyGoalElement, stats.dailyGoal, 'g CO<sub>2</sub>');
            
            // Update streak with animation
            this.animateValue(this.streakElement, stats.streak);
            
            // Update progress bar with smooth animation
            const progress = (stats.currentSession / stats.dailyGoal) * 100;
            this.animateProgressBar(Math.min(100, progress));
            
            // Update inactive tabs with animation
            this.animateValue(this.inactiveTabsElement, stats.inactiveTabs);
            
            // Update status badge with transition
            this.updateStatusBadge(stats.isActive);
            
            // Update achievements with animation
            this.updateAchievements(stats.achievements);
            
            // Show warning if approaching daily goal
            if (progress >= 80 && progress < 100) {
                this.showNotification('Approaching daily emission goal!', 'warning');
            } else if (progress >= 100) {
                this.showNotification('Daily emission goal exceeded!', 'error');
            }
            
        } catch (error) {
            console.error('Error updating stats:', error);
            this.showNotification('Failed to update stats', 'error');
        }
    }

    animateValue(element, value, unit = '') {
        if (!element) return;

        const current = parseFloat(element.textContent) || 0;
        const duration = 1000; // 1 second animation
        const steps = 20;
        const increment = (value - current) / steps;
        let step = 0;

        const animate = () => {
            step++;
            const newValue = current + (increment * step);
            element.innerHTML = `${Math.round(newValue)}${unit ? `<span class="unit">${unit}</span>` : ''}`;

            if (step < steps) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    animateProgressBar(targetProgress) {
        if (!this.progressBar) return;

        const current = parseFloat(this.progressBar.style.width) || 0;
        const duration = 1000;
        const steps = 20;
        const increment = (targetProgress - current) / steps;
        let step = 0;

        const animate = () => {
            step++;
            const newValue = current + (increment * step);
            this.progressBar.style.width = `${newValue}%`;

            // Update color based on progress
            if (newValue >= 80) {
                this.progressBar.style.backgroundColor = newValue >= 100 ? '#ff4444' : '#ffa500';
            } else {
                this.progressBar.style.backgroundColor = '#4CAF50';
            }

            if (step < steps) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    updateStatusBadge(isActive) {
        if (!this.statusBadge) return;

        this.statusBadge.classList.toggle('active', isActive);
        this.statusBadge.textContent = isActive ? 'Active' : 'Inactive';
        
        // Add transition effect
        this.statusBadge.style.transition = 'all 0.3s ease';
        setTimeout(() => this.statusBadge.style.transition = '', 300);
    }

    updateAchievements(achievements) {
        if (!this.achievementsGrid || !achievements) return;
        
        const newAchievements = achievements.filter(a => a.isNew);
        if (newAchievements.length > 0) {
            this.showNotification('New achievement unlocked!', 'success');
        }

        this.achievementsGrid.innerHTML = achievements
            .map(achievement => `
                <div class="achievement-badge ${achievement.unlocked ? 'unlocked' : ''} ${achievement.isNew ? 'new' : ''}" 
                     data-id="${achievement.id}" 
                     title="${achievement.name}">
                    <i class="${achievement.icon}"></i>
                    ${achievement.isNew ? '<span class="new-badge">New!</span>' : ''}
                </div>
            `)
            .join('');
    }

    showNotification(message, type = 'info') {
        if (!this.notification) return;

        // Clear existing notification
        clearTimeout(this.notificationTimeout);

        // Update notification
        this.notification.textContent = message;
        this.notification.className = `notification ${type}`;
        this.notification.style.display = 'block';

        // Add slide-in animation
        this.notification.style.animation = 'slideIn 0.3s ease-out';

        // Auto-hide after 3 seconds
        this.notificationTimeout = setTimeout(() => {
            this.notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                this.notification.style.display = 'none';
            }, 300);
        }, 3000);
    }

    showAchievementDetails(id) {
        if (!id) return;

        browser.runtime.sendMessage({ 
            type: 'GET_ACHIEVEMENT_DETAILS', 
            id 
        }).then(achievement => {
            if (!achievement) return;

            // Create and show modal
            const modal = document.createElement('div');
            modal.className = 'achievement-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <h3>${achievement.name}</h3>
                    <p>${achievement.description}</p>
                    <div class="achievement-stats">
                        <span>Unlocked: ${new Date(achievement.unlockedAt).toLocaleDateString()}</span>
                        <span>Progress: ${achievement.progress}%</span>
                    </div>
                    <button class="close-modal">Close</button>
                </div>
            `;

            document.body.appendChild(modal);

            // Add close handler
            modal.querySelector('.close-modal').onclick = () => {
                modal.style.animation = 'fadeOut 0.3s';
                setTimeout(() => modal.remove(), 300);
            };

            // Add fade-in animation
            modal.style.animation = 'fadeIn 0.3s';
        });
    }

    startPeriodicUpdates() {
        this.updateStats();
        setInterval(() => this.updateStats(), this.updateInterval);
    }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});
