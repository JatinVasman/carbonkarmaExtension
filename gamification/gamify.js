import DataManager from '../storage/dataManager.js';

// Badge definitions
const BADGES = {
    ECO_WARRIOR: {
        id: 'eco_warrior',
        name: 'Eco Warrior',
        icon: 'badges/eco-warrior.svg',
        description: 'Maintained a 7-day low-carbon streak',
        requirement: { type: 'streak', value: 7 }
    },
    TAB_MASTER: {
        id: 'tab_master',
        name: 'Tab Master',
        icon: 'badges/tab-master.svg',
        description: 'Kept under 10 tabs open for 3 days',
        requirement: { type: 'tabs', value: 3 }
    },
    ECO_VIEWER: {
        id: 'eco_viewer',
        name: 'Eco Viewer',
        icon: 'badges/eco-viewer.svg',
        description: 'Watched videos in 480p for a full day',
        requirement: { type: 'video_quality', value: 1 }
    },
    CARBON_SAVER: {
        id: 'carbon_saver',
        name: 'Carbon Saver',
        icon: 'badges/carbon-saver.svg',
        description: 'Reduced daily emissions by 50%',
        requirement: { type: 'reduction', value: 50 }
    }
};

class Gamification {
    /**
     * Check and award badges based on user activity
     * @param {Object} stats - User's current stats
     */
    static async checkBadges(stats) {
        const { streak, avgTabs, videoQuality, emissionsReduction } = stats;
        
        // Check each badge condition
        if (streak >= BADGES.ECO_WARRIOR.requirement.value) {
            await this.awardBadge(BADGES.ECO_WARRIOR);
        }
        
        if (avgTabs <= 10 && stats.lowTabDays >= BADGES.TAB_MASTER.requirement.value) {
            await this.awardBadge(BADGES.TAB_MASTER);
        }
        
        if (videoQuality === '480p' && stats.lowQualityDays >= BADGES.ECO_VIEWER.requirement.value) {
            await this.awardBadge(BADGES.ECO_VIEWER);
        }
        
        if (emissionsReduction >= BADGES.CARBON_SAVER.requirement.value) {
            await this.awardBadge(BADGES.CARBON_SAVER);
        }
    }

    /**
     * Award a badge to the user
     * @param {Object} badge 
     */
    static async awardBadge(badge) {
        await DataManager.saveBadge(badge);
        
        // Show notification
        const browser = window.browser || window.chrome;
        await browser.notifications.create({
            type: 'basic',
            iconUrl: browser.runtime.getURL(badge.icon),
            title: 'New Badge Earned! 🎉',
            message: `You've earned the ${badge.name} badge: ${badge.description}`
        });
    }

    /**
     * Calculate user stats for badge checking
     * @returns {Promise<Object>}
     */
    static async calculateStats() {
        const streak = await DataManager.get(DataManager.KEYS.STREAK) || 0;
        const emissions = await DataManager.get(DataManager.KEYS.DAILY_EMISSIONS) || {};
        
        // Calculate emissions reduction
        const dates = Object.keys(emissions).sort();
        const recent = dates.slice(-7);
        const previous = dates.slice(-14, -7);
        
        const recentAvg = recent.reduce((sum, date) => sum + emissions[date], 0) / recent.length;
        const previousAvg = previous.reduce((sum, date) => sum + emissions[date], 0) / previous.length;
        
        const emissionsReduction = previousAvg ? ((previousAvg - recentAvg) / previousAvg) * 100 : 0;

        return {
            streak,
            emissionsReduction,
            // Other stats would be calculated from actual usage data
            avgTabs: 8, // Example value
            lowTabDays: 3, // Example value
            videoQuality: '480p',
            lowQualityDays: 1
        };
    }

    /**
     * Get all available badges
     * @returns {Object}
     */
    static getAvailableBadges() {
        return BADGES;
    }

    /**
     * Get user's earned badges
     * @returns {Promise<Array>}
     */
    static async getEarnedBadges() {
        return await DataManager.get(DataManager.KEYS.BADGES) || [];
    }
}

export default Gamification;
