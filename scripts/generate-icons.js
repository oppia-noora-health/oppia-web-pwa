const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const sizes = [
  { size: 72, name: "logo/icon-72x72.png" },
  { size: 96, name: "logo/icon-96x96.png" },
  { size: 128, name: "logo/icon-128x128.png" },
  { size: 144, name: "logo/icon-144x144.png" },
  { size: 152, name: "logo/icon-152x152.png" },
  { size: 192, name: "logo/icon-192x192.png" },
  { size: 384, name: "logo/icon-384x384.png" },
  { size: 512, name: "logo/icon-512x512.png" },
  { size: 180, name: "logo/apple-touch-icon.png" },
];

const maskableSizes = [
  { size: 192, name: "logo/icon-maskable-192x192.png" },
  { size: 512, name: "logo/icon-maskable-512x512.png" },
];

const inputSvg = path.join(__dirname, "../public/logo/logo-icon.svg");
const outputDir = path.join(__dirname, "../public");

async function generateIcons() {
  try {
    // Check if logo.svg exists
    if (!fs.existsSync(inputSvg)) {
      return;
    }

    // Generate standard icons
    for (const { size, name } of sizes) {
      const outputPath = path.join(outputDir, name);
      await sharp(inputSvg)
        .resize(size, size, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 0 },
        })
        .png()
        .toFile(outputPath);
    }

    // Generate maskable icons (with padding for safe zone and solid background)
    for (const { size, name } of maskableSizes) {
      const outputPath = path.join(outputDir, name);
      const padding = Math.floor(size * 0.1); // 10% padding on each side (safe zone)
      const logoSize = Math.floor(size * 0.8); // Logo is 80% of icon size
      await sharp(inputSvg)
        .resize(logoSize, logoSize, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 0 },
        })
        .png()
        .toBuffer()
        .then((logoBuffer) =>
          sharp({
            create: {
              width: size,
              height: size,
              channels: 4,
              background: { r: 255, g: 255, b: 255, alpha: 1 }, // Solid white background
            },
          })
            .composite([
              {
                input: logoBuffer,
                gravity: "center",
              },
            ])
            .png()
            .toFile(outputPath)
        );
    }

    // Generate favicon
    await sharp(inputSvg)
      .resize(32, 32, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png()
      .toFile(path.join(outputDir, "favicon-32x32.png"));
  } catch (error) {}
}

generateIcons();
