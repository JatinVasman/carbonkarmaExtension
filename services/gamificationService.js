import browser from 'webextension-polyfill';

class GamificationService {
    constructor() {
        this.BADGES = {
            ECO_WARRIOR: {
                id: 'eco_warrior',
                name: 'Eco Warrior',
                description: 'Reduce emissions for 7 consecutive days',
                icon: 'assets/badges/eco-warrior.svg',
                requirement: { type: 'streak', days: 7 }
            },
            NIGHT_OWL: {
                id: 'night_owl',
                name: 'Night Owl',
                description: 'Use dark mode for 24 hours straight',
                icon: 'assets/badges/night-owl.svg',
                requirement: { type: 'dark_mode', hours: 24 }
            },
            TAB_MASTER: {
                id: 'tab_master',
                name: 'Tab Master',
                description: 'Keep active tabs under 5 for a full day',
                icon: 'assets/badges/tab-master.svg',
                requirement: { type: 'tabs', max: 5, hours: 24 }
            },
            GREEN_SURFER: {
                id: 'green_surfer',
                name: 'Green Surfer',
                description: 'Stay under daily emission goal for 5 days',
                icon: 'assets/badges/green-surfer.svg',
                requirement: { type: 'goals', days: 5 }
            }
        };

        this.ACHIEVEMENTS = {
            DAILY_GOALS: {
                levels: [1, 5, 15, 30, 100],
                points: [10, 50, 150, 300, 1000]
            },
            EMISSION_REDUCTION: {
                levels: [100, 500, 1000, 5000, 10000],
                points: [20, 100, 200, 1000, 2000]
            },
            STREAK_DAYS: {
                levels: [3, 7, 14, 30, 90],
                points: [30, 70, 140, 300, 900]
            }
        };
    }

    async initialize() {
        const data = await browser.storage.local.get('gamification');
        if (!data.gamification) {
            await browser.storage.local.set({
                gamification: {
                    badges: [],
                    achievements: {},
                    currentStreak: 0,
                    longestStreak: 0,
                    lastActiveDate: new Date().toISOString(),
                    impactScore: 0,
                    darkModeHours: 0,
                    goalsMet: 0
                }
            });
        }
    }

    async updateStats(stats) {
        const data = await browser.storage.local.get('gamification');
        const gamification = data.gamification;
        
        // Update streak
        const today = new Date();
        const lastActive = new Date(gamification.lastActiveDate);
        
        if (this.isSameDay(today, lastActive)) {
            // Already updated today
            return;
        } else if (this.isConsecutiveDay(today, lastActive)) {
            gamification.currentStreak++;
            gamification.longestStreak = Math.max(gamification.longestStreak, gamification.currentStreak);
        } else {
            gamification.currentStreak = 1;
        }

        // Update other stats
        if (stats.isDarkMode) {
            gamification.darkModeHours++;
        }
        if (stats.emissionsUnderGoal) {
            gamification.goalsMet++;
        }

        // Check for new badges
        const newBadges = await this.checkForNewBadges(gamification, stats);
        gamification.badges = [...new Set([...gamification.badges, ...newBadges])];

        // Update achievements and impact score
        const achievementUpdates = this.updateAchievements(gamification, stats);
        gamification.achievements = achievementUpdates.achievements;
        gamification.impactScore += achievementUpdates.pointsEarned;

        // Save updates
        gamification.lastActiveDate = today.toISOString();
        await browser.storage.local.set({ gamification });

        return {
            newBadges,
            pointsEarned: achievementUpdates.pointsEarned,
            currentStreak: gamification.currentStreak,
            impactScore: gamification.impactScore
        };
    }

    async checkForNewBadges(gamification, stats) {
        const newBadges = [];
        
        // Check each badge's requirements
        for (const [badgeId, badge] of Object.entries(this.BADGES)) {
            if (!gamification.badges.includes(badgeId)) {
                const earned = await this.checkBadgeRequirement(badge.requirement, gamification, stats);
                if (earned) {
                    newBadges.push(badgeId);
                }
            }
        }
        
        return newBadges;
    }

    async checkBadgeRequirement(requirement, gamification, stats) {
        switch (requirement.type) {
            case 'streak':
                return gamification.currentStreak >= requirement.days;
            case 'dark_mode':
                return gamification.darkModeHours >= requirement.hours;
            case 'tabs':
                return stats.activeTabs <= requirement.max && 
                       stats.tabsUnderLimitHours >= requirement.hours;
            case 'goals':
                return gamification.goalsMet >= requirement.days;
            default:
                return false;
        }
    }

    updateAchievements(gamification, stats) {
        let pointsEarned = 0;
        const achievements = { ...gamification.achievements };

        // Check each achievement category
        for (const [category, config] of Object.entries(this.ACHIEVEMENTS)) {
            const currentLevel = achievements[category]?.level || 0;
            let value;

            // Get the relevant value for this achievement
            switch (category) {
                case 'DAILY_GOALS':
                    value = gamification.goalsMet;
                    break;
                case 'EMISSION_REDUCTION':
                    value = stats.totalEmissionsReduced;
                    break;
                case 'STREAK_DAYS':
                    value = gamification.currentStreak;
                    break;
            }

            // Check if we've reached a new level
            for (let i = currentLevel; i < config.levels.length; i++) {
                if (value >= config.levels[i]) {
                    pointsEarned += config.points[i];
                    achievements[category] = {
                        level: i + 1,
                        value: value
                    };
                }
            }
        }

        return { achievements, pointsEarned };
    }

    isSameDay(date1, date2) {
        return date1.toISOString().split('T')[0] === date2.toISOString().split('T')[0];
    }

    isConsecutiveDay(today, lastActive) {
        const oneDayMs = 24 * 60 * 60 * 1000;
        const diffDays = Math.round((today - lastActive) / oneDayMs);
        return diffDays === 1;
    }

    async getBadgeDetails(badgeId) {
        return this.BADGES[badgeId];
    }

    async getAchievementProgress(category) {
        const data = await browser.storage.local.get('gamification');
        const achievement = data.gamification.achievements[category];
        const config = this.ACHIEVEMENTS[category];

        if (!achievement) {
            return {
                currentLevel: 0,
                nextLevel: config.levels[0],
                progress: 0,
                pointsToNext: config.points[0]
            };
        }

        const currentLevel = achievement.level;
        const nextLevel = config.levels[currentLevel] || null;
        const progress = nextLevel ? (achievement.value / nextLevel) * 100 : 100;
        const pointsToNext = nextLevel ? config.points[currentLevel] : 0;

        return { currentLevel, nextLevel, progress, pointsToNext };
    }
}

export default new GamificationService();
