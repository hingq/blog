import NextImage, { ImageProps } from 'next/image'

const basePath = process.env.BASE_PATH

type FlexibleImageProps = Omit<ImageProps, 'height' | 'width'> & {
  height?: ImageProps['height']
  width?: ImageProps['width']
}

const Image = ({
  src,
  alt,
  height,
  width,
  fill,
  className,
  style,
  loading,
}: FlexibleImageProps) => {
  const resolvedSrc =
    typeof src === 'string' && src.startsWith('/') ? `${basePath || ''}${src}` : src

  if (typeof src !== 'string' || fill || (height !== undefined && width !== undefined)) {
    return (
      <NextImage
        alt={alt}
        className={className}
        fill={fill}
        height={height}
        loading={loading}
        src={resolvedSrc}
        style={style}
        width={width}
      />
    )
  }

  // Markdown images generally do not carry intrinsic dimensions. A native image is the only
  // honest fallback here: inventing width/height values would distort the image or its ratio.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      className={`h-auto max-w-full${className ? ` ${className}` : ''}`}
      decoding="async"
      loading={loading}
      src={resolvedSrc as string}
      style={style}
    />
  )
}

export default Image
