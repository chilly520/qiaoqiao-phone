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
    const { maxWidth = 800, maxHeight = 800, quality = 0.7 } = options;

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

                // Calculate Aspect Ratio
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
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to Base64 (JPEG for better compression, even if input was PNG)
                // If transparency is needed (PNG), using JPEG will add black background.
                // Let's decide based on input type or force JPEG for heavy compression.
                // For general photos, JPEG is best. For stickers/icons, PNG is better but larger.
                // User asked about "memory and token", implying large photos.
                // Let's try to preserve transparency if it's a PNG, but still resize.
                
                let outputType = file.type;
                if (outputType === 'image/png' && file.size > 500 * 1024) {
                    // If PNG is huge, maybe convert to JPEG? No, transparency loss is bad for stickers.
                    // Just resize is usually enough for PNG.
                    // But if it's a photo, JPEG is better.
                    // Let's stick to original type but with quality param (only works for jpeg/webp)
                }
                
                // Note: toDataURL's quality param only works for image/jpeg and image/webp.
                const base64 = canvas.toDataURL(outputType, quality);
                resolve(base64);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}
