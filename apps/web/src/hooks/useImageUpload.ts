'use client';

import { assertCaughtError } from '@/lib/caughtError';
import { useState, useCallback } from 'react';
import { 
  compressImageWithPreset, 
  isImageFile, 
  formatFileSize,
  COMPRESSION_PRESETS,
  type CompressionResult 
} from '@/lib/imageCompressor';

export interface UploadState {
  isCompressing: boolean;
  isUploading: boolean;
  progress: number;
  error: string | null;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

export interface UseImageUploadOptions {
  preset?: keyof typeof COMPRESSION_PRESETS;
  maxSizeMB?: number;
  onCompressionComplete?: (result: CompressionResult) => void;
  onUploadComplete?: (response: unknown) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for handling image uploads with automatic compression
 */
export function useImageUpload(options: UseImageUploadOptions = {}) {
  const {
    preset = 'document',
    maxSizeMB = 10,
    onCompressionComplete,
    onUploadComplete,
    onError,
  } = options;

  const [state, setState] = useState<UploadState>({
    isCompressing: false,
    isUploading: false,
    progress: 0,
    error: null,
    originalSize: 0,
    compressedSize: 0,
    compressionRatio: 0,
  });

  const [preview, setPreview] = useState<string | null>(null);

  /**
   * Process and compress a file
   */
  const processFile = useCallback(async (file: File): Promise<File> => {
    // Validate file size
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new Error(`File terlalu besar. Maksimal ${maxSizeMB}MB`);
    }

    // If not an image, return as-is
    if (!isImageFile(file)) {
      setState(prev => ({
        ...prev,
        originalSize: file.size,
        compressedSize: file.size,
        compressionRatio: 0,
      }));
      return file;
    }

    setState(prev => ({ ...prev, isCompressing: true, error: null }));

    try {
      const result = await compressImageWithPreset(file, preset);
      
      setState(prev => ({
        ...prev,
        isCompressing: false,
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        compressionRatio: result.compressionRatio,
      }));

      // Create preview URL
      const previewUrl = URL.createObjectURL(result.blob);
      setPreview(previewUrl);

      onCompressionComplete?.(result);

      return result.file;
    } catch (error) {
      assertCaughtError(error);
      const err = error instanceof Error ? error : new Error('Gagal mengkompresi gambar');
      setState(prev => ({ ...prev, isCompressing: false, error: err.message }));
      onError?.(err);
      throw err;
    }
  }, [preset, maxSizeMB, onCompressionComplete, onError]);

  /**
   * Upload a file with compression
   */
  const uploadFile = useCallback(async <T,>(
    file: File,
    uploadFn: (file: File) => Promise<T>
  ): Promise<T> => {
    setState(prev => ({ ...prev, isUploading: true, progress: 0, error: null }));

    try {
      // Process/compress the file first
      const processedFile = await processFile(file);

      // Upload the processed file
      setState(prev => ({ ...prev, progress: 50 }));
      const response = await uploadFn(processedFile);
      
      setState(prev => ({ ...prev, isUploading: false, progress: 100 }));
      onUploadComplete?.(response);

      return response;
    } catch (error) {
      assertCaughtError(error);
      const err = error instanceof Error ? error : new Error('Gagal mengupload file');
      setState(prev => ({ ...prev, isUploading: false, error: err.message }));
      onError?.(err);
      throw err;
    }
  }, [processFile, onUploadComplete, onError]);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setPreview(null);
    setState({
      isCompressing: false,
      isUploading: false,
      progress: 0,
      error: null,
      originalSize: 0,
      compressedSize: 0,
      compressionRatio: 0,
    });
  }, [preview]);

  /**
   * Get compression stats as formatted string
   */
  const getCompressionStats = useCallback(() => {
    if (state.originalSize === 0) return null;
    
    return {
      original: formatFileSize(state.originalSize),
      compressed: formatFileSize(state.compressedSize),
      saved: formatFileSize(state.originalSize - state.compressedSize),
      ratio: `${state.compressionRatio.toFixed(1)}%`,
    };
  }, [state.originalSize, state.compressedSize, state.compressionRatio]);

  return {
    ...state,
    preview,
    processFile,
    uploadFile,
    reset,
    getCompressionStats,
    isProcessing: state.isCompressing || state.isUploading,
  };
}

export default useImageUpload;
