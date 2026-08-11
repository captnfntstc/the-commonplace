import { useCallback, useEffect, useMemo, useRef, useState, type ImgHTMLAttributes } from 'react'
import { fetchWikipediaArtwork } from '../../metadata'
import { createArtworkPlaceholder, resolveArtworkUrl } from '../../utils/artwork'

type ArtworkStage = 'pending-wikipedia' | 'primary' | 'wikipedia' | 'fallback'
type WikipediaStatus = 'idle' | 'loading' | 'ready' | 'unavailable'

interface AdaptiveGameArtworkProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  src?: string | null
  title: string
  alt?: string
  frameAspect?: number
  minimumVisibleFraction?: number
  preferWikipedia?: boolean
}

function visibleImageFraction(width: number, height: number, frameAspect: number) {
  if (width <= 0 || height <= 0 || frameAspect <= 0) return 1
  const imageAspect = width / height
  return Math.min(imageAspect / frameAspect, frameAspect / imageAspect)
}

function isLikelyGameBackdrop(url: string) {
  const normalized = url.toLowerCase()
  return (
    /(?:media\.rawg\.io|\/rawg-images)\/media\/(?:games|screenshots)\//.test(normalized) ||
    /(?:steamstatic|steamusercontent|\/steam-images).*(?:header|capsule|library_hero)/.test(normalized) ||
    /(?:header|capsule)_\d+x\d+\.(?:jpg|jpeg|png|webp)(?:\?|$)/.test(normalized)
  )
}

export function AdaptiveGameArtwork(props: AdaptiveGameArtworkProps) {
  const sourceKey = typeof props.src === 'string' ? props.src : ''
  return (
    <AdaptiveGameArtworkImage
      key={`${props.title}|${sourceKey}|${Boolean(props.preferWikipedia)}`}
      {...props}
    />
  )
}

function AdaptiveGameArtworkImage({
  src,
  title,
  alt = '',
  frameAspect = 2 / 3,
  minimumVisibleFraction = 0.62,
  preferWikipedia = false,
  className,
  style,
  onLoad,
  onError,
  ...imageProps
}: AdaptiveGameArtworkProps) {
  const fallback = useMemo(() => createArtworkPlaceholder(title, 'Game'), [title])
  const primary = resolveArtworkUrl(src, title, 'Game') || fallback
  const [artwork, setArtwork] = useState(preferWikipedia ? fallback : primary)
  const [stage, setStage] = useState<ArtworkStage>(
    preferWikipedia ? 'pending-wikipedia' : primary === fallback ? 'fallback' : 'primary',
  )
  const [isAccepted, setIsAccepted] = useState(!preferWikipedia && primary === fallback)
  const [wikipediaStatus, setWikipediaStatus] = useState<WikipediaStatus>(
    preferWikipedia ? 'loading' : 'idle',
  )
  const lookupAbortRef = useRef<AbortController | null>(null)

  const showFallback = useCallback(() => {
    setStage('fallback')
    setArtwork(fallback)
    setIsAccepted(true)
  }, [fallback])

  const tryWikipedia = useCallback((failureTarget: 'primary' | 'fallback', markLoading = true) => {
    lookupAbortRef.current?.abort()
    const controller = new AbortController()
    lookupAbortRef.current = controller
    if (markLoading) setWikipediaStatus('loading')

    fetchWikipediaArtwork(title, 'game', controller.signal)
      .then((wikipediaArtwork) => {
        if (controller.signal.aborted) return
        const safeArtwork = resolveArtworkUrl(wikipediaArtwork, title, 'Game')
        if (!safeArtwork || safeArtwork === primary) {
          setWikipediaStatus('unavailable')
          if (failureTarget === 'primary' && primary !== fallback) {
            setStage('primary')
            setArtwork(primary)
            setIsAccepted(false)
          } else {
            showFallback()
          }
          return
        }
        setWikipediaStatus('ready')
        setStage('wikipedia')
        setArtwork(safeArtwork)
        setIsAccepted(false)
      })
      .catch((error) => {
        if ((error as Error)?.name === 'AbortError') return
        setWikipediaStatus('unavailable')
        if (failureTarget === 'primary' && primary !== fallback) {
          setStage('primary')
          setArtwork(primary)
          setIsAccepted(false)
        } else {
          showFallback()
        }
      })
  }, [fallback, primary, showFallback, title])

  useEffect(() => {
    if (!preferWikipedia) return

    const controller = new AbortController()
    lookupAbortRef.current = controller
    fetchWikipediaArtwork(title, 'game', controller.signal)
      .then((wikipediaArtwork) => {
        if (controller.signal.aborted) return
        const safeArtwork = resolveArtworkUrl(wikipediaArtwork, title, 'Game')
        if (!safeArtwork || safeArtwork === primary) {
          setWikipediaStatus('unavailable')
          if (primary !== fallback) {
            setStage('primary')
            setArtwork(primary)
            setIsAccepted(false)
          } else {
            showFallback()
          }
          return
        }

        setWikipediaStatus('ready')
        setStage('wikipedia')
        setArtwork(safeArtwork)
        setIsAccepted(false)
      })
      .catch((error) => {
        if ((error as Error)?.name === 'AbortError') return
        setWikipediaStatus('unavailable')
        if (primary !== fallback) {
          setStage('primary')
          setArtwork(primary)
          setIsAccepted(false)
        } else {
          showFallback()
        }
      })

    return () => controller.abort()
  }, [fallback, preferWikipedia, primary, showFallback, title])

  const handleLoad: NonNullable<ImgHTMLAttributes<HTMLImageElement>['onLoad']> = (event) => {
    const image = event.currentTarget
    const visibleFraction = visibleImageFraction(image.naturalWidth, image.naturalHeight, frameAspect)
    const isBackdropSource = stage === 'primary' && isLikelyGameBackdrop(artwork)

    if (stage === 'pending-wikipedia') return

    if (
      stage === 'fallback' ||
      (!isBackdropSource && visibleFraction >= minimumVisibleFraction) ||
      (stage === 'primary' && wikipediaStatus === 'unavailable' && visibleFraction >= minimumVisibleFraction)
    ) {
      setIsAccepted(true)
    } else if (stage === 'primary' && wikipediaStatus !== 'loading') {
      tryWikipedia('fallback')
    } else {
      showFallback()
    }
    onLoad?.(event)
  }

  const handleError: NonNullable<ImgHTMLAttributes<HTMLImageElement>['onError']> = (event) => {
    if (stage === 'pending-wikipedia') return
    if (stage === 'primary' && wikipediaStatus !== 'unavailable') tryWikipedia('fallback')
    else showFallback()
    onError?.(event)
  }

  return (
    <img
      {...imageProps}
      src={artwork}
      alt={alt}
      className={className}
      style={{
        ...style,
        opacity: isAccepted ? 1 : 0,
        transition: 'opacity 140ms ease',
      }}
      onLoad={handleLoad}
      onError={handleError}
    />
  )
}
