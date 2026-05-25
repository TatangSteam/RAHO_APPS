import sharp from 'sharp';

/**
 * Image processing configuration for different use cases
 */
export interface ImageProcessingOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  format: 'jpeg' | 'webp' | 'png';
}

/**
 * Preset configurations for different image types
 */
export const IMAGE_PRESETS: Record<string, ImageProcessingOptions> = {
  // Session photos - high quality for medical documentation
  sessionPhoto: {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 80,
    format: 'jpeg',
  },
  // Profile photos - smaller size for avatars
  profilePhoto: {
    maxWidth: 800,
    maxHeight: 800,
    quality: 85,
    format: 'jpeg',
  },
  // Payment proofs - readable but compressed
  paymentProof: {
    maxWidth: 1200,
    maxHeight: 1600,
    quality: 75,
    format: 'jpeg',
  },
  // PSP/Consent documents - higher quality for readability
  document: {
    maxWidth: 1200,
    maxHeight: 1600,
    quality: 80,
    format: 'jpeg',
  },
  // Thumbnail for previews
  thumbnail: {
    maxWidth: 300,
    maxHeight: 300,
    quality: 70,
    format: 'jpeg',
  },
};

/**
 * Result of image processing
 */
export interface ProcessedImage {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  originalSize: number;
  processedSize: number;
  compressionRatio: number;
}

/**
 * Check if a file is an image based on MIME type
 */
export function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Check if a file is a PDF
 */
export function isPdf(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

/**
 * Process and optimize an image
 * 
 * @param buffer - Original image buffer
 * @param options - Processing options (use presets or custom)
 * @returns Processed image with metadata
 */
export async function processImage(
  buffer: Buffer,
  options: ImageProcessingOptions
): Promise<ProcessedImage> {
  const originalSize = buffer.length;

  // Get original image metadata
  const metadata = await sharp(buffer).metadata();
  
  // Calculate new dimensions while maintaining aspect ratio
  let width = metadata.width || options.maxWidth;
  let height = metadata.height || options.maxHeight;
  
  // Only resize if image is larger than max dimensions
  if (width > options.maxWidth || height > options.maxHeight) {
    const aspectRatio = width / height;
    
    if (width > height) {
      width = Math.min(width, options.maxWidth);
      height = Math.round(width / aspectRatio);
    } else {
      height = Math.min(height, options.maxHeight);
      width = Math.round(height * aspectRatio);
    }
  }

  // Process the image
  let sharpInstance = sharp(buffer)
    .resize(width, height, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .rotate(); // Auto-rotate based on EXIF orientation

  // Apply format-specific compression
  let processedBuffer: Buffer;
  let mimeType: string;

  switch (options.format) {
    case 'webp':
      processedBuffer = await sharpInstance
        .webp({ quality: options.quality })
        .toBuffer();
      mimeType = 'image/webp';
      break;
    case 'png':
      processedBuffer = await sharpInstance
        .png({ quality: options.quality, compressionLevel: 9 })
        .toBuffer();
      mimeType = 'image/png';
      break;
    case 'jpeg':
    default:
      processedBuffer = await sharpInstance
        .jpeg({ quality: options.quality, mozjpeg: true })
        .toBuffer();
      mimeType = 'image/jpeg';
      break;
  }

  const processedSize = processedBuffer.length;
  const compressionRatio = ((originalSize - processedSize) / originalSize) * 100;

  console.log(`[ImageProcessor] Compressed: ${(originalSize / 1024).toFixed(1)}KB → ${(processedSize / 1024).toFixed(1)}KB (${compressionRatio.toFixed(1)}% reduction)`);

  return {
    buffer: processedBuffer,
    mimeType,
    width,
    height,
    originalSize,
    processedSize,
    compressionRatio,
  };
}

/**
 * Process image with a preset configuration
 */
export async function processImageWithPreset(
  buffer: Buffer,
  preset: keyof typeof IMAGE_PRESETS
): Promise<ProcessedImage> {
  const options = IMAGE_PRESETS[preset];
  if (!options) {
    throw new Error(`Unknown image preset: ${preset}`);
  }
  return processImage(buffer, options);
}

/**
 * Process a file - if it's an image, compress it; otherwise return as-is
 * 
 * @param buffer - File buffer
 * @param mimeType - Original MIME type
 * @param preset - Image preset to use
 * @returns Processed buffer and new MIME type
 */
export async function processFile(
  buffer: Buffer,
  mimeType: string,
  preset: keyof typeof IMAGE_PRESETS
): Promise<{ buffer: Buffer; mimeType: string }> {
  // Only process images, not PDFs or other files
  if (!isImage(mimeType)) {
    console.log(`[ImageProcessor] Skipping non-image file: ${mimeType}`);
    return { buffer, mimeType };
  }

  try {
    const processed = await processImageWithPreset(buffer, preset);
    return {
      buffer: processed.buffer,
      mimeType: processed.mimeType,
    };
  } catch (error) {
    console.error('[ImageProcessor] Error processing image, using original:', error);
    return { buffer, mimeType };
  }
}

/**
 * Generate a thumbnail from an image
 */
export async function generateThumbnail(buffer: Buffer): Promise<Buffer> {
  const processed = await processImageWithPreset(buffer, 'thumbnail');
  return processed.buffer;
}
