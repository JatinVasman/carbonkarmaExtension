const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sizes = [16, 32, 48, 128];
const inputDir = path.join(__dirname, '..', 'assets', 'icons');
const outputDir = path.join(__dirname, '..', 'assets', 'icons');

async function convertSvgToPng(size) {
    const inputPath = path.join(inputDir, `icon-${size}x${size}.svg`);
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);

    await sharp(inputPath)
        .resize(size, size)
        .png()
        .toFile(outputPath);
    
    console.log(`Converted ${size}x${size} icon`);
}

async function main() {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Convert all sizes
    await Promise.all(sizes.map(size => convertSvgToPng(size)));
    console.log('All icons converted successfully!');
}

main().catch(console.error);
