import type { GameMetadata, GamePlatformRelease, UniversalMediaEntity } from '../types/mediaEntity'

function chipValue(entity: UniversalMediaEntity, labels: RegExp) {
  return entity.metadataChips.find((chip) => labels.test(chip.label.trim()))?.value.trim()
}

function nonEmpty(values: Array<string | undefined>) {
  return values.filter((value): value is string => Boolean(value?.trim()))
}

function legacyPlatforms(entity: UniversalMediaEntity): GamePlatformRelease[] {
  const value = chipValue(entity, /^platforms?$/i)
  if (!value) return []

  return value
    .split(',')
    .map((platform) => platform.trim())
    .filter(Boolean)
    .map((platform) => ({ platform, status: 'available' }))
}

export function normalizeGameMetadata(entity: UniversalMediaEntity): GameMetadata {
  const metadata = entity.gameMetadata || {}
  const developer = chipValue(entity, /^developers?$/i)
  const publisher = chipValue(entity, /^publishers?$/i)
  const genre = chipValue(entity, /^genres?$/i)
  const releaseDate = chipValue(entity, /^(release|released|pc release|standalone)$/i)

  return {
    ...metadata,
    developers: metadata.developers?.length ? metadata.developers : nonEmpty([developer]),
    publishers: metadata.publishers?.length ? metadata.publishers : nonEmpty([publisher]),
    genres: metadata.genres?.length ? metadata.genres : nonEmpty([genre]),
    releaseDate: metadata.releaseDate || releaseDate,
    platforms: metadata.platforms?.length ? metadata.platforms : legacyPlatforms(entity),
  }
}

export function primaryGameCreator(metadata: GameMetadata) {
  return metadata.developers?.[0] || metadata.publishers?.[0]
}
