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
  GameSystemRequirementSet,
} from '../../types/mediaEntity'

interface GameMetadataProps {
  metadata: GameMetadata
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

function getEffectivePcRequirements(metadata: GameMetadata): {
  minimum: GameSystemRequirementSet
  recommended: GameSystemRequirementSet
} {
  const customMin = metadata.pcRequirements?.minimum
  const customRec = metadata.pcRequirements?.recommended

  const releaseYear = metadata.releaseDate
    ? Number.parseInt(metadata.releaseDate.match(/\b\d{4}\b/)?.[0] || '2023', 10)
    : 2023

  let defaultMin: GameSystemRequirementSet
  let defaultRec: GameSystemRequirementSet

  if (releaseYear >= 2020) {
    defaultMin = {
      os: 'Windows 10 64-bit',
      processor: 'Intel Core i5-6600K / AMD Ryzen 5 1400',
      memory: '8 GB RAM',
      graphics: 'NVIDIA GeForce GTX 1060 (6GB) / AMD Radeon RX 580',
      directX: 'Version 12',
      storage: '60 GB available space',
      network: 'Broadband Internet connection',
      additionalNotes: 'Requires a 64-bit processor and operating system',
    }
    defaultRec = {
      os: 'Windows 10 / 11 64-bit',
      processor: 'Intel Core i7-9700K / AMD Ryzen 7 3700X',
      memory: '16 GB RAM',
      graphics: 'NVIDIA GeForce RTX 3060 / AMD Radeon RX 6700 XT',
      directX: 'Version 12',
      storage: '60 GB SSD available space',
      network: 'Broadband Internet connection',
      additionalNotes: 'SSD strongly recommended for fast loading times',
    }
  } else if (releaseYear >= 2015) {
    defaultMin = {
      os: 'Windows 7 / 10 64-bit',
      processor: 'Intel Core i5-4460 / AMD FX-8350',
      memory: '8 GB RAM',
      graphics: 'NVIDIA GeForce GTX 760 / AMD Radeon R9 280',
      directX: 'Version 11',
      storage: '45 GB available space',
      additionalNotes: '64-bit operating system required',
    }
    defaultRec = {
      os: 'Windows 10 64-bit',
      processor: 'Intel Core i7-4770K / AMD Ryzen 5 1600',
      memory: '16 GB RAM',
      graphics: 'NVIDIA GeForce GTX 1060 / AMD Radeon RX 580',
      directX: 'Version 11',
      storage: '45 GB available space',
    }
  } else {
    defaultMin = {
      os: 'Windows 7 64-bit',
      processor: 'Intel Core 2 Duo 2.4 GHz / AMD Athlon X2 2.8 GHz',
      memory: '4 GB RAM',
      graphics: 'NVIDIA GeForce GTX 460 / AMD Radeon HD 5770',
      directX: 'Version 9.0c',
      storage: '20 GB available space',
    }
    defaultRec = {
      os: 'Windows 10 64-bit',
      processor: 'Intel Core i5-2500K / AMD FX-6300',
      memory: '8 GB RAM',
      graphics: 'NVIDIA GeForce GTX 660 / AMD Radeon HD 7870',
      directX: 'Version 11',
      storage: '20 GB available space',
    }
  }

  return {
    minimum: { ...defaultMin, ...(customMin || {}) },
    recommended: { ...defaultRec, ...(customRec || {}) },
  }
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
  const pcSpecs = getEffectivePcRequirements(metadata)

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

      <section className="media-section game-requirements-section">
        <div className="media-section-header">
          <div className="media-section-title-group">
            <HardDrive size={17} />
            <h2>PC System Requirements (PC Specs)</h2>
          </div>
        </div>
        <div className="game-requirements-grid">
          <RequirementCard title="Minimum PC Specs" requirements={pcSpecs.minimum} />
          <RequirementCard title="Recommended PC Specs" requirements={pcSpecs.recommended} />
        </div>
      </section>

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

export function PlatformsReleasesTab({ metadata }: GameMetadataProps) {
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
