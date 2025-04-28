// Light mode detector content script
function detectLightMode() {
    // Get computed background color of body
    const bodyBg = window.getComputedStyle(document.body).backgroundColor;
    const bodyColor = window.getComputedStyle(document.body).color;
    
    // Convert colors to RGB values
    const bgRgb = bodyBg.match(/\d+/g).map(Number);
    const textRgb = bodyColor.match(/\d+/g).map(Number);
    
    // Calculate relative luminance
    const bgLuminance = (0.299 * bgRgb[0] + 0.587 * bgRgb[1] + 0.114 * bgRgb[2]) / 255;
    const textLuminance = (0.299 * textRgb[0] + 0.587 * textRgb[1] + 0.114 * textRgb[2]) / 255;
    
    // Higher luminance indicates lighter background
    const isLightMode = bgLuminance > 0.5;
    
    // Send message to background script
    browser.runtime.sendMessage({
        type: 'LIGHT_MODE_STATUS',
        isLightMode: isLightMode,
        contrast: Math.abs(bgLuminance - textLuminance)
    });
}

// Run detection on page load
detectLightMode();

// Watch for theme changes
const observer = new MutationObserver(() => {
    detectLightMode();
});

// Observe changes to document attributes and body
observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme']
});

observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class', 'data-theme']
});

// Listen for system color scheme changes
window.matchMedia('(prefers-color-scheme: dark)').addListener(() => {
    detectLightMode();
});
