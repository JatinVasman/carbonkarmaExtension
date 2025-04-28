// YouTube video quality scanner
const browser = window.browser || window.chrome;

// Quality to resolution mapping
const QUALITY_MAP = {
    'hd2160': '4k',
    'hd1440': '1440p',
    'hd1080': '1080p',
    'hd720': '720p',
    'large': '480p',
    'medium': '360p',
    'small': '240p',
    'tiny': '144p'
};

/**
 * Detect video quality changes
 */
function detectQualityChanges() {
    const video = document.querySelector('video');
    if (!video) return;

    // Create quality observer
    const observer = new MutationObserver(() => {
        const player = document.querySelector('.html5-video-player');
        if (!player) return;

        const quality = player.getPlaybackQuality?.() || 
                       player.getAttribute('data-quality') ||
                       'hd720'; // Default to 720p if can't detect

        // Send quality update to background script
        browser.runtime.sendMessage({
            type: 'VIDEO_QUALITY_CHANGE',
            resolution: QUALITY_MAP[quality] || '720p'
        });
    });

    // Observe video player for quality changes
    const player = document.querySelector('.html5-video-player');
    if (player) {
        observer.observe(player, {
            attributes: true,
            attributeFilter: ['data-quality']
        });
    }
}

// Initialize detection
detectQualityChanges();

// Re-run on dynamic page updates
const pageObserver = new MutationObserver(detectQualityChanges);
pageObserver.observe(document.body, {
    childList: true,
    subtree: true
});
