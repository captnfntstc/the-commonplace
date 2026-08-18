import {
  CalendarDays,
  Check,
  ExternalLink,
  Gamepad2,
  HardDrive,
  Info,
  Monitor,
  Package,
  Smartphone,
  Sparkles,
} from 'lucide-react'
import type {
  GameEdition,
  GameMetadata,
  GamePlatformRelease,
  GameRelatedContentItem,
  GameRelatedContentKind,
  GameSystemRequirementSet,
} from '../../types/mediaEntity'

interface GameMetadataProps {
  metadata: GameMetadata
}

export interface GameProfileNavigationItem {
  providerId: string
  name: string
  description?: string
  releaseDate?: string
  coverUrl?: string
  genres?: string[]
}

interface GameNavigationProps {
  onNavigateGame?: (item: GameProfileNavigationItem) => void
}

function PlatformIcon({ platform }: { platform: string }) {
  if (/android|ios|mobile|phone/i.test(platform)) return <Smartphone size={18} />
  if (/pc|windows|mac|linux/i.test(platform)) return <Monitor size={18} />
  return <Gamepad2 size={18} />
}

function formatDate(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed)
}

function joinValues(values?: string[]) {
  return values?.filter(Boolean).join(', ')
}

const platformStatusLabel: Record<NonNullable<GamePlatformRelease['status']>, string> = {
  available: 'Available',
  upcoming: 'Upcoming',
  announced: 'Announced',
  discontinued: 'Discontinued',
}

function PlatformCard({ release, compact = false }: { release: GamePlatformRelease; compact?: boolean }) {
  return (
    <article className={`game-platform-card ${compact ? 'is-compact' : ''}`}>
      <div className="game-platform-card-heading">
        <span className="game-platform-icon" aria-hidden="true"><PlatformIcon platform={release.platform} /></span>
        <div>
          <h3>{release.platform}</h3>
          {release.status && release.status !== 'available' && (
            <span className={`game-platform-status is-${release.status}`}>
              {platformStatusLabel[release.status]}
            </span>
          )}
        </div>
      </div>
      {(release.releaseDate || (!compact && (release.distribution?.length || release.notes))) && (
        <div className="game-platform-card-details">
          {release.releaseDate && <span><CalendarDays size={13} /><span><small>Released</small>{formatDate(release.releaseDate)}</span></span>}
          {!compact && release.distribution?.length ? <span><Package size={13} />{release.distribution.join(' / ')}</span> : null}
          {!compact && release.notes && <p>{release.notes}</p>}
        </div>
      )}
    </article>
  )
}

export function GameAvailableOnPreview({
  metadata,
  onViewAll,
}: GameMetadataProps & { onViewAll: () => void }) {
  const platforms = metadata.platforms || []
  if (platforms.length === 0) return null

  return (
    <section className="media-section game-available-preview">
      <div className="media-section-header">
        <div className="media-section-title-group">
          <Gamepad2 size={17} className="title-icon" />
          <h2>Available On</h2>
        </div>
        <button type="button" className="media-view-all-btn" onClick={onViewAll}>
          Platforms &amp; Releases
        </button>
      </div>
      <div className="game-platform-preview-grid">
        {platforms.slice(0, 4).map((release) => (
          <PlatformCard key={release.platform} release={release} compact />
        ))}
      </div>
    </section>
  )
}

