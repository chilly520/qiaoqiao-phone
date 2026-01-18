/**
 * Compress an image file using Canvas.
 * @param {File} file - The image file to compress.
 * @param {Object} options - Compression options.
 * @param {number} [options.maxWidth=800] - Max width of the output image.
 * @param {number} [options.maxHeight=800] - Max height of the output image.
 * @param {number} [options.quality=0.7] - Quality of the output JPEG (0 to 1).
 * @returns {Promise<string>} - Resolves with the compressed Base64 data URL.
 */
export function compressImage(file, options = {}) {
    // Aggressive defaults for LocalStorage survival (Goal: < 200KB per image)
    const { maxWidth = 600, maxHeight = 600, quality = 0.6 } = options;

    return new Promise((resolve, reject) => {
        if (!file) {
            reject(new Error('No file provided'));
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // 1. Resize Logic (Maintain Aspect Ratio)
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');

                // 2. Format Logic
                let outputType = file.type;
                let outputQuality = quality;

                // Smart Detection: If PNG is > 500KB, likely a photo/screenshot -> Convert to JPEG
                // Unless transparency is critical (but we can't easily know that, assume space > transparency for photos)
                if (file.type === 'image/png' && file.size > 500 * 1024) {
                    // Fill white background to handle transparency becoming black in JPEG
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, width, height);
                    outputType = 'image/jpeg';
                    // outputQuality remain 0.6
                }

                ctx.drawImage(img, 0, 0, width, height);

                // 3. Export
                // Note: toDataURL quality argument only works for image/jpeg and image/webp
                if (outputType === 'image/png') {
                    // Try to use WebP for PNGs if supported (smaller than PNG, keeps transparency)
                    const base64 = canvas.toDataURL('image/webp', quality);
                    if (base64.startsWith('data:image/webp')) {
                        resolve(base64);
                        return;
                    }
                }

                const base64 = canvas.toDataURL(outputType, outputQuality);
                resolve(base64);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}
