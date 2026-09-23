import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  FileText,
  Loader2,
  Music4,
  Quote,
  Save,
  Search,
  Star,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import {
  fetchLyrics,
  getCachedMetadata,
  searchMetadata,
  type MetadataResult,
} from '../../../metadata'
import { FormattingToolbar } from '../../../components/FormattingToolbar/FormattingToolbar'
import { RichTextEditor } from '../../../components/RichTextEditor/RichTextEditor'
import { type Alignment } from '../../../components/CommonplaceCard/FormattedText'
import { AdaptiveGameArtwork } from '../../../components/GameArtwork/AdaptiveGameArtwork'
import { resolveArtworkUrl } from '../../../utils/artwork'
import { useAccessibleDialog } from '../../../hooks/useAccessibleDialog'
import {
  localGameMetadataResults,
  mergeMetadataSearchResults,
  rankMetadataSearchResults,
} from '../../search/metadataSearch'
import {
  draftFromMetadata,
  emptyDraft,
  entryTypes,
  getDefaultCoverTone,
  getTypeMeta,
  usesSquareArtwork,
  type Entry,
  type EntryDraft,
  type EntryType,
} from '../model'
import { entryDraftsMatch, type SavedEntryDraft } from '../draftStorage'

const WARN_UNRATED_KEY = 'the-commonplace.warn-unrated'
const MAX_SELECTED_LYRIC_LINES = 4
const MAX_NOTABLE_LINE_CHARACTERS = 250
const EMPTY_COMMUNITY_ENTRIES: Entry[] = []
const EMPTY_SAVED_DRAFTS: SavedEntryDraft[] = []

function getWarnUnratedPreference(): boolean {
  const stored = localStorage.getItem(WARN_UNRATED_KEY)
  return stored === null ? true : stored !== 'false'
}

function setWarnUnratedPreference(val: boolean) {
  localStorage.setItem(WARN_UNRATED_KEY, String(val))
}

function getMatchingLyricIndexes(lyricsText: string, favoritePassageText: string): number[] {
  if (!lyricsText || !favoritePassageText) return []
  const lyricLines = lyricsText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const cleanedPassage = favoritePassageText
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
  const passageLines = cleanedPassage.split(/\r?\n/).map((line) => line.trim().toLowerCase()).filter(Boolean)
  if (passageLines.length === 0) return []
  const matched: number[] = []
  lyricLines.forEach((line, index) => {
    const normalizedLine = line.toLowerCase()
    if (passageLines.some((passageLine) =>
      passageLine === normalizedLine ||
      (passageLine.length > 4 && normalizedLine.length > 4 &&
        (passageLine.includes(normalizedLine) || normalizedLine.includes(passageLine))),
    )) matched.push(index)
  })
  return matched.slice(0, MAX_SELECTED_LYRIC_LINES)
}

function TypeIconBar({
  value,
  onChange,
  disabled,
}: {
  value: EntryType
  onChange: (type: EntryType) => void
  disabled?: boolean
}) {
  const [hoveredType, setHoveredType] = useState<EntryType | null>(null)
  const [focusedType, setFocusedType] = useState<EntryType | null>(null)
  const visibleTooltip = hoveredType ?? focusedType

  return (
    <div className="type-icon-bar" onMouseLeave={() => setHoveredType(null)}>
      {entryTypes.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={`type-icon-btn ${value === id ? 'active' : ''}`}
          onClick={() => !disabled && onChange(id)}
          onMouseEnter={() => {
            setHoveredType(id)
            if (focusedType && focusedType !== id && document.activeElement instanceof HTMLElement) {
              document.activeElement.blur()
              setFocusedType(null)
            }
          }}
          onFocus={() => setFocusedType(id)}
          onBlur={() => setFocusedType((current) => current === id ? null : current)}
          disabled={disabled}
          aria-label={label}
        >
          <Icon aria-hidden="true" style={{ width: 18, height: 18 }} />
          <span className={`type-icon-tooltip ${visibleTooltip === id ? 'is-visible' : ''}`}>{label}</span>
        </button>
      ))}
    </div>
  )
}