function MetadataItem({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="game-about-item">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

const relatedContentLabels: Record<GameRelatedContentKind, string> = {
  sequel: 'Sequels',
  expansion: 'Expansion Packs',
  dlc: 'DLC',
}

function RelatedContentCard({
  item,
  onNavigate,
}: {
  item: GameRelatedContentItem
  onNavigate?: (item: GameProfileNavigationItem) => void
}) {
  return (
    <button
      type="button"
      className="game-related-content-card"
      onClick={() => onNavigate?.(item)}
      aria-label={`Open ${item.name} game profile`}
    >
      <div className="game-related-content-cover">
        {item.coverUrl
          ? <img src={item.coverUrl} alt={`${item.name} cover`} loading="lazy" referrerPolicy="no-referrer" />
          : <Gamepad2 size={22} aria-hidden="true" />}
      </div>
      <h3>{item.name}</h3>
    </button>
  )
}

export function GameRelatedContentTab({
  metadata,
  onNavigateGame,
}: GameMetadataProps & GameNavigationProps) {
  const groups = (['sequel', 'expansion', 'dlc'] as const)
    .map((kind) => ({
      kind,
      items: (metadata.relatedContent || []).filter((item) => item.kind === kind),
    }))
    .filter((group) => group.items.length > 0)
  const itemCount = groups.reduce((count, group) => count + group.items.length, 0)

  return (
    <section className="media-section game-related-content-section">
      <div className="media-section-header">
        <div className="media-section-title-group"><Package size={17} /><h2>More From This Game ({itemCount})</h2></div>
      </div>
      {groups.length > 0 ? (
        <div className="game-related-content-groups">
          {groups.map((group) => (
            <div className="game-related-content-group" key={group.kind}>
              <h3>{relatedContentLabels[group.kind]}</h3>
              <div className="game-related-content-grid">
                {group.items.map((item) => (
                  <RelatedContentCard
                    key={`${item.kind}:${item.providerId}`}
                    item={item}
                    onNavigate={onNavigateGame}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="media-empty-reviews">
          <Package size={30} opacity={0.3} />
          <p>No sequels, expansion packs, or DLC are listed for this game.</p>
        </div>
      )}
    </section>
  )
}

function RequirementCard({ title, requirements }: { title: string; requirements?: GameSystemRequirementSet }) {
  if (!requirements || Object.values(requirements).every((value) => !value)) return null
  const rows: Array<[string, string | undefined]> = [
    ['OS', requirements.os],
    ['Processor', requirements.processor],
    ['Memory', requirements.memory],
    ['Graphics', requirements.graphics],
    ['Storage', requirements.storage],
    ['DirectX', requirements.directX],
    ['Network', requirements.network],
    ['Sound', requirements.sound],
    ['Notes', requirements.additionalNotes],
  ]

  return (
    <article className="game-requirement-card">
      <h3>{title}</h3>
      <dl>
        {rows.map(([label, value]) => value ? (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ) : null)}
      </dl>
    </article>
  )
}

export function GameInfoTab({ metadata }: GameMetadataProps) {
  const aboutValues = [
    joinValues(metadata.developers),
    joinValues(metadata.publishers),
    joinValues(metadata.genres),
    metadata.franchise,
    joinValues(metadata.gameModes),
    metadata.engine,
    metadata.ageRating,
    metadata.releaseDate,
  ]
  const hasAbout = aboutValues.some(Boolean) || Boolean(metadata.officialWebsite)
  const pcSpecs = metadata.pcRequirements
  const hasPcRequirements = Boolean(
    pcSpecs && [pcSpecs.minimum, pcSpecs.recommended]
      .some((requirements) => requirements && Object.values(requirements).some(Boolean)),
  )
  const isPcGame = metadata.platforms?.some(({ platform }) => /\bpc\b|windows|mac(?:os)?|linux/i.test(platform))

  return (
    <>
      {hasAbout && (
        <section className="media-section game-info-section">
          <div className="media-section-header">
            <div className="media-section-title-group"><Info size={17} /><h2>About the Game</h2></div>
          </div>
          <dl className="game-about-grid">
            <MetadataItem label="Developer" value={joinValues(metadata.developers)} />
            <MetadataItem label="Publisher" value={joinValues(metadata.publishers)} />
            <MetadataItem label="Genres" value={joinValues(metadata.genres)} />
            <MetadataItem label="Franchise" value={metadata.franchise} />
            <MetadataItem label="Game Modes" value={joinValues(metadata.gameModes)} />
            <MetadataItem label="Engine" value={metadata.engine} />
            <MetadataItem label="Age Rating" value={metadata.ageRating} />
            <MetadataItem label="Initial Release" value={metadata.releaseDate ? formatDate(metadata.releaseDate) : undefined} />
          </dl>
          {metadata.officialWebsite && (
            <a className="game-official-link" href={metadata.officialWebsite} target="_blank" rel="noreferrer">
              Official website <ExternalLink size={14} />
            </a>
          )}
        </section>
      )}

      {(hasPcRequirements || isPcGame) && (
        <section className="media-section game-requirements-section">
          <div className="media-section-header">
            <div className="media-section-title-group">
              <HardDrive size={17} />
              <h2>PC System Requirements (PC Specs)</h2>
            </div>
          </div>
          {hasPcRequirements ? (
            <>
              <div className="game-requirements-grid">
                <RequirementCard title="Minimum PC Specs" requirements={pcSpecs?.minimum} />
                <RequirementCard title="Recommended PC Specs" requirements={pcSpecs?.recommended} />
              </div>
              <p className="game-requirements-source">Source: Steam Store listing for this game.</p>
            </>
          ) : (
            <p className="game-requirements-unavailable">
              Official PC system requirements are not available from this game&apos;s store listing.
            </p>
          )}
        </section>
      )}

      {metadata.features?.length ? (
        <section className="media-section game-features-section">
          <div className="media-section-header">
            <div className="media-section-title-group"><Sparkles size={17} /><h2>Features</h2></div>
          </div>
          <ul className="game-feature-list">
            {metadata.features.map((feature) => <li key={feature}><Check size={14} />{feature}</li>)}
          </ul>
        </section>
      ) : null}
    </>
  )
}

function datedTimeline(platforms: GamePlatformRelease[]) {
  const groups = new Map<string, GamePlatformRelease[]>()
  platforms.forEach((release) => {
    if (!release.releaseDate) return
    const group = groups.get(release.releaseDate) || []
    group.push(release)
    groups.set(release.releaseDate, group)
  })
  return Array.from(groups.entries()).sort(([left], [right]) => {
    const leftDate = new Date(left).getTime()
    const rightDate = new Date(right).getTime()
    if (Number.isNaN(leftDate) || Number.isNaN(rightDate)) return left.localeCompare(right)
    return leftDate - rightDate
  })
}

function EditionCard({ edition }: { edition: GameEdition }) {
  return (
    <article className="game-edition-card">
      <h3>{edition.name}</h3>
      {edition.description && <p>{edition.description}</p>}
      {edition.includedContent?.length ? (
        <ul>{edition.includedContent.map((item) => <li key={item}>{item}</li>)}</ul>
      ) : null}
      {edition.releaseDate && <time dateTime={edition.releaseDate}>{formatDate(edition.releaseDate)}</time>}
      {edition.platforms?.length ? <span>{edition.platforms.join(', ')}</span> : null}
    </article>
  )
}

export function PlatformsReleasesTab({
  metadata,
}: GameMetadataProps) {
  const platforms = metadata.platforms || []
  const timeline = datedTimeline(platforms)

  return (
    <>
      {platforms.length > 0 && (
        <section className="media-section game-platforms-section">
          <div className="media-section-header">
            <div className="media-section-title-group"><Gamepad2 size={17} /><h2>Available Platforms</h2></div>
          </div>
          <div className="game-platform-grid">
            {platforms.map((release) => <PlatformCard key={release.platform} release={release} />)}
          </div>
        </section>
      )}

      {timeline.length > 0 && (
        <section className="media-section game-release-section">
          <div className="media-section-header">
            <div className="media-section-title-group"><CalendarDays size={17} /><h2>Release Timeline</h2></div>
          </div>
          <ol className="game-release-timeline">
            {timeline.map(([date, releases]) => (
              <li key={date}>
                <time dateTime={date}>{formatDate(date)}</time>
                <div>{releases.map((release) => <span key={release.platform}>{release.platform}</span>)}</div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {metadata.editions?.length ? (
        <section className="media-section game-editions-section">
          <div className="media-section-header">
            <div className="media-section-title-group"><Package size={17} /><h2>Editions</h2></div>
          </div>
          <div className="game-editions-grid">
            {metadata.editions.map((edition) => <EditionCard key={edition.name} edition={edition} />)}
          </div>
        </section>
      ) : null}

      {platforms.length === 0 && !metadata.editions?.length && (
        <section className="media-section media-empty-reviews game-platform-empty">
          <Gamepad2 size={32} opacity={0.3} />
          <p>Platform and release details are not available for this game yet.</p>
        </section>
      )}
    </>
  )
}
