import {
  AudioLines,
  BookOpen,
  Building2,
  Clapperboard,
  Disc3,
  Drama,
  Feather,
  Film,
  Gamepad2,
  Laugh,
  Lightbulb,
  MicVocal,
  Music2,
  Pencil,
  SlidersHorizontal,
  Tv,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type {
  HumanProfession,
  HumanScreenCreditCategory,
  MediaEntityType,
} from '../types/mediaEntity'
import type { MetadataType } from '../metadata'

/**
 * One semantic icon vocabulary for roles and media across the entire app.
 * Keep people/roles distinct from the works they create: an author uses a
 * pencil, while an authored book uses a book, for example.
 */
export function getProfessionIcon(profession?: HumanProfession): LucideIcon {
  switch (profession) {
    case 'singer_songwriter':
    case 'singer':
    case 'songwriter':
    case 'rapper':
      return MicVocal
    case 'musician':
      return AudioLines
    case 'composer':
      return Music2
    case 'music_producer':
      return SlidersHorizontal
    case 'author':
    case 'novelist':
    case 'screenwriter':
      return Pencil
    case 'poet':
      return Feather
    case 'actor':
    case 'voice_actor':
      return Drama
    case 'director':
      return Clapperboard
    case 'producer':
      return Film
    case 'showrunner':
      return Tv
    case 'comedian':
      return Laugh
    default:
      return User
  }
}

export function getMediaEntityIcon(
  type: MediaEntityType,
  profession?: HumanProfession,
): LucideIcon {
  switch (type) {
    case 'human':
      return getProfessionIcon(profession)
    case 'music_group':
      return Users
    case 'artist':
      return MicVocal
    case 'album':
      return Disc3
    case 'song':
      return Music2
    case 'author':
      return Pencil
    case 'book':
      return BookOpen
    case 'movie':
      return Film
    case 'tv':
      return Tv
    case 'actor':
      return Drama
    case 'director':
      return Clapperboard
    case 'creator':
      return Lightbulb
    case 'game':
      return Gamepad2
    case 'game_studio':
      return Building2
    default:
      return User
  }
}

export function getEntryTypeIcon(type: MetadataType): LucideIcon {
  switch (type) {
    case 'album':
      return Disc3
    case 'book':
      return BookOpen
    case 'film':
      return Film
    case 'game':
      return Gamepad2
    case 'song':
      return Music2
    case 'tv':
      return Tv
    default:
      return BookOpen
  }
}

export function getScreenCreditIcon(category: HumanScreenCreditCategory): LucideIcon {
  switch (category) {
    case 'acting':
      return Drama
    case 'directing':
      return Clapperboard
    case 'concert':
      return MicVocal
    case 'documentary':
      return Film
    case 'producing':
      return SlidersHorizontal
    case 'writing':
      return Pencil
    default:
      return Film
  }
}