export function EntryComposer({
  entry,
  initialDraft: initialDraftSeed,
  initialLyrics = '',
  onClose,
  onSave,
  communityEntries = EMPTY_COMMUNITY_ENTRIES,
  savedDrafts = EMPTY_SAVED_DRAFTS,
  activeDraftId = null,
  draftsInitiallyOpen = false,
  onSaveDraft,
  onSelectDraft,
  onDeleteDraft,
  isOnline = true,
}: {
  entry: Entry | null
  initialDraft?: EntryDraft | null
  initialLyrics?: string
  onClose: () => void
  onSave: (draft: EntryDraft) => void
  communityEntries?: Entry[]
  savedDrafts?: SavedEntryDraft[]
  activeDraftId?: string | null
  draftsInitiallyOpen?: boolean
  onSaveDraft?: (draft: EntryDraft, lyrics: string, metadataQuery: string, draftId: string | null) => void
  onSelectDraft?: (draftId: string | null) => void
  onDeleteDraft?: (draftId: string) => void
  isOnline?: boolean
}) {
  const initialDraft = entry
    ? {
        type: entry.type,
        title: entry.title,
        creator: entry.creator,
        provider: entry.provider,
        providerId: entry.providerId,
        genre: entry.genre,
        year: entry.year,
        rating: entry.rating,
        lyrics: entry.lyrics,
        favoritePassage: entry.favoritePassage,
        reflection: entry.reflection,
        reflectionAlign: entry.reflectionAlign || 'left',
        passageAlign: entry.passageAlign || 'left',
        enableDropCap: entry.enableDropCap ?? false,
        coverUrl: entry.coverUrl,
        summary: entry.summary,
        explicit: entry.explicit,
        preferWikipediaArtwork: entry.preferWikipediaArtwork,
        coverTone: entry.coverTone,
      }
    : initialDraftSeed || emptyDraft
  const [draft, setDraft] = useState<EntryDraft>(
    initialDraft,
  )
  const [baselineDraft, setBaselineDraft] = useState<EntryDraft>(initialDraft)
  const [metadataQuery, setMetadataQuery] = useState(initialDraft.title)
  const [baselineMetadataQuery, setBaselineMetadataQuery] = useState(initialDraft.title)
  const [metadataResults, setMetadataResults] = useState<MetadataResult[]>([])
  const [searchStatus, setSearchStatus] = useState<
    'idle' | 'searching' | 'ready' | 'error'
  >('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const restoredLyrics = initialLyrics || initialDraft.lyrics || ''
  const [selectedLyricIndexes, setSelectedLyricIndexes] = useState<number[]>(() =>
    restoredLyrics && initialDraft.favoritePassage
      ? getMatchingLyricIndexes(restoredLyrics, initialDraft.favoritePassage)
      : [],
  )
  const [showPassage, setShowPassage] = useState(() => Boolean(initialDraft.favoritePassage?.trim()))
  const [lyricsStatus, setLyricsStatus] = useState<
    'idle' | 'loading' | 'ready' | 'not-found'
  >(restoredLyrics ? 'ready' : 'idle')
  const [lyrics, setLyrics] = useState(restoredLyrics)
  const [showUnratedConfirm, setShowUnratedConfirm] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [showDraftLibrary, setShowDraftLibrary] = useState(draftsInitiallyOpen)
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(activeDraftId)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  const [pendingDraft, setPendingDraft] = useState<EntryDraft | null>(null)
  const lyricsFetchId = useRef(0)
  const lyricsBoxRef = useRef<HTMLDivElement>(null)
  const hasAutoScrolledLyricsRef = useRef(false)
  const reflectionRef = useRef<HTMLDivElement>(null)
  const passageRef = useRef<HTMLDivElement>(null)
  const [activeTarget, setActiveTarget] = useState<'reflection' | 'favoritePassage'>('reflection')

  const activeRef = activeTarget === 'favoritePassage' ? passageRef : reflectionRef
  const activeValue = activeTarget === 'favoritePassage' ? draft.favoritePassage : draft.reflection
  const activeAlignment = activeTarget === 'favoritePassage'
    ? draft.passageAlign || 'left'
    : draft.reflectionAlign || 'left'
  const setActiveValue = (val: string) => setDraft((cur) => ({ ...cur, [activeTarget]: val }))
  const setActiveAlignment = (alignment: Alignment) => setDraft((cur) => ({
    ...cur,
    [activeTarget === 'favoritePassage' ? 'passageAlign' : 'reflectionAlign']: alignment,
  }))
  const hasUnsavedChanges = !entryDraftsMatch(draft, baselineDraft)
    || metadataQuery.trim() !== baselineMetadataQuery.trim()

  const handleRequestClose = () => {
    if (hasUnsavedChanges) {
      setShowDiscardConfirm(true)
    } else {
      onClose()
    }
  }
  const handleComposerClose = () => {
    if (showDraftLibrary) {
      setShowDraftLibrary(false)
      return
    }
    handleRequestClose()
  }
  const composerDialogRef = useAccessibleDialog<HTMLFormElement>({
    open: true,
    onClose: handleComposerClose,
    closeOnEscape: !showDiscardConfirm && !showUnratedConfirm,
  })
  const discardDialogRef = useAccessibleDialog<HTMLDivElement>({
    open: showDiscardConfirm,
    onClose: () => setShowDiscardConfirm(false),
  })
  const unratedDialogRef = useAccessibleDialog<HTMLDivElement>({
    open: showUnratedConfirm,
    onClose: () => setShowUnratedConfirm(false),
  })
  const isMusicEntry = draft.type === 'song' || draft.type === 'album'
  const lyricSourceText = lyrics || (draft.type === 'song' ? draft.favoritePassage : '')
  const lyricLines = lyricSourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  useEffect(() => {
    if (hasAutoScrolledLyricsRef.current) return
    if (lyricsStatus !== 'ready') return
    if (selectedLyricIndexes.length === 0) return

    const firstSelectedIndex = selectedLyricIndexes[0]
    const frameId = window.requestAnimationFrame(() => {
      const selectedLine = lyricsBoxRef.current?.querySelector<HTMLElement>(
        `[data-lyric-index="${firstSelectedIndex}"]`,
      )
      selectedLine?.scrollIntoView({ block: 'center' })
      hasAutoScrolledLyricsRef.current = true
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [lyricsStatus, selectedLyricIndexes])

  useEffect(() => {
    if (restoredLyrics) return
    if (draft.type !== 'song' || !draft.title || !draft.creator) return
    if (lyricsStatus !== 'idle') return

    const fetchId = ++lyricsFetchId.current
    // This transition marks the beginning of the asynchronous lyrics request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLyricsStatus('loading')
    const abortController = new AbortController()

    fetchLyrics(draft.creator, draft.title, abortController.signal, {
      explicit: draft.explicit,
      albumName: draft.provider,
    })
      .then((fetched) => {
        if (lyricsFetchId.current !== fetchId) return
        if (fetched) {
          setLyrics(fetched)
          setLyricsStatus('ready')

          if (draft.favoritePassage) {
            const matched = getMatchingLyricIndexes(fetched, draft.favoritePassage)
            if (matched.length > 0) {
              setSelectedLyricIndexes(matched)
            }
          }
        } else {
          setLyricsStatus('not-found')
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        if (lyricsFetchId.current === fetchId) setLyricsStatus('not-found')
      })

    return () => abortController.abort()
  }, [restoredLyrics, draft.type, draft.title, draft.creator, draft.explicit, draft.provider, lyricsStatus, draft.favoritePassage])

  useEffect(() => {
    const normalizedQuery = metadataQuery.trim()
    const isSelectedValue =
      draft.providerId && normalizedQuery === draft.title.trim()
    const localGameResults = draft.type === 'game'
      ? localGameMetadataResults(normalizedQuery)
      : []

    if (normalizedQuery.length < 2 || isSelectedValue) {
      // Reset the async search state when the input no longer represents a request.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchStatus('idle')
      setStatusMessage('')
      if (normalizedQuery.length < 2) setMetadataResults([])
      return
    }

    // Instant return if result is already cached
    const cached = getCachedMetadata(draft.type, normalizedQuery)
    if (cached) {
      setMetadataResults(rankMetadataSearchResults(
        mergeMetadataSearchResults(localGameResults, cached),
        communityEntries,
      ))
      setSearchStatus('ready')
      setStatusMessage('')
      return
    }

    if (localGameResults.length > 0) {
      setMetadataResults(localGameResults)
      setSearchStatus('ready')
      setStatusMessage('')
    } else {
      setMetadataResults([])
      setSearchStatus('searching')
      setStatusMessage('Searching')
    }

    let cancelled = false
    const abortController = new AbortController()

    const timeout = window.setTimeout(() => {
      searchMetadata(draft.type, normalizedQuery, abortController.signal, { priority: 'high' })
        .then((results) => {
          if (cancelled) return
          const mergedResults = rankMetadataSearchResults(
            mergeMetadataSearchResults(localGameResults, results),
            communityEntries,
          )
          setMetadataResults(mergedResults)
          setSearchStatus('ready')
          setStatusMessage(
            mergedResults.length > 0 ? '' : 'No results found. You can still fill details manually.',
          )
        })
        .catch((err: unknown) => {
          if (cancelled || (err instanceof Error && err.name === 'AbortError')) return
          if (localGameResults.length > 0) {
            setMetadataResults(localGameResults)
            setSearchStatus('ready')
            setStatusMessage('')
            return
          }
          setSearchStatus('error')
          setStatusMessage(
            draft.type === 'game'
              ? 'Game search services are temporarily unavailable. Please try again shortly.'
              : err instanceof Error
                ? err.message
                : 'Failed to search metadata API.',
          )
        })
    }, 120)

    return () => {
      cancelled = true
      abortController.abort()
      window.clearTimeout(timeout)
    }
  }, [communityEntries, draft.providerId, draft.title, draft.type, metadataQuery])

  const changeType = (type: EntryType) => {
    setDraft((cur) => ({
      ...emptyDraft,
      rating: cur.rating,
      reflection: cur.reflection,
      type,
      coverTone: getDefaultCoverTone(type),
    }))
    setMetadataQuery('')
    setMetadataResults([])
    setSelectedLyricIndexes([])
    setLyricsStatus('idle')
    setLyrics('')
    setSearchStatus('idle')
    setStatusMessage('')
    setShowPassage(false)
  }

  const updateMetadataQuery = (value: string) => {
    setMetadataQuery(value)
    setDraft((cur) => ({
      ...cur,
      title: '',
      creator: '',
      provider: '',
      providerId: '',
      lyrics: undefined,
      coverUrl: undefined,
      summary: undefined,
      preferWikipediaArtwork: undefined,
      favoritePassage: isMusicEntry ? '' : cur.favoritePassage,
    }))
    setSelectedLyricIndexes([])
    setLyricsStatus('idle')
    setLyrics('')
  }

  const selectMetadata = async (result: MetadataResult) => {
    const fetchId = ++lyricsFetchId.current
    setDraft((cur) => ({ ...draftFromMetadata(result, cur), lyrics: undefined }))
    setMetadataQuery(result.title)
    setMetadataResults([])
    setSearchStatus('idle')
    setStatusMessage('')
    setSelectedLyricIndexes([])

    if (result.type === 'song') {
      setLyricsStatus('loading')
      setLyrics('')
      const abortController = new AbortController()
      try {
        const fetched = await fetchLyrics(result.creator, result.title, abortController.signal, {
          explicit: result.explicit,
          albumName: result.provider,
        })
        if (lyricsFetchId.current !== fetchId) return // stale — user picked another item
        if (fetched) {
          setLyrics(fetched)
          setLyricsStatus('ready')
          if (draft.favoritePassage) {
            const matched = getMatchingLyricIndexes(fetched, draft.favoritePassage)
            if (matched.length > 0) {
              setSelectedLyricIndexes(matched)
            }
          }
        } else {
          setLyricsStatus('not-found')
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return
        if (lyricsFetchId.current === fetchId) setLyricsStatus('not-found')
      }
    } else {
      setLyricsStatus('idle')
      setLyrics('')
    }
  }

  const toggleLyricLine = (index: number) => {
    const isSelected = selectedLyricIndexes.includes(index)
    if (!isSelected && selectedLyricIndexes.length >= MAX_SELECTED_LYRIC_LINES) return

    const nextIndexes = isSelected
      ? selectedLyricIndexes.filter((selectedIndex) => selectedIndex !== index)
      : [...selectedLyricIndexes, index].sort((a, b) => a - b)

    setSelectedLyricIndexes(nextIndexes)
    setShowPassage(true)
    setDraft((cur) => ({
      ...cur,
      favoritePassage: nextIndexes.map((lineIndex) => lyricLines[lineIndex]).join('\n'),
    }))
  }

  const loadSavedDraft = (saved: SavedEntryDraft) => {
    const restoredDraft = { ...emptyDraft, ...saved.draft }
    const restoredLyrics = saved.lyrics || ''
    setDraft(restoredDraft)
    setBaselineDraft(restoredDraft)
    setSelectedDraftId(saved.id)
    setMetadataQuery(saved.metadataQuery)
    setBaselineMetadataQuery(saved.metadataQuery)
    setMetadataResults([])
    setSearchStatus('idle')
    setStatusMessage('')
    setLyrics(restoredLyrics)
    setLyricsStatus(restoredLyrics ? 'ready' : 'idle')
    setSelectedLyricIndexes(
      restoredLyrics && restoredDraft.favoritePassage
        ? getMatchingLyricIndexes(restoredLyrics, restoredDraft.favoritePassage)
        : [],
    )
    setShowPassage(Boolean(restoredDraft.favoritePassage?.trim()))
    setShowDraftLibrary(false)
    onSelectDraft?.(saved.id)
  }

  const submitDraft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!draft.title.trim()) {
      setSearchStatus('error')
      setStatusMessage('Choose an API result before saving.')
      return
    }

    const finalDraft: EntryDraft = {
      ...draft,
      title: draft.title.trim(),
      creator: draft.creator.trim(),
      provider: draft.provider.trim(),
      providerId: draft.providerId.trim(),
      lyrics: draft.type === 'song' ? (lyrics || draft.lyrics || undefined) : undefined,
      favoritePassage: draft.favoritePassage.trim(),
      reflection: draft.reflection.trim(),
    }

    if (draft.rating === 0 && getWarnUnratedPreference()) {
      setPendingDraft(finalDraft)
      setShowUnratedConfirm(true)
      return
    }

    onSave(finalDraft)
  }

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => { if (e.target === e.currentTarget) handleComposerClose() }}
    >
      <motion.form
        ref={composerDialogRef}
        className={`composer${showDiscardConfirm || showUnratedConfirm ? ' composer--confirmation-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-composer-title"
        tabIndex={-1}
        onSubmit={submitDraft}
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.2 }}
      >
        {showDraftLibrary ? (
          <>
            <div className="composer-header composer-header--landscape">
              <button
                className="composer-back-btn"
                type="button"
                onClick={() => setShowDraftLibrary(false)}
                aria-label="Back to New Entry"
                title="Back to New Entry"
              >
                <ArrowLeft aria-hidden="true" />
              </button>
              <div className="composer-title">
                <h2 id="entry-composer-title">Drafts</h2>
                <div className="composer-title-rule" />
              </div>
              <div className="composer-header-spacer" />
            </div>

            <section className="entry-drafts-page">
              {savedDrafts.length === 0 ? (
                <div className="entry-drafts-empty">
                  <FileText aria-hidden="true" />
                  <p>No saved drafts yet.</p>
                </div>
              ) : (
                <div className="entry-drafts-list">
                  {savedDrafts.map((saved) => {
                    const typeLabel = getTypeMeta(saved.draft.type).label.replace(/s$/, '')
                    const title = saved.draft.title.trim() || `Untitled ${typeLabel}`
                    return (
                      <div className={`entry-draft-row${selectedDraftId === saved.id ? ' is-active' : ''}`} key={saved.id}>
                        <button className="entry-draft-select" type="button" onClick={() => loadSavedDraft(saved)}>
                          <strong>{title}</strong>
                          <span>{typeLabel} &bull; Saved {new Date(saved.updatedAt).toLocaleString()}</span>
                        </button>
                        <button
                          className="entry-draft-delete"
                          type="button"
                          onClick={() => {
                            onDeleteDraft?.(saved.id)
                            if (selectedDraftId === saved.id) {
                              setSelectedDraftId(null)
                              onSelectDraft?.(null)
                            }
                          }}
                          aria-label={`Delete draft ${title}`}
                          title="Delete draft"
                        >
                          <Trash2 aria-hidden="true" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </>
        ) : (
          <>
        <div className="composer-header composer-header--landscape">
          <div className="composer-header-spacer" />
          <div className="composer-title">
            {entry && <p className="composer-eyebrow">Edit entry</p>}
            <h2 id="entry-composer-title">{entry ? entry.title : 'New Entry'}</h2>
            <div className="composer-title-rule" />
          </div>
          <button
            className="composer-close-icon"
            type="button"
            onClick={handleRequestClose}
            aria-label="Close modal"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        {!isOnline && (
          <div className="composer-offline-notice" role="status">
            <WifiOff aria-hidden="true" />
            <span>
              <strong>No internet connection.</strong>
              Changes will be saved once the internet returns.
            </span>
          </div>
        )}

        <div className="composer-landscape">
          <section className="composer-left">
            <div className="form-grid">
              <label>
                <span>Type</span>
                <TypeIconBar
                  value={draft.type}
                  onChange={changeType}
                  disabled={Boolean(entry)}
                />
              </label>

              {!entry && (
                <label className="metadata-search-field">
                  <span>Select {draft.type === 'tv' ? 'a show' : `a ${draft.type}`}</span>
                  <input
                    value={metadataQuery}
                    onChange={(event) => updateMetadataQuery(event.target.value)}
                    placeholder={draft.type === 'film' || draft.type === 'tv'
                      ? `Search ${draft.type === 'film' ? 'films' : 'shows'} by title or artist`
                      : `Search ${getTypeMeta(draft.type).label.toLowerCase()}`}
                  />
                  {metadataQuery.trim().length >= 2 && searchStatus !== 'idle' && (
                    <div className="metadata-dropdown">
                      {searchStatus === 'searching' && metadataResults.length === 0 && (
                        <p className="metadata-status searching">
                          <Loader2 className="spin-icon" aria-hidden="true" />
                          <span>Searching</span>
                        </p>
                      )}
                      {searchStatus !== 'searching' && statusMessage && (
                        <p className="metadata-status">{statusMessage}</p>
                      )}
                      {searchStatus === 'ready' && metadataResults.map((result) => (
                        <button
                          className={
                            result.providerId === draft.providerId
                              ? 'metadata-option selected'
                              : 'metadata-option'
                          }
                          key={result.id}
                          type="button"
                          onClick={() => selectMetadata(result)}
                        >
                          <span
                            className={
                              usesSquareArtwork(result.type)
                                ? 'metadata-thumb metadata-thumb--square'
                                : 'metadata-thumb'
                            }
                          >
                            {result.type === 'game' ? (
                              <AdaptiveGameArtwork
                                src={result.coverUrl}
                                title={result.title}
                                preferWikipedia={
                                  Boolean(result.preferWikipediaArtwork) ||
                                  /rawg|steam/i.test(result.gameMetadata?.metadataSource || '')
                                }
                                frameAspect={2 / 3}
                                alt=""
                              />
                            ) : result.coverUrl ? (
                              <img src={resolveArtworkUrl(result.coverUrl, result.title, result.type)} alt="" />
                            ) : (
                              <Search aria-hidden="true" />
                            )}
                          </span>
                          <span className="metadata-option-copy">
                            <strong className="metadata-option-title">
                              <span>{result.title}</span>
                              {result.explicit && (
                                <span className="explicit-badge explicit-badge--inline" aria-label="Explicit">E</span>
                              )}
                            </strong>
                            <span className="metadata-type-line">
                              <span>{[result.creator, result.provider || result.genre].filter(Boolean).join(' • ')}</span>
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </label>
              )}
            </div>

            {draft.title ? (
              <div className="selected-metadata">
                <div
                  className={
                    usesSquareArtwork(draft.type)
                      ? 'selected-cover selected-cover--square'
                      : 'selected-cover'
                  }
                >
                  {draft.type === 'game' ? (
                    <AdaptiveGameArtwork
                      src={draft.coverUrl}
                      title={draft.title}
                      preferWikipedia={draft.preferWikipediaArtwork}
                      frameAspect={2 / 3}
                      alt=""
                    />
                  ) : draft.coverUrl ? (
                    <img src={resolveArtworkUrl(draft.coverUrl, draft.title, draft.type)} alt="" />
                  ) : (
                    <BookOpen aria-hidden="true" />
                  )}
                </div>
                <div className="selected-metadata-info">
                  <h3>
                    <span>{draft.title}</span>
                    {draft.explicit && <span className="explicit-badge explicit-badge--inline" aria-label="Explicit">E</span>}
                  </h3>
                  {draft.type === 'book' && (
                    <>
                      {draft.creator && <p>Author: {draft.creator}</p>}
                      {draft.genre && <p className="selected-genre">{draft.genre}</p>}
                    </>
                  )}
                  {draft.type === 'album' && (
                    <>
                      {draft.creator && <p>Artist: {draft.creator}</p>}
                      {draft.genre && <p className="selected-genre">{draft.genre}</p>}
                    </>
                  )}
                  {draft.type === 'song' && (
                    <>
                      {draft.creator && <p>Artist: {draft.creator}</p>}
                      {draft.genre && <p className="selected-genre">{draft.genre}</p>}
                      {draft.provider && draft.provider !== draft.genre && draft.provider !== draft.year && (
                        <p>{draft.provider}</p>
                      )}
                    </>
                  )}
                  {draft.type === 'film' && (
                    <>
                      {draft.genre && <p className="selected-genre">{draft.genre}</p>}
                      {(draft.creator || draft.year) && (
                        <p>{draft.creator || (draft.year ? `Released ${draft.year}` : '')}</p>
                      )}
                    </>
                  )}
                  {draft.type === 'game' && (
                    <>
                      {draft.genre && <p className="selected-genre">{draft.genre}</p>}
                      {draft.creator && <p>Developer: {draft.creator}</p>}
                    </>
                  )}
                  {draft.type === 'tv' && (
                    <>
                      {draft.genre && <p className="selected-genre">{draft.genre}</p>}
                      {draft.creator && <p>Cast: {draft.creator}</p>}
                    </>
                  )}
                  {draft.summary && <p className="selected-summary">{draft.summary}</p>}
                </div>
              </div>
            ) : (
              <div className="selected-metadata selected-metadata--empty">
                <div className="selected-cover">
                  <BookOpen aria-hidden="true" />
                </div>
                <div className="selected-metadata-info">
                  <h3>Choose something to keep</h3>
                  <p>Search results will auto-fill the title, creator, year, source, and artwork.</p>
                </div>
              </div>
            )}

            <div className="full-label">
              <span>Rating ({draft.rating} / 5)</span>
              <RatingPicker
                value={draft.rating}
                onChange={(rating) => setDraft((cur) => ({ ...cur, rating }))}
              />
            </div>
          </section>

          <section className="composer-right">
            {draft.type === 'song' ? (
              <div className="full-label lyrics-section">
                <div className="passage-header">
                  <span>Favorite lyrics</span>
                  <small className="lyrics-selection-limit">
                    {selectedLyricIndexes.length} / {MAX_SELECTED_LYRIC_LINES} lines
                  </small>
                </div>
                <div className="lyrics-box" ref={lyricsBoxRef}>
                  {lyricsStatus === 'idle' && (
                    <div className="lyrics-placeholder">
                      <Music4 aria-hidden="true" />
                      <p>Select a song to load lyrics and tap the lines you love.</p>
                    </div>
                  )}
                  {lyricsStatus === 'loading' && (
                    <div className="lyrics-placeholder">
                      <Loader2 className="spin-icon" aria-hidden="true" />
                      <p>Fetching lyrics…</p>
                    </div>
                  )}
                  {lyricsStatus === 'not-found' && (
                    <div className="lyrics-placeholder">
                      <p>No lyrics found automatically for this track.</p>
                    </div>
                  )}
                  {lyricsStatus === 'ready' && lyricLines.length > 0 && (
                    <div className="lyrics-selector">
                      {lyricLines.map((line, index) => (
                        <button
                          className={
                            selectedLyricIndexes.includes(index)
                              ? 'lyric-line selected'
                              : 'lyric-line'
                          }
                          key={`${line}-${index}`}
                          data-lyric-index={index}
                          type="button"
                          disabled={
                            !selectedLyricIndexes.includes(index) &&
                            selectedLyricIndexes.length >= MAX_SELECTED_LYRIC_LINES
                          }
                          title={
                            !selectedLyricIndexes.includes(index) && selectedLyricIndexes.length >= MAX_SELECTED_LYRIC_LINES
                              ? `You can select up to ${MAX_SELECTED_LYRIC_LINES} lyric lines.`
                              : undefined
                          }
                          onClick={() => toggleLyricLine(index)}
                        >
                          {line}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : showPassage ? (
              <div className="full-label passage-container">
                <div className="passage-header">
                  <span>
                    {draft.type === 'album'
                      ? 'Favorite lyrics / passage'
                      : 'Favorite passage'}
                  </span>
                  <button
                    type="button"
                    className="collapse-passage-btn"
                    onClick={() => {
                      setShowPassage(false)
                      setDraft((cur) => ({ ...cur, favoritePassage: '' }))
                    }}
                    title="Remove favorite passage"
                  >
                    <X aria-hidden="true" />
                  </button>
                </div>
                <RichTextEditor
                  editorRef={passageRef}
                  value={draft.favoritePassage}
                  align={draft.passageAlign}
                  onFocus={() => setActiveTarget('favoritePassage')}
                  onChange={(html) =>
                    setDraft((cur) => ({ ...cur, favoritePassage: html }))
                  }
                  minHeight={100}
                  maxCharacters={MAX_NOTABLE_LINE_CHARACTERS}
                  placeholder={
                    draft.type === 'album'
                      ? 'A lyric or line from this album that stayed with you…'
                      : 'A line, a scene, a quote, or a moment…'
                  }
                />
              </div>
            ) : (
              <button
                type="button"
                className="toggle-passage-btn"
                onClick={() => setShowPassage(true)}
              >
                <Quote aria-hidden="true" />
                <span>+ Add favorite passage / quote</span>
              </button>
            )}

            <div className="full-label composer-review">
              <div className="passage-header">
                <span>Your Thoughts</span>
              </div>
              <RichTextEditor
                editorRef={reflectionRef}
                value={draft.reflection}
                align={draft.reflectionAlign}
                onFocus={() => setActiveTarget('reflection')}
                onChange={(html) =>
                  setDraft((cur) => ({ ...cur, reflection: html }))
                }
                minHeight={180}
                placeholder="What stayed with you?"
              />
            </div>

            <div className="composer-actions">
              <div className="composer-toolbar-row">
                <FormattingToolbar
                  editorRef={activeRef}
                  value={activeValue}
                  onChange={setActiveValue}
                  alignment={activeAlignment}
                  onAlignmentChange={setActiveAlignment}
                  enableDropCap={Boolean(draft.enableDropCap)}
                  onToggleDropCap={() =>
                    setDraft((cur) => ({
                      ...cur,
                      enableDropCap: !cur.enableDropCap,
                    }))
                  }
                />
                {!entry && (
                  <button
                    className="composer-toolbar-drafts-btn"
                    type="button"
                    onClick={() => setShowDraftLibrary(true)}
                    aria-label="Open drafts"
                    title="Drafts"
                  >
                    <FileText aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className="composer-action-btns">
                <button className="ghost-btn" type="button" onClick={handleRequestClose}>
                  Cancel
                </button>
                <button className="primary-btn" type="submit">
                  <Save aria-hidden="true" />
                  <span>Publish</span>
                </button>
              </div>
            </div>
          </section>
        </div>
          </>
        )}
      </motion.form>

      {/* Confirmation modal when discarding unsaved changes */}
      <AnimatePresence>
        {showDiscardConfirm && (
          <div
            className="modal-backdrop modal-backdrop--confirmation"
            style={{ zIndex: 110 }}
            onClick={() => setShowDiscardConfirm(false)}
          >
            <motion.div
              ref={discardDialogRef}
              className="settings-modal"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="discard-entry-title"
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="settings-header">
                <div className="settings-header-title">
                  <AlertCircle style={{ color: '#e57373' }} aria-hidden="true" />
                  <h2 id="discard-entry-title">Discard Unsaved Changes?</h2>
                </div>
              </div>
              <p style={{ color: 'var(--secondary)', lineHeight: 1.6, marginBottom: 20 }}>
                You have unsaved changes in this entry. Are you sure you want to discard them?
              </p>

              <div className="discard-confirm-actions">
                <button
                  type="button"
                  className="discard-confirm-btn discard-confirm-btn--danger"
                  onClick={() => {
                    setShowDiscardConfirm(false)
                    onClose()
                  }}
                >
                  Discard
                </button>
                {!entry && onSaveDraft && (
                  <button
                    className="discard-confirm-btn"
                    type="button"
                  onClick={() => {
                    setShowDiscardConfirm(false)
                    onSaveDraft(draft, lyrics, metadataQuery, selectedDraftId)
                  }}
                >
                    Save to Draft
                  </button>
                )}
                <button
                  type="button"
                  className="discard-confirm-btn"
                  onClick={() => setShowDiscardConfirm(false)}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation modal when publishing an unrated entry */}
      <AnimatePresence>
        {showUnratedConfirm && (
          <div
            className="modal-backdrop modal-backdrop--confirmation"
            style={{ zIndex: 100 }}
            onClick={() => setShowUnratedConfirm(false)}
          >
            <motion.div
              ref={unratedDialogRef}
              className="settings-modal"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="unrated-entry-title"
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="settings-header">
                <div className="settings-header-title">
                  <AlertCircle style={{ color: '#f5b74c' }} aria-hidden="true" />
                  <h2 id="unrated-entry-title">Publish Without Rating?</h2>
                </div>
              </div>
              <p style={{ color: 'var(--secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                You have not assigned a star rating to this entry. Are you sure you want to publish it without a rating?
              </p>

              <label className="dont-show-again-label">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                />
                <span>Don't show this warning again</span>
              </label>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setShowUnratedConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => {
                    if (dontShowAgain) {
                      setWarnUnratedPreference(false)
                    }
                    setShowUnratedConfirm(false)
                    if (pendingDraft) {
                      onSave(pendingDraft)
                    }
                  }}
                >
                  Publish Anyway
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function RatingPicker({
  value,
  onChange,
}: {
  value: number
  onChange: (rating: number) => void
}) {
  const [hoverValue, setHoverValue] = useState<number | null>(null)
  const isHovering = hoverValue !== null
  const activeRating = isHovering ? hoverValue : value

  return (
    <div
      className={isHovering ? 'rating-picker is-hovering' : 'rating-picker'}
      aria-label={`${value} out of 5 stars`}
      onMouseLeave={() => setHoverValue(null)}
    >
      {Array.from({ length: 5 }, (_, index) => {
        const fillPercent = Math.max(0, Math.min(1, activeRating - index)) * 100

        return (
          <span className="rating-star-control" key={index}>
            <Star aria-hidden="true" className="rating-star-outline" />
            <span className="rating-star-fill" style={{ width: `${fillPercent}%` }}>
              <Star aria-hidden="true" />
            </span>
            <button
              type="button"
              className="rating-hit rating-hit-left"
              aria-label={`${index + 0.5} stars`}
              onMouseEnter={() => setHoverValue(index + 0.5)}
              onClick={() => onChange(index + 0.5)}
            />
            <button
              type="button"
              className="rating-hit rating-hit-right"
              aria-label={`${index + 1} stars`}
              onMouseEnter={() => setHoverValue(index + 1)}
              onClick={() => onChange(index + 1)}
            />
          </span>
        )
      })}
    </div>
  )
}
