'use client';

import Image, { ImageProps } from 'next/image';
import { useState, useCallback } from 'react';

interface OptimizedImageProps extends Omit<ImageProps, 'src'> {
  src: string | null | undefined;
  fallbackSrc?: string;
  showPlaceholder?: boolean;
  placeholderText?: string;
}

/**
 * Optimized Image component that wraps Next.js Image with:
 * - Automatic lazy loading
 * - Error handling with fallback
 * - Loading placeholder
 * - Support for API URLs
 */
export function OptimizedImage({
  src,
  alt,
  fallbackSrc: _fallbackSrc = '/images/placeholder.png',
  showPlaceholder = true,
  placeholderText = 'No Image',
  className = '',
  width,
  height,
  fill,
  ...props
}: OptimizedImageProps) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const handleError = useCallback(() => {
    setError(true);
    setLoading(false);
  }, []);

  const handleLoad = useCallback(() => {
    setLoading(false);
  }, []);

  // If no src or error, show placeholder
  if (!src || error) {
    if (!showPlaceholder) return null;
    
    return (
      <div 
        className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-400 ${className}`}
        style={{ 
          width: fill ? '100%' : width, 
          height: fill ? '100%' : height,
          position: fill ? 'absolute' : 'relative',
          inset: fill ? 0 : undefined,
        }}
      >
        <span className="text-sm">{placeholderText}</span>
      </div>
    );
  }

  // Convert API URL to proper format for Next.js Image
  const imageSrc = normalizeImageUrl(src);

  return (
    <div className={`relative ${fill ? 'w-full h-full' : ''}`}>
      {loading && showPlaceholder && (
        <div 
          className={`absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 animate-pulse ${className}`}
        >
          <svg className="w-8 h-8 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
            <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}
      <Image
        src={imageSrc}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        fill={fill}
        className={className}
        onError={handleError}
        onLoad={handleLoad}
        loading="lazy"
        {...props}
      />
    </div>
  );
}

/**
 * Normalize image URL for Next.js Image component
 * Handles various URL formats from the API
 */
function normalizeImageUrl(url: string): string {
  if (!url) return '';
  
  // If it's already a full URL, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // If it's a relative API path, prepend the API URL
  if (url.startsWith('/api/')) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    return `${apiUrl}${url}`;
  }
  
  // If it starts with /, assume it's relative to current origin
  if (url.startsWith('/')) {
    return url;
  }
  
  // Otherwise, assume it's a relative path
  return `/${url}`;
}

/**
 * Avatar component with optimized loading
 */
interface AvatarProps {
  src: string | null | undefined;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  fallbackInitials?: string;
}

const AVATAR_SIZES = {
  sm: { width: 32, height: 32, text: 'text-xs' },
  md: { width: 40, height: 40, text: 'text-sm' },
  lg: { width: 64, height: 64, text: 'text-base' },
  xl: { width: 96, height: 96, text: 'text-lg' },
};

export function Avatar({
  src,
  alt,
  size = 'md',
  className = '',
  fallbackInitials,
}: AvatarProps) {
  const [error, setError] = useState(false);
  const { width, height, text } = AVATAR_SIZES[size];

  // Get initials from alt text
  const initials = fallbackInitials || alt
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (!src || error) {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-300 font-medium ${text} ${className}`}
        style={{ width, height }}
      >
        {initials}
      </div>
    );
  }

  const imageSrc = normalizeImageUrl(src);

  return (
    <div
      className={`relative rounded-full overflow-hidden ${className}`}
      style={{ width, height }}
    >
      <Image
        src={imageSrc}
        alt={alt}
        fill
        className="object-cover"
        onError={() => setError(true)}
        sizes={`${width}px`}
      />
    </div>
  );
}

export default OptimizedImage;
