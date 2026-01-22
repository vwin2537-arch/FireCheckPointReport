/**
 * Image Compression Utility
 * - Max width: 1920px (Full HD)
 * - Quality: 85% (good for reports and LINE)
 * - Format: JPEG
 */

export interface CompressionOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
}

const DEFAULT_OPTIONS: CompressionOptions = {
    maxWidth: 1920,
    maxHeight: 1920,
    quality: 0.85,
};

/**
 * Compress a base64 image to reduce file size
 * @param base64Image - The original base64 image string
 * @param options - Compression options
 * @returns Promise<string> - Compressed base64 image
 */
export const compressImage = async (
    base64Image: string,
    options: CompressionOptions = {}
): Promise<string> => {
    const { maxWidth, maxHeight, quality } = { ...DEFAULT_OPTIONS, ...options };

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            // Calculate new dimensions while maintaining aspect ratio
            let { width, height } = img;

            if (width > maxWidth!) {
                height = (height * maxWidth!) / width;
                width = maxWidth!;
            }

            if (height > maxHeight!) {
                width = (width * maxHeight!) / height;
                height = maxHeight!;
            }

            // Create canvas for compression
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }

            // Draw image with smooth scaling
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to JPEG with specified quality
            const compressedBase64 = canvas.toDataURL('image/jpeg', quality);

            // Log compression ratio for debugging
            const originalSize = base64Image.length;
            const compressedSize = compressedBase64.length;
            const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
            console.log(`Image compressed: ${(originalSize / 1024).toFixed(0)}KB -> ${(compressedSize / 1024).toFixed(0)}KB (${ratio}% reduction)`);

            resolve(compressedBase64);
        };

        img.onerror = () => {
            reject(new Error('Failed to load image for compression'));
        };

        img.src = base64Image;
    });
};

/**
 * Compress multiple images in parallel
 * @param images - Array of base64 images
 * @param options - Compression options
 * @param onProgress - Progress callback (0-100)
 * @returns Promise<string[]> - Array of compressed base64 images
 */
export const compressImages = async (
    images: string[],
    options: CompressionOptions = {},
    onProgress?: (progress: number) => void
): Promise<string[]> => {
    const results: string[] = [];

    for (let i = 0; i < images.length; i++) {
        const compressed = await compressImage(images[i], options);
        results.push(compressed);

        if (onProgress) {
            onProgress(Math.round(((i + 1) / images.length) * 100));
        }
    }

    return results;
};
