/**
 * Client-side image compression using the Canvas API.
 * No external library needed — works in all modern browsers and Capacitor WebView.
 *
 * iOS Note: HEIC images from the camera are decoded by Safari/WebKit before onload fires,
 * so compression works correctly on both iOS and Android.
 */

/**
 * Compresses an image File/Blob to a JPEG Blob.
 *
 * @param {File|Blob} file - The source image file
 * @param {object} options
 * @param {number} options.maxWidth  - Max width in px (default 1200)
 * @param {number} options.maxHeight - Max height in px (default 1200)
 * @param {number} options.quality   - JPEG quality 0–1 (default 0.82)
 * @returns {Promise<Blob>} Compressed JPEG blob
 */
export const compressImage = (file, { maxWidth = 1200, maxHeight = 1200, quality = 0.82 } = {}) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url); // critical: free memory immediately

      let { width, height } = img;

      // Scale down proportionally
      if (width > maxWidth) {
        height = Math.round((maxWidth / width) * height);
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = Math.round((maxHeight / height) * width);
        height = maxHeight;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('canvas.toBlob failed'));
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for compression'));
    };

    img.src = url;
  });
};

/**
 * Validates that a file is an allowed image type.
 * Handles iOS HEIC where file.type may be empty.
 *
 * @param {File} file
 * @returns {boolean}
 */
export const isAllowedImageType = (file) => {
  const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif'];
  const ALLOWED_EXT = /\.(jpg|jpeg|png|webp|heic|heif|gif)$/i;
  return ALLOWED_MIME.includes(file.type) || ALLOWED_EXT.test(file.name);
};
