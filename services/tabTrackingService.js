import browser from 'webextension-polyfill';

class TabTrackingError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TabTrackingError';
    }
}

class TabTrackingService {
    constructor() {
        this.tabs = new Map(); // Store tab data
        this.CO2_PER_MINUTE = 6; // Base CO2 emission rate in grams per minute
        this.lastUpdate = Date.now();
        this.MAX_TABS = 100; // Maximum number of tabs to track
        this.MAX_EMISSIONS_PER_TAB = 1000; // Maximum emissions per tab in grams
        this.UPDATE_INTERVAL = 60000; // 1 minute in milliseconds
    }

    validateTabId(tabId) {
        if (!tabId || typeof tabId !== 'number' || tabId < 0) {
            throw new TabTrackingError('Invalid tab ID');
        }
    }

    validateTabData(tabData) {
        if (!tabData || typeof tabData !== 'object') {
            throw new TabTrackingError('Invalid tab data');
        }

        const requiredFields = ['id', 'startTime', 'lastActive', 'emissions', 'isActive'];
        for (const field of requiredFields) {
            if (field === 'isActive' && typeof tabData[field] !== 'boolean') {
                throw new TabTrackingError(`Invalid ${field} value`);
            } else if (field !== 'isActive' && (typeof tabData[field] !== 'number' || isNaN(tabData[field]))) {
                throw new TabTrackingError(`Invalid ${field} value`);
            }
        }

        return true;
    }

    async initialize() {
        try {
            // Get all existing tabs
            const tabs = await browser.tabs.query({});
            
            // Clear existing data for clean start
            this.tabs.clear();
            
            // Track new tabs with limit
            tabs.slice(0, this.MAX_TABS).forEach(tab => {
                this.trackTab(tab.id);
            });

            // Listen for tab events with error handling
            browser.tabs.onCreated.addListener(tab => {
                try {
                    this.trackTab(tab.id);
                } catch (error) {
                    console.error('Error tracking new tab:', error);
                }
            });

            browser.tabs.onRemoved.addListener(tabId => {
                try {
                    this.stopTrackingTab(tabId);
                } catch (error) {
                    console.error('Error stopping tab tracking:', error);
                }
            });

            browser.tabs.onActivated.addListener(({ tabId }) => {
                try {
                    this.updateTabActivity(tabId);
                } catch (error) {
                    console.error('Error updating tab activity:', error);
                }
            });

            // Update emissions periodically with error handling
            setInterval(() => {
                try {
                    this.updateAllTabEmissions();
                } catch (error) {
                    console.error('Error updating tab emissions:', error);
                }
            }, this.UPDATE_INTERVAL);

        } catch (error) {
            console.error('Failed to initialize tab tracking:', error);
            throw error;
        }
    }

    trackTab(tabId) {
        try {
            this.validateTabId(tabId);

            // Check if we're at the tab limit
            if (this.tabs.size >= this.MAX_TABS) {
                throw new TabTrackingError('Maximum tab limit reached');
            }

            const tabData = {
                id: tabId,
                startTime: Date.now(),
                lastActive: Date.now(),
                emissions: 0,
                isActive: true
            };

            this.validateTabData(tabData);
            this.tabs.set(tabId, tabData);

        } catch (error) {
            console.error(`Failed to track tab ${tabId}:`, error);
            throw error;
        }
    }

    stopTrackingTab(tabId) {
        try {
            this.validateTabId(tabId);
            
            if (!this.tabs.has(tabId)) {
                throw new TabTrackingError('Tab not found');
            }

            const finalEmissions = this.calculateTabEmissions(tabId);
            this.tabs.delete(tabId);
            return finalEmissions;

        } catch (error) {
            console.error(`Failed to stop tracking tab ${tabId}:`, error);
            throw error;
        }
    }

    updateTabActivity(activeTabId) {
        try {
            this.validateTabId(activeTabId);

            this.tabs.forEach((tab, tabId) => {
                const wasActive = tab.isActive;
                tab.isActive = tabId === activeTabId;
                
                if (!wasActive && tab.isActive) {
                    tab.lastActive = Date.now();
                }
            });

        } catch (error) {
            console.error(`Failed to update tab activity for ${activeTabId}:`, error);
            throw error;
        }
    }

