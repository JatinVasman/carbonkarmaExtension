import browser from 'webextension-polyfill';
import tabTrackingService from '../services/tabTrackingService';
import statsService from '../services/statsService';
import { electricityMapService } from '../services/electricityMapService';

class CarbonTracker {
    constructor() {
        this.updateInterval = 60000; // Update every minute
        this.initialize();
    }

    async initialize() {
        await statsService.initialize();
        await tabTrackingService.initialize();
        this.setupListeners();
        this.startPeriodicUpdates();
    }

    setupListeners() {
        // Listen for messages from popup
        browser.runtime.onMessage.addListener(async (message, sender) => {
            switch (message.type) {
                case 'GET_STATS':
                    return this.getCurrentStats();
                case 'UPDATE_GOAL':
                    return statsService.updateDailyGoal(message.goal);
                case 'RESET_STATS':
                    return this.resetStats();
            }
        });
    }

    startPeriodicUpdates() {
        setInterval(async () => {
            try {
                // Get current emissions from tab tracking
                const newEmissions = tabTrackingService.getCurrentSessionEmissions();
                
                // Update stats
                await statsService.updateEmissions(newEmissions);
                
                // Update badge text with current emission rate
                const emissionRate = tabTrackingService.getEmissionRate();
                await browser.action.setBadgeText({
                    text: `${Math.round(emissionRate)}`
                });
                
                // Check for achievements
                await this.checkAchievements();
                
            } catch (error) {
                console.error('Error in periodic update:', error);
            }
        }, this.updateInterval);
    }

    async getCurrentStats() {
        const stats = statsService.getStats();
        const emissionRate = tabTrackingService.getEmissionRate();
        
        return {
            ...stats,
            currentRate: emissionRate,
            inactiveTabs: tabTrackingService.getInactiveTabsCount()
        };
    }

    async checkAchievements() {
        const stats = statsService.getStats();
        
        const achievements = [
            {
                id: 'eco-warrior',
                name: 'Eco Warrior',
                condition: () => stats.currentSession <= stats.dailyGoal * 0.5,
                icon: 'eco-warrior.svg'
            },
            {
                id: 'streak-master',
                name: 'Streak Master',
                condition: () => stats.streak >= 7,
                icon: 'streak-master.svg'
            },
            {
                id: 'tab-minimalist',
                name: 'Tab Minimalist',
                condition: () => tabTrackingService.getInactiveTabsCount() === 0,
                icon: 'tab-minimalist.svg'
            },
            {
                id: 'carbon-saver',
                name: 'Carbon Saver',
                condition: () => stats.pagesVisited >= 100 && stats.emissionsSaved >= 500,
                icon: 'carbon-saver.svg'
            }
        ];
        
        for (const achievement of achievements) {
            if (achievement.condition()) {
                await statsService.addAchievement(achievement.id);
            }
        }
    }


}

// Initialize tracker
const tracker = new CarbonTracker();

// Service Worker Registration
async function registerServiceWorker() {
    try {
        // Check if service workers are supported
        if ('serviceWorker' in navigator) {
            // Wait for the page to be fully loaded
            window.addEventListener('load', async () => {
                try {
                    const registration = await navigator.serviceWorker.register('/sw.js', {
                        scope: '/'
                    });
                    console.log('ServiceWorker registration successful:', registration);
                } catch (error) {
                    console.error('ServiceWorker registration failed:', error);
                }
            });
        }
    } catch (error) {
        console.error('Error during service worker setup:', error);
        // Continue extension operation even if service worker fails
    }
}
