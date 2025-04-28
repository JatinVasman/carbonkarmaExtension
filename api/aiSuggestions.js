// AI-powered eco-friendly suggestions using Gemini
import DataManager from '../storage/dataManager.js';

class AISuggestions {
    static API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
    static API_KEY = process.env.GEMINI_API_KEY;

    /**
     * Generate eco-friendly suggestion based on user's activity
     * @param {Object} activity - User's activity data
     * @returns {Promise<string>}
     */
    static async generateSuggestion(activity) {
        const prompt = this.createPrompt(activity);
        
        try {
            const response = await fetch(`${this.API_ENDPOINT}?key=${this.API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 100,
                        topP: 0.8,
                        topK: 40
                    },
                    safetySettings: [{
                        category: "HARM_CATEGORY_DANGEROUS",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    }]
                })
            });

            const data = await response.json();
            const suggestion = data.candidates[0].content.parts[0].text;
            
            // Save suggestion
            await DataManager.saveSuggestion(suggestion);
            return suggestion;

        } catch (error) {
            console.error('Error generating AI suggestion:', error);
            return this.getFallbackSuggestion();
        }
    }

    /**
     * Create prompt based on user activity
     * @param {Object} activity 
     * @returns {string}
     */
    static createPrompt(activity) {
        const { dailyEmissions, topSites, videoQuality } = activity;
        return `As an eco-friendly digital assistant, analyze this user's digital carbon footprint:
                - Daily CO2 emissions: ${dailyEmissions}g
                - Frequently visited sites: ${topSites.join(', ')}
                - Typical video quality: ${videoQuality}
                
                Provide one specific, actionable tip to reduce their digital carbon footprint, focusing on practical changes in their browsing habits.`;
    }

    /**
     * Get a fallback suggestion if AI fails
     * @returns {string}
     */
    static getFallbackSuggestion() {
        const suggestions = [
            "Try reducing video quality to 480p when audio matters most.",
            "Consider using dark mode to save energy on OLED screens.",
            "Close unused tabs to reduce browser memory and energy usage.",
            "Download videos for offline viewing instead of streaming repeatedly.",
            "Use browser bookmarks instead of keeping tabs open."
        ];
        return suggestions[Math.floor(Math.random() * suggestions.length)];
    }

    /**
     * Set API key for OpenAI
     * @param {string} key 
     */
    static setApiKey(key) {
        this.API_KEY = key;
    }
}

export default AISuggestions;
