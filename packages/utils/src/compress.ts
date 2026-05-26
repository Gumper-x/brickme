import { getImageDimensions } from './media'

export interface CompressImageOptions {
  force?: boolean
  height?: number
  size: number
  width?: number
}

export interface CompressImageResult {
  compressedSize: number
  compressionRatio: number
  file: File
  originalSize: number
}

export async function compressImage(
  file: File,
  options: CompressImageOptions,
  progress?: (progress: number) => void,
): Promise<CompressImageResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Unsupported file type')
  }

  const { height, size, width } = options
  const originalSize = file.size
  const { height: imageHeight, width: imageWidth } = await getImageDimensions(file)

  const needsResize = (width !== undefined && imageWidth > width) || (height !== undefined && imageHeight > height)
  const needsCompressionBySize = originalSize > size

  if (!needsResize && !needsCompressionBySize && options.force !== true) {
    return {
      compressedSize: originalSize,
      compressionRatio: 1,
      file,
      originalSize,
    }
  }

  const maxWidthOrHeight = calculateMaxSide(imageWidth, imageHeight, width, height)
  const imageCompression = (await import('browser-image-compression')).default
  const compressedFile = await imageCompression(file, {
    fileType: 'image/webp',
    maxSizeMB: size / 1024 / 1024,
    maxWidthOrHeight,
    onProgress: (value) => {
      progress?.(value)
    },
    useWebWorker: true,
  })

  return {
    compressedSize: compressedFile.size,
    compressionRatio: originalSize / compressedFile.size,
    file: compressedFile,
    originalSize,
  }
}

export async function normalizeImageHeic(type: string, file: File): Promise<File> {
  const isHeic =
    type === 'image/heic' ||
    type === 'image/heif' ||
    file.name.toLowerCase().endsWith('.heic') ||
    file.name.toLowerCase().endsWith('.heif')

  if (!isHeic) {
    return file
  }

  const { heicTo } = await import('heic-to')
  const jpegBlob = await heicTo({
    blob: file,
    quality: 0.95,
    type: 'image/jpeg',
  })

  return new File([jpegBlob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
    lastModified: Date.now(),
    type: 'image/jpeg',
  })
}

function calculateMaxSide(
  width: number,
  height: number,
  maxWidth?: number,
  maxHeight?: number,
): number | undefined {
  if (!maxWidth && !maxHeight) {
    return undefined
  }

  const widthRatio = maxWidth ? maxWidth / width : Infinity
  const heightRatio = maxHeight ? maxHeight / height : Infinity

  return Math.round(Math.max(width, height) * Math.min(widthRatio, heightRatio, 1))
}
