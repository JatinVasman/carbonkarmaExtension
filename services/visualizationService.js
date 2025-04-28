import { Chart } from 'chart.js/auto';
import browser from 'webextension-polyfill';

class VisualizationService {
    static chartCache = new Map();
    static CHART_CACHE_DURATION = 300000; // 5 minutes

    static async createEmissionsChart(element, data) {
        const cacheKey = 'emissions_chart';
        if (this.isCacheValid(cacheKey)) {
            return this.chartCache.get(cacheKey);
        }

        const ctx = canvas.getContext('2d');
        
        if (this.charts.has('emissions')) {
            this.charts.get('emissions').destroy();
        }

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Daily Emissions (g CO2)',
                    data: data.values,
                    borderColor: this.chartColors.green,
                    backgroundColor: `${this.chartColors.green}33`,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: this.getChartOptions('Emissions Over Time')
        });

        this.charts.set('emissions', chart);
        this.chartCache.set(cacheKey, chart);
        this.cacheTimestamps.set(cacheKey, Date.now());
        return chart;
    }

    static isCacheValid(key) {
        if (!this.chartCache.has(key)) return false;
        const timestamp = this.cacheTimestamps.get(key);
        return Date.now() - timestamp < this.CHART_CACHE_DURATION;
    }

    async createHourlyChart(canvas, data) {
        const ctx = canvas.getContext('2d');
        
        if (this.charts.has('hourly')) {
            this.charts.get('hourly').destroy();
        }

        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Array.from({length: 24}, (_, i) => `${i}:00`),
                datasets: [{
                    label: 'Average Emissions (g CO2)',
                    data: data,
                    backgroundColor: this.chartColors.blue,
                    borderColor: this.chartColors.blue,
                    borderWidth: 1
                }]
            },
            options: this.getChartOptions('Hourly Usage Pattern')
        });

        this.charts.set('hourly', chart);
        return chart;
    }

    async createCategoryChart(canvas, data) {
        const ctx = canvas.getContext('2d');
        
        if (this.charts.has('category')) {
            this.charts.get('category').destroy();
        }

        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(data),
                datasets: [{
                    data: Object.values(data),
                    backgroundColor: [
                        this.chartColors.green,
                        this.chartColors.yellow,
                        this.chartColors.pink,
                        this.chartColors.blue
                    ]
                }]
            },
            options: {
                ...this.getChartOptions('Emissions by Category'),
                cutout: '60%'
            }
        });

        this.charts.set('category', chart);
        return chart;
    }

    async createComparisonChart(canvas, userData, avgData) {
        const ctx = canvas.getContext('2d');
        
        if (this.charts.has('comparison')) {
            this.charts.get('comparison').destroy();
        }

        const chart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: ['Browsing', 'Video', 'Social', 'Work'],
                datasets: [
                    {
                        label: 'Your Usage',
                        data: userData,
                        borderColor: this.chartColors.green,
                        backgroundColor: `${this.chartColors.green}33`,
                    },
                    {
                        label: 'Average User',
                        data: avgData,
                        borderColor: this.chartColors.blue,
                        backgroundColor: `${this.chartColors.blue}33`,
                    }
                ]
            },
            options: this.getChartOptions('Usage Comparison')
        });

        this.charts.set('comparison', chart);
        return chart;
    }

    getChartOptions(title) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: title,
                    font: {
                        family: 'Space Grotesk',
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    position: 'bottom',
                    labels: {
                        font: {
                            family: 'Space Grotesk'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: '#000',
                    titleFont: {
                        family: 'Space Grotesk'
                    },
                    bodyFont: {
                        family: 'Space Grotesk'
                    },
                    callbacks: {
                        label: (context) => {
                            return ` ${context.parsed.y || context.parsed} g CO2`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        font: {
                            family: 'Space Grotesk'
                        }
                    }
                },
                y: {
                    ticks: {
                        font: {
                            family: 'Space Grotesk'
                        }
                    }
                }
            }
        };
    }

    async getEmissionsData() {
        const data = await browser.storage.local.get('stats');
        const stats = data.stats || {};
        const dailyEmissions = stats.dailyEmissions || [];
        
        return {
            labels: dailyEmissions.map(d => new Date(d.date).toLocaleDateString()),
            values: dailyEmissions.map(d => d.value)
        };
    }

    async getHourlyData() {
        const data = await browser.storage.local.get('stats');
        const stats = data.stats || {};
        return stats.hourlyEmissions || Array(24).fill(0);
    }

    async getCategoryData() {
        const data = await browser.storage.local.get('stats');
        const stats = data.stats || {};
        return stats.categoryEmissions || {
            'Browsing': 0,
            'Video': 0,
            'Social': 0,
            'Work': 0
        };
    }

    async getComparisonData() {
        const data = await browser.storage.local.get('stats');
        const stats = data.stats || {};
        
        return {
            user: stats.categoryEmissions ? Object.values(stats.categoryEmissions) : [0, 0, 0, 0],
            average: [100, 150, 80, 120] // Example average user data
        };
    }
}

export default VisualizationService;
