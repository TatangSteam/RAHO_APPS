import Image, { type ImageProps } from 'next/image';

type AppImageProps = Omit<ImageProps, 'src' | 'width' | 'height'> & {
  src?: string | null;
  width?: number;
  height?: number;
};

/** Image wrapper for protected/blob URLs and legacy responsive image styles. */
export default function AppImage({
  src,
  alt,
  width = 800,
  height = 600,
  ...props
}: AppImageProps) {
  if (!src) return null;

  return (
    <Image
      {...props}
      src={src}
      alt={alt}
      width={width}
      height={height}
      unoptimized
    />
  );
}