    calculateTabEmissions(tabId) {
        try {
            this.validateTabId(tabId);

            const tab = this.tabs.get(tabId);
            if (!tab) {
                throw new TabTrackingError('Tab not found');
            }

            const now = Date.now();
            const activeTime = Math.max(0, (now - tab.lastActive) / 1000 / 60); // Convert to minutes, ensure non-negative
            const emissions = Math.min(this.MAX_EMISSIONS_PER_TAB, activeTime * this.CO2_PER_MINUTE);

            return Math.round(emissions * 100) / 100; // Round to 2 decimal places

        } catch (error) {
            console.error(`Failed to calculate emissions for tab ${tabId}:`, error);
            return 0; // Return 0 for failed calculations
        }
    }

    async updateAllTabEmissions() {
        try {
            let totalEmissions = 0;
            const updates = [];

            // Process all tabs and collect updates
            this.tabs.forEach((tab, tabId) => {
                if (tab.isActive) {
                    const emissions = this.calculateTabEmissions(tabId);
                    if (emissions > 0) {
                        tab.emissions = Math.min(
                            this.MAX_EMISSIONS_PER_TAB,
                            tab.emissions + emissions
                        );
                        totalEmissions += emissions;
                        tab.lastActive = Date.now();
                        updates.push({ tabId, emissions });
                    }
                }
            });

            // Log updates for debugging
            if (updates.length > 0) {
                console.debug('Tab emissions updates:', updates);
            }

            return totalEmissions;

        } catch (error) {
            console.error('Failed to update all tab emissions:', error);
            throw error;
        }
    }

    getCurrentSessionEmissions() {
        try {
            let total = 0;
            const emissions = [];

            this.tabs.forEach((tab, tabId) => {
                if (tab.emissions > 0) {
                    total += tab.emissions;
                    emissions.push({ tabId, emissions: tab.emissions });
                }
            });

            // Log for debugging
            if (emissions.length > 0) {
                console.debug('Current session emissions:', emissions);
            }

            return Math.round(total * 100) / 100; // Round to 2 decimal places

        } catch (error) {
            console.error('Failed to get current session emissions:', error);
            return 0;
        }
    }

    getActiveTabsCount() {
        try {
            let count = 0;
            const activeTabs = [];

            this.tabs.forEach((tab, tabId) => {
                if (tab.isActive) {
                    count++;
                    activeTabs.push(tabId);
                }
            });

            console.debug('Active tabs:', {
                count,
                tabs: activeTabs
            });

            return count;

        } catch (error) {
            console.error('Failed to count active tabs:', error);
            return 0;
        }
    }

    getInactiveTabsCount() {
        try {
            let inactiveCount = 0;
            const inactiveTabs = [];

            this.tabs.forEach((tab, tabId) => {
                if (!tab.isActive) {
                    inactiveCount++;
                    inactiveTabs.push(tabId);
                }
            });

            console.debug('Inactive tabs:', {
                count: inactiveCount,
                tabs: inactiveTabs
            });

            return inactiveCount;

        } catch (error) {
            console.error('Failed to count inactive tabs:', error);
            return 0;
        }
    }

    getEmissionRate() {
        try {
            let activeTabCount = 0;
            const activeTabs = [];

            this.tabs.forEach((tab, tabId) => {
                if (tab.isActive) {
                    activeTabCount++;
                    activeTabs.push(tabId);
                }
            });

            const rate = Math.min(
                this.MAX_EMISSIONS_PER_TAB,
                activeTabCount * this.CO2_PER_MINUTE
            );

            console.debug('Current emission rate:', {
                activeTabCount,
                activeTabs,
                rate
            });

            return Math.round(rate * 100) / 100; // Round to 2 decimal places

        } catch (error) {
            console.error('Failed to calculate emission rate:', error);
            return 0;
        }
    }
}

export default new TabTrackingService();
