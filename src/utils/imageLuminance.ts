const luminanceCache = new Map<string, 'dark' | 'light'>()

/**
 * Calculates the relative perceived luminance from RGB values using ITU-R BT.709.
 */
export function calculateLuminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Samples the top-left region of an image (where card badges are placed)
 * and determines if the background is 'dark' or 'light'.
 */
export function detectImageLuminance(
  imageUrl: string,
  onResult: (theme: 'dark' | 'light') => void,
): void {
  if (!imageUrl || typeof window === 'undefined' || typeof Image === 'undefined') return

  if (luminanceCache.has(imageUrl)) {
    onResult(luminanceCache.get(imageUrl)!)
    return
  }

  // Handle data URLs directly
  if (imageUrl.startsWith('data:')) {
    sampleImage(imageUrl, false, onResult)
    return
  }

  // Handle web URLs with anonymous CORS
  sampleImage(imageUrl, true, onResult)
}

function sampleImage(
  src: string,
  useCors: boolean,
  onResult: (theme: 'dark' | 'light') => void,
): void {
  const img = new Image()
  if (useCors) {
    img.crossOrigin = 'anonymous'
  }

  img.onload = () => {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 16
      canvas.height = 16
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return

      // Sample top-left corner: 35% width, 25% height where pill badge sits
      const sampleW = Math.max(1, Math.round((img.naturalWidth || 100) * 0.35))
      const sampleH = Math.max(1, Math.round((img.naturalHeight || 100) * 0.25))

      ctx.drawImage(img, 0, 0, sampleW, sampleH, 0, 0, 16, 16)
      const { data } = ctx.getImageData(0, 0, 16, 16)

      let totalLum = 0
      let samples = 0

      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3]
        if (a > 64) {
          totalLum += calculateLuminance(data[i], data[i + 1], data[i + 2])
          samples++
        }
      }

      if (samples > 0) {
        const avg = totalLum / samples
        const theme: 'dark' | 'light' = avg < 135 ? 'dark' : 'light'
        luminanceCache.set(src, theme)
        onResult(theme)
      }
    } catch {
      // CORS blocked canvas access - gracefully ignore
    }
  }

  img.src = src
}
