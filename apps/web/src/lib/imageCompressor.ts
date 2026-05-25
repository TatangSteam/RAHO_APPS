/**
 * Client-side image compression utility
 * Compresses images before uploading to reduce bandwidth and server load
 */

export interface CompressionOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number; // 0-1
  mimeType: 'image/jpeg' | 'image/webp' | 'image/png';
}

export interface CompressionResult {
  blob: Blob;
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  width: number;
  height: number;
}

/**
 * Preset configurations for different image types
 */
export const COMPRESSION_PRESETS: Record<string, CompressionOptions> = {
  // Session photos - high quality for medical documentation
  sessionPhoto: {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 0.8,
    mimeType: 'image/jpeg',
  },
  // Profile photos - smaller size for avatars
  profilePhoto: {
    maxWidth: 800,
    maxHeight: 800,
    quality: 0.85,
    mimeType: 'image/jpeg',
  },
  // Payment proofs - readable but compressed
  paymentProof: {
    maxWidth: 1200,
    maxHeight: 1600,
    quality: 0.75,
    mimeType: 'image/jpeg',
  },
  // Documents - higher quality for readability
  document: {
    maxWidth: 1200,
    maxHeight: 1600,
    quality: 0.8,
    mimeType: 'image/jpeg',
  },
  // Thumbnail for previews
  thumbnail: {
    maxWidth: 300,
    maxHeight: 300,
    quality: 0.7,
    mimeType: 'image/jpeg',
  },
};

/**
 * Check if a file is an image
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Load an image from a File object
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Calculate new dimensions while maintaining aspect ratio
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = originalWidth;
  let height = originalHeight;

  // Only resize if image is larger than max dimensions
  if (width > maxWidth || height > maxHeight) {
    const aspectRatio = width / height;

    if (width > height) {
      width = Math.min(width, maxWidth);
      height = Math.round(width / aspectRatio);
    } else {
      height = Math.min(height, maxHeight);
      width = Math.round(height * aspectRatio);
    }
  }

  return { width, height };
}

/**
 * Compress an image file
 * 
 * @param file - Original image file
 * @param options - Compression options
 * @returns Compressed image as File
 */
export async function compressImage(
  file: File,
  options: CompressionOptions
): Promise<CompressionResult> {
  // Skip non-image files
  if (!isImageFile(file)) {
    return {
      blob: file,
      file: file,
      originalSize: file.size,
      compressedSize: file.size,
      compressionRatio: 0,
      width: 0,
      height: 0,
    };
  }

  const img = await loadImage(file);
  const { width, height } = calculateDimensions(
    img.width,
    img.height,
    options.maxWidth,
    options.maxHeight
  );

  // Create canvas and draw resized image
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Use high-quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw the image
  ctx.drawImage(img, 0, 0, width, height);

  // Clean up object URL
  URL.revokeObjectURL(img.src);

  // Convert to blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to compress image'));
        }
      },
      options.mimeType,
      options.quality
    );
  });

  // Create new File from blob
  const extension = options.mimeType === 'image/jpeg' ? 'jpg' : 
                    options.mimeType === 'image/webp' ? 'webp' : 'png';
  const newFileName = file.name.replace(/\.[^/.]+$/, `.${extension}`);
  const compressedFile = new File([blob], newFileName, { type: options.mimeType });

  const compressionRatio = ((file.size - blob.size) / file.size) * 100;

  console.log(
    `[ImageCompressor] Compressed: ${(file.size / 1024).toFixed(1)}KB → ${(blob.size / 1024).toFixed(1)}KB (${compressionRatio.toFixed(1)}% reduction)`
  );

  return {
    blob,
    file: compressedFile,
    originalSize: file.size,
    compressedSize: blob.size,
    compressionRatio,
    width,
    height,
  };
}

/**
 * Compress an image using a preset configuration
 */
export async function compressImageWithPreset(
  file: File,
  preset: keyof typeof COMPRESSION_PRESETS
): Promise<CompressionResult> {
  const options = COMPRESSION_PRESETS[preset];
  if (!options) {
    throw new Error(`Unknown compression preset: ${preset}`);
  }
  return compressImage(file, options);
}

/**
 * Compress multiple images
 */
export async function compressImages(
  files: File[],
  preset: keyof typeof COMPRESSION_PRESETS
): Promise<CompressionResult[]> {
  return Promise.all(files.map((file) => compressImageWithPreset(file, preset)));
}

/**
 * Create a preview URL for an image (with optional compression)
 */
export async function createImagePreview(
  file: File,
  maxSize: number = 300
): Promise<string> {
  if (!isImageFile(file)) {
    return '';
  }

  const result = await compressImage(file, {
    maxWidth: maxSize,
    maxHeight: maxSize,
    quality: 0.7,
    mimeType: 'image/jpeg',
  });

  return URL.createObjectURL(result.blob);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
