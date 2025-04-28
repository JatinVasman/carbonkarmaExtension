import visualizationService from '../services/visualizationService.js';
import storageService from '../services/storageService.js';  // Fixed import

class VisualizationPage {
    constructor() {
        this.initializeElements();
        this.initializeEventListeners();
        this.loadCharts();
        this.updateKeyInsights();
        this.startGridStatusMonitoring();  // Added new method call
    }

    initializeElements() {
        this.exportBtn = document.querySelector('.export-btn');
        this.totalReduction = document.querySelector('.total-reduction');
        this.peakHour = document.querySelector('.peak-hour');
        this.topCategory = document.querySelector('.top-category');
        this.efficiencyScore = document.querySelector('.efficiency-score');
        this.intensityValue = document.querySelector('.intensity-value');
        this.intensityLabel = document.querySelector('.intensity-label');
        this.currentSessionValue = document.querySelector('.current-session .value');
    }

    initializeEventListeners() {
        this.exportBtn.addEventListener('click', () => this.exportData());
    }

    async loadCharts() {
        try {
            // Emissions chart
            const emissionsData = await visualizationService.getEmissionsData();
            await visualizationService.createEmissionsChart(
                document.getElementById('emissions-chart'),
                emissionsData
            );

            // Hourly usage chart
            const hourlyData = await visualizationService.getHourlyData();
            await visualizationService.createHourlyChart(
                document.getElementById('hourly-chart'),
                hourlyData
            );

            // Category distribution chart
            const categoryData = await visualizationService.getCategoryData();
            await visualizationService.createCategoryChart(
                document.getElementById('category-chart'),
                categoryData
            );

            // Comparison chart
            const comparisonData = await visualizationService.getComparisonData();
            await visualizationService.createComparisonChart(
                document.getElementById('comparison-chart'),
                comparisonData.user,
                comparisonData.average
            );
        } catch (error) {
            console.error('Error loading charts:', error);
        }
    }

    async updateKeyInsights() {
        try {
            const data = await storageService.getAllData();
            const stats = data.stats || {};

            // Calculate total reduction
            const totalReduction = stats.dailyEmissions?.reduce((acc, day) => acc + day.reduction, 0) || 0;
            this.totalReduction.textContent = `${totalReduction.toFixed(1)}g`;

            // Find peak hour
            const hourlyData = await visualizationService.getHourlyData();
            const peakHourIndex = hourlyData.indexOf(Math.max(...hourlyData));
            this.peakHour.textContent = `${peakHourIndex}:00`;

            // Find top category
            const categoryData = await visualizationService.getCategoryData();
            const topCat = Object.entries(categoryData)
                .sort(([,a], [,b]) => b - a)[0][0];
            this.topCategory.textContent = topCat;

            // Calculate efficiency score
            const efficiencyScore = this.calculateEfficiencyScore(stats);
            this.efficiencyScore.textContent = efficiencyScore;
        } catch (error) {
            console.error('Error updating insights:', error);
        }
    }

    calculateEfficiencyScore(stats) {
        let score = 100;

        // Deduct points for high emissions
        if (stats.dailyEmissions) {
            const avgEmissions = stats.dailyEmissions.reduce((acc, day) => acc + day.value, 0) / stats.dailyEmissions.length;
            score -= Math.max(0, (avgEmissions - 1000) / 100);
        }

        // Add points for streaks
        if (stats.currentStreak) {
            score += Math.min(20, stats.currentStreak);
        }

        // Add points for dark mode usage
        if (stats.darkModeHours) {
            score += Math.min(10, stats.darkModeHours / 24);
        }

        return Math.round(Math.max(0, Math.min(100, score)));
    }

    async exportData() {
        try {
            const data = await storageService.getAllData();
            const exportData = {
                dailyEmissions: data.stats.dailyEmissions,
                categoryEmissions: await visualizationService.getCategoryData(),
                hourlyPattern: await visualizationService.getHourlyData(),
                achievements: data.gamification?.achievements || {},
                badges: data.gamification?.badges || [],
                lastUpdated: new Date().toISOString()
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `carbonkarma-stats-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting data:', error);
        }
    }

    async startGridStatusMonitoring() {
        try {
            const updateGridStatus = async () => {
                const response = await fetch('https://api.electricitymap.org/v3/carbon-intensity/latest?zone=IN-NO', {
                    method: 'GET',
                    headers: {
                        'auth-token': 'KnVGxwFL5wrrbWJeA4NO'
                    }
                });
                const data = await response.json();
                
                // Update intensity display
                if (data.carbonIntensity) {
                    this.intensityValue.textContent = `${Math.round(data.carbonIntensity)} gCO₂eq/kWh`;
                    this.intensityLabel.textContent = 'Current Grid Carbon Intensity';
                    
                    // Increase current session value
                    const currentValue = parseFloat(this.currentSessionValue.textContent);
                    const increment = (data.carbonIntensity / 1000) * 0.1; // Small increment based on grid intensity
                    this.currentSessionValue.textContent = (currentValue + increment).toFixed(1);
                }
            };

            // Initial update
            await updateGridStatus();
            
            // Update every 5 minutes
            setInterval(updateGridStatus, 5 * 60 * 1000);
        } catch (error) {
            console.error('Error updating grid status:', error);
            this.intensityValue.textContent = 'Unavailable';
            this.intensityLabel.textContent = 'Grid status unavailable';
        }
    }
}

// Initialize the page
new VisualizationPage();

// Optimize Chart.js loading
// Instead of direct import
// import Chart from 'chart.js/auto';

// Use dynamic import
const loadChart = async () => {
    const { default: Chart } = await import('chart.js/auto');
    return Chart;
};

// Use when needed
const initializeChart = async () => {
    const Chart = await loadChart();
    // chart initialization code
};
// Initialize charts after dynamic import
    await this.loadCharts();
// This closing brace appears to be orphaned and should be removed
