import browser from 'webextension-polyfill';

class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}

class StatsService {
    constructor() {
        this.stats = this.getDefaultStats();
        this.MAX_HISTORY_ITEMS = 1000; // Limit history items to prevent memory issues
        this.MIN_DAILY_GOAL = 100; // Minimum daily goal in grams
        this.MAX_DAILY_GOAL = 5000; // Maximum daily goal in grams
    }

    getDefaultStats() {
        return {
            dailyEmissions: 0,
            weeklyEmissions: 0,
            monthlyEmissions: 0,
            streak: 0,
            lastUpdate: null,
            dailyGoal: 1000, // Default daily goal in grams
            achievements: [],
            history: []
        };
    }

    validateStats(stats) {
        if (!stats || typeof stats !== 'object') {
            throw new ValidationError('Invalid stats object');
        }

        const requiredFields = ['dailyEmissions', 'weeklyEmissions', 'monthlyEmissions', 'streak', 'dailyGoal'];
        for (const field of requiredFields) {
            if (typeof stats[field] !== 'number' || isNaN(stats[field])) {
                throw new ValidationError(`Invalid ${field} value`);
            }
        }

        if (!Array.isArray(stats.history)) {
            throw new ValidationError('Invalid history array');
        }

        if (!Array.isArray(stats.achievements)) {
            throw new ValidationError('Invalid achievements array');
        }

        return true;
    }

    async initialize() {
        try {
            const data = await browser.storage.local.get('stats');
            if (data.stats) {
                this.validateStats(data.stats);
                this.stats = data.stats;
            }
            await this.checkAndResetDaily();
        } catch (error) {
            console.error('Failed to initialize stats:', error);
            // Reset to default stats if validation fails
            if (error instanceof ValidationError) {
                this.stats = this.getDefaultStats();
                await this.saveStats();
            } else {
                throw error; // Re-throw unexpected errors
            }
        }
    }

    async updateEmissions(newEmissions) {
        try {
            if (typeof newEmissions !== 'number' || isNaN(newEmissions) || newEmissions < 0) {
                throw new ValidationError('Invalid emissions value');
            }

            await this.checkAndResetDaily();

            // Update with 0.1 increment
            const incrementalValue = 0.1;
            this.stats.dailyEmissions = Math.max(0, this.stats.dailyEmissions + incrementalValue);
            this.stats.weeklyEmissions = Math.max(0, this.stats.weeklyEmissions + incrementalValue);
            this.stats.monthlyEmissions = Math.max(0, this.stats.monthlyEmissions + incrementalValue);

            // Update streak with validation
            if (this.stats.dailyEmissions <= this.stats.dailyGoal) {
                if (!this.stats.lastUpdate || this.isNewDay(this.stats.lastUpdate)) {
                    this.stats.streak = Math.max(0, this.stats.streak + 1);
                }
            } else {
                this.stats.streak = 0;
            }

            // Update history with size limit
            // Update history with incremental value
            this.stats.history.push({
                timestamp: Date.now(),
                emissions: incrementalValue,
                total: this.stats.dailyEmissions
            });

            // Trim history if it exceeds the limit
            if (this.stats.history.length > this.MAX_HISTORY_ITEMS) {
                this.stats.history = this.stats.history.slice(-this.MAX_HISTORY_ITEMS);
            }

            this.stats.lastUpdate = Date.now();
            await this.saveStats();
        } catch (error) {
            console.error('Failed to update emissions:', error);
            throw error;
        }
    }

    async checkAndResetDaily() {
        if (!this.stats.lastUpdate || this.isNewDay(this.stats.lastUpdate)) {
            // Save yesterday's emissions to history before resetting
            if (this.stats.lastUpdate) {
                this.stats.history.push({
                    date: new Date(this.stats.lastUpdate).toISOString().split('T')[0],
                    emissions: this.stats.dailyEmissions
                });
            }

            // Reset daily emissions
            this.stats.dailyEmissions = 0;
            await this.saveStats();
        }
    }

    isNewDay(timestamp) {
        const now = new Date();
        const last = new Date(timestamp);
        return now.toISOString().split('T')[0] !== last.toISOString().split('T')[0];
    }

    async saveStats() {
        await browser.storage.local.set({ stats: this.stats });
    }

    getStats() {
        return {
            currentSession: this.stats.dailyEmissions,
            dailyGoal: this.stats.dailyGoal,
            streak: this.stats.streak,
            progress: (this.stats.dailyEmissions / this.stats.dailyGoal) * 100,
            weeklyChange: this.calculateWeeklyChange()
        };
    }

    calculateWeeklyChange() {
        const currentWeek = this.stats.weeklyEmissions;
        const lastWeek = this.stats.history
            .filter(h => h.timestamp > Date.now() - 14 * 24 * 60 * 60 * 1000)
            .reduce((acc, curr) => acc + curr.emissions, 0);

        if (lastWeek === 0) return 0;
        return ((currentWeek - lastWeek) / lastWeek) * 100;
    }

    async updateDailyGoal(newGoal) {
        this.stats.dailyGoal = newGoal;
        await this.saveStats();
    }

    async addAchievement(achievement) {
        this.stats.achievements.push({
            ...achievement,
            timestamp: Date.now()
        });
        await this.saveStats();
    }
}

export default new StatsService();
