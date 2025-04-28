import dataManager from './dataManager';

class MockDataGenerator {
    constructor() {
        this.baseEmission = 200; // Base emission in grams
        this.variability = 0.3; // 30% random variation
    }

    // Generate random number between min and max
    random(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Generate emissions for a single day
    generateDailyEmissions(date, activityLevel = 1) {
        const base = this.baseEmission * activityLevel;
        const variation = base * this.variability;
        return base + (Math.random() * variation * 2 - variation);
    }

    // Generate mock achievements
    async generateAchievements() {
        const achievements = [
            {
                id: 'eco-starter',
                name: 'Eco Starter',
                type: 'eco',
                earnedDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString() // 10 days ago
            },
            {
                id: 'carbon-saver',
                name: 'Carbon Saver',
                type: 'carbon',
                earnedDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString() // 5 days ago
            },
            {
                id: 'streak-3',
                name: '3-Day Streak',
                type: 'streak',
                earnedDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString() // 15 days ago
            },
            {
                id: 'streak-7',
                name: '7-Day Streak',
                type: 'streak',
                earnedDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString() // 3 days ago
            }
        ];

        for (const achievement of achievements) {
            await dataManager.addAchievement(achievement);
        }
    }

    // Generate mock streak data
    async generateStreak() {
        const streak = {
            count: 12,
            startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 11).toISOString(), // 11 days ago
            lastActiveDate: new Date().toISOString().split('T')[0]
        };

        await dataManager.updateStreak(streak);
    }

    // Generate mock emissions history
    async generateEmissionsHistory(days = 30) {
        const today = new Date();
        let totalEmissions = 0;
        let totalSaved = 0;

        // Generate different activity patterns
        const activityPatterns = {
            weekday: 1.2,
            weekend: 0.8,
            holiday: 0.5
        };

        for (let i = 0; i < days; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            // Determine activity level based on day of week
            const dayOfWeek = date.getDay();
            let activityLevel = dayOfWeek === 0 || dayOfWeek === 6 
                ? activityPatterns.weekend 
                : activityPatterns.weekday;

            // Randomly add some holiday days
            if (Math.random() < 0.1) {
                activityLevel = activityPatterns.holiday;
            }

            const emissions = this.generateDailyEmissions(date, activityLevel);
            await dataManager.addEmission(dateStr, emissions);

            totalEmissions += emissions;
            // Calculate savings (baseline - actual)
            const baseline = 1000; // 1000g baseline per day
            totalSaved += Math.max(baseline - emissions, 0);
        }

        // Update global stats
        await dataManager.updateStats({
            totalEmissions,
            totalSaved,
            bestStreak: 12,
            achievementsCount: 4
        });
    }

    // Generate all mock data
    async generateAll() {
        await dataManager.init();

        // Clear existing data
        const stores = ['emissions', 'streaks', 'achievements', 'stats'];
        for (const store of stores) {
            await dataManager.clearStore(store);
        }

        // Generate new data
        await this.generateEmissionsHistory();
        await this.generateStreak();
        await this.generateAchievements();

        console.log('Mock data generation complete!');
    }
}

// Create and export singleton instance
const mockData = new MockDataGenerator();
export default mockData;
