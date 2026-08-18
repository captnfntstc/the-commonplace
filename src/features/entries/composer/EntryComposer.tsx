import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  BookOpen,
  Loader2,
  MessageSquareOff,
  Music4,
  Quote,
  Save,
  Search,
  Star,
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
import { AdaptiveGameArtwork } from '../../../components/GameArtwork/AdaptiveGameArtwork'
import { resolveArtworkUrl } from '../../../utils/artwork'
import { localGameMetadataResults, mergeMetadataSearchResults } from '../../search/metadataSearch'
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

const WARN_UNRATED_KEY = 'the-commonplace.warn-unrated'

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
  return matched
}

function isDraftDirty(current: EntryDraft, base: EntryDraft): boolean {
  return (
    current.type !== base.type ||
    current.title.trim() !== base.title.trim() ||
    current.creator.trim() !== base.creator.trim() ||
    current.rating !== base.rating ||
    current.favoritePassage.trim() !== base.favoritePassage.trim() ||
    current.reflection.trim() !== base.reflection.trim() ||
    current.coverTone !== base.coverTone ||
    current.enableDropCap !== base.enableDropCap
  )
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
  return (
    <div className="type-icon-bar">
      {entryTypes.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={`type-icon-btn ${value === id ? 'active' : ''}`}
          onClick={() => !disabled && onChange(id)}
          disabled={disabled}
          aria-label={label}
        >
          <Icon aria-hidden="true" style={{ width: 18, height: 18 }} />
          <span className="type-icon-tooltip">{label}</span>
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
  commentsDisabled = false,
}: {
  entry: Entry | null
  initialDraft?: EntryDraft | null
  initialLyrics?: string
  onClose: () => void
  onSave: (draft: EntryDraft, disableComments?: boolean) => void
  commentsDisabled?: boolean
}) {
  const [isCommentsDisabled, setIsCommentsDisabled] = useState(commentsDisabled)
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
  const [metadataQuery, setMetadataQuery] = useState(initialDraft.title)
  const [metadataResults, setMetadataResults] = useState<MetadataResult[]>([])
  const [searchStatus, setSearchStatus] = useState<
    'idle' | 'searching' | 'ready' | 'error'
  >('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [selectedLyricIndexes, setSelectedLyricIndexes] = useState<number[]>(() =>
    initialLyrics && initialDraft.favoritePassage
      ? getMatchingLyricIndexes(initialLyrics, initialDraft.favoritePassage)
      : [],
  )
  const [showPassage, setShowPassage] = useState(() => Boolean(initialDraft.favoritePassage?.trim()))
  const [lyricsStatus, setLyricsStatus] = useState<
    'idle' | 'loading' | 'ready' | 'not-found'
  >(initialLyrics || initialDraftSeed?.favoritePassage ? 'ready' : 'idle')
  const isEditMode = Boolean(entry)
  const [lyrics, setLyrics] = useState(initialLyrics)
  const [showUnratedConfirm, setShowUnratedConfirm] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
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
  const setActiveValue = (val: string) => setDraft((cur) => ({ ...cur, [activeTarget]: val }))

  const handleRequestClose = () => {
    if (isDraftDirty(draft, initialDraft)) {
      setShowDiscardConfirm(true)
    } else {
      onClose()
    }
  }

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
    if (initialLyrics || initialDraftSeed?.favoritePassage) return
    if (draft.type !== 'song' || !draft.title || !draft.creator) return
    if (lyricsStatus !== 'idle') return

    const fetchId = ++lyricsFetchId.current
    // This transition marks the beginning of the asynchronous lyrics request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLyricsStatus('loading')
    const abortController = new AbortController()

    fetchLyrics(draft.creator, draft.title, abortController.signal)
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
  }, [isEditMode, initialDraftSeed?.favoritePassage, initialLyrics, draft.type, draft.title, draft.creator, lyricsStatus, draft.favoritePassage])

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
      setMetadataResults(mergeMetadataSearchResults(localGameResults, cached))
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
      searchMetadata(draft.type, normalizedQuery, abortController.signal)
        .then((results) => {
          if (cancelled) return
          const mergedResults = mergeMetadataSearchResults(localGameResults, results)
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
  }, [draft.providerId, draft.title, draft.type, metadataQuery])

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
    setDraft((cur) => draftFromMetadata(result, cur))
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
        const fetched = await fetchLyrics(result.creator, result.title, abortController.signal)
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
    const nextIndexes = selectedLyricIndexes.includes(index)
      ? selectedLyricIndexes.filter((selectedIndex) => selectedIndex !== index)
      : [...selectedLyricIndexes, index].sort((a, b) => a - b)

    setSelectedLyricIndexes(nextIndexes)
    setShowPassage(true)
    setDraft((cur) => ({
      ...cur,
      favoritePassage: nextIndexes.map((lineIndex) => lyricLines[lineIndex]).join('\n'),
    }))
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
      favoritePassage: draft.favoritePassage.trim(),
      reflection: draft.reflection.trim(),
    }

    if (draft.rating === 0 && getWarnUnratedPreference()) {
      setPendingDraft(finalDraft)
      setShowUnratedConfirm(true)
      return
    }

    onSave(finalDraft, isCommentsDisabled)
  }

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => { if (e.target === e.currentTarget) handleRequestClose() }}
    >
      <motion.form
        className={`composer${showDiscardConfirm || showUnratedConfirm ? ' composer--confirmation-open' : ''}`}
        onSubmit={submitDraft}
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.2 }}
      >
        <div className="composer-header composer-header--landscape">
          <div className="composer-header-spacer" />
          <div className="composer-title">
            <p className="composer-eyebrow">{entry ? 'Edit entry' : 'New entry'}</p>
            <h2>{entry ? entry.title : 'New Margin'}</h2>
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
                    placeholder={`Search ${getTypeMeta(draft.type).label.toLowerCase()}`}
                  />
                  {metadataQuery.trim().length >= 2 && (
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
                  onFocus={() => setActiveTarget('favoritePassage')}
                  onChange={(html) =>
                    setDraft((cur) => ({ ...cur, favoritePassage: html }))
                  }
                  minHeight={100}
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
                <span>Review / Reflection</span>
              </div>
              <RichTextEditor
                editorRef={reflectionRef}
                value={draft.reflection}
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
                  enableDropCap={Boolean(draft.enableDropCap)}
                  onToggleDropCap={() =>
                    setDraft((cur) => ({
                      ...cur,
                      enableDropCap: !cur.enableDropCap,
                    }))
                  }
                />
                <button
                  type="button"
                  className={`disable-comments-square-btn ${isCommentsDisabled ? 'active' : ''}`}
                  title={isCommentsDisabled ? 'Comments disabled for this entry' : 'Disable comments for this entry'}
                  onClick={() => setIsCommentsDisabled((v) => !v)}
                >
                  <MessageSquareOff size={15} />
                </button>
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
              className="settings-modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="settings-header">
                <div className="settings-header-title">
                  <AlertCircle style={{ color: '#e57373' }} aria-hidden="true" />
                  <h2>Discard Unsaved Changes?</h2>
                </div>
              </div>
              <p style={{ color: 'var(--secondary)', lineHeight: 1.6, marginBottom: 20 }}>
                You have unsaved changes in this entry. Are you sure you want to discard them?
              </p>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setShowDiscardConfirm(false)}
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  className="action-btn danger"
                  onClick={() => {
                    setShowDiscardConfirm(false)
                    onClose()
                  }}
                >
                  Discard Changes
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
              className="settings-modal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="settings-header">
                <div className="settings-header-title">
                  <AlertCircle style={{ color: '#f5b74c' }} aria-hidden="true" />
                  <h2>Publish Without Rating?</h2>
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
