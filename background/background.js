import browser from 'webextension-polyfill';
import { storageService } from '../services/storageService';

// Message handlers for data management
browser.runtime.onMessage.addListener(async (message) => {
    try {
        switch (message.type) {
            case 'EXPORT_DATA':
                const data = await storageService.getAllData();
                const metadata = {
                    version: browser.runtime.getManifest().version,
                    timestamp: new Date().toISOString(),
                    type: 'carbonkarma_backup'
                };

                const backup = {
                    metadata,
                    data
                };

                // Create blob and URL
                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const filename = `carbonkarma_backup_${new Date().toISOString().split('T')[0]}.json`;

                return { url, filename };

            case 'VALIDATE_BACKUP':
                const backupData = JSON.parse(message.data);
                
                // Validate backup structure
                if (!backupData.metadata || !backupData.data) {
                    throw new Error('Invalid backup format');
                }

                // Validate backup type
                if (backupData.metadata.type !== 'carbonkarma_backup') {
                    throw new Error('Invalid backup type');
                }

                // Validate data structure
                const isValid = await storageService.validateData(backupData.data);
                return { valid: isValid };

            case 'IMPORT_DATA':
                const importData = JSON.parse(message.data);
                
                // Validate again before import
                const validation = await storageService.validateData(importData.data);
                if (!validation) {
                    throw new Error('Invalid data structure');
                }

                // Import data
                await storageService.importData(importData.data);
                return { success: true };

            case 'GET_ACHIEVEMENT_DETAILS':
                const achievement = await storageService.getAchievementDetails(message.id);
                return achievement;

            default:
                return false;
        }
    } catch (error) {
        console.error('Background script error:', error);
        throw error;
    }
});

// Initialize storage service
storageService.init();

// Initialize extension
async function initializeExtension() {
    try {
        // Initialize storage and other services
        await browser.runtime.sendMessage({ type: 'EXTENSION_INITIALIZED' });
    } catch (error) {
        console.error('Extension initialization failed:', error);
    }
}

// Listen for installation
browser.runtime.onInstalled.addListener(async () => {
    await initializeExtension();
});

// Listen for messages
browser.runtime.onMessage.addListener((message, sender) => {
    // Handle extension messages
    if (message.type === 'EXTENSION_INITIALIZED') {
        console.log('Extension initialized successfully');
    }
});
