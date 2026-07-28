export const ExpansionVariant = {
  V1: 'V1',
  V2: 'V2',
  V3: 'V3',
  V4: 'V4',
  V5: 'V5',
  V6: 'V6',
  V7: 'V7',
  V8: 'V8',
  V9: 'V9',
  V10: 'V10',
  V11: 'V11',
  V12: 'V12',
  V13: 'V13',
} as const

export type ExpansionVariant = (typeof ExpansionVariant)[keyof typeof ExpansionVariant]

export type VariantInfo = {
  id: ExpansionVariant
  name: string
  label: string
  description: string
  tag: string
}

export const VARIANT_METADATA: Record<ExpansionVariant, VariantInfo> = {
  [ExpansionVariant.V1]: {
    id: ExpansionVariant.V1,
    name: 'V1 Fade',
    label: 'Fade Expansion',
    description: 'Gradient mask fading bottom lines with a Continue Reading trigger.',
    tag: 'Visual Fade',
  },
  [ExpansionVariant.V2]: {
    id: ExpansionVariant.V2,
    name: 'V2 Scroll',
    label: 'Max Height + Scroll',
    description: 'Fixed header & media with internal scrolling reflection container.',
    tag: 'Max Height',
  },
  [ExpansionVariant.V3]: {
    id: ExpansionVariant.V3,
    name: 'V3 Editorial',
    label: 'Editorial Sections',
    description: 'Quote, Reflection, and Thoughts structured with subtle rule dividers.',
    tag: 'Structured',
  },
  [ExpansionVariant.V4]: {
    id: ExpansionVariant.V4,
    name: 'V4 Drop Cap',
    label: 'Drop Cap',
    description: 'First reflection paragraph opens with a 3-4 line display drop cap.',
    tag: 'Novel Style',
  },
  [ExpansionVariant.V5]: {
    id: ExpansionVariant.V5,
    name: 'V5 Reading Width',
    label: 'Reading Width',
    description: 'Optimized 55–65 character measure with generous lateral margins.',
    tag: 'Typography',
  },
  [ExpansionVariant.V6]: {
    id: ExpansionVariant.V6,
    name: 'V6 Two Stage',
    label: 'Two Stage Expansion',
    description: 'Two-step reveal: Collapsed → Preview (~15 lines) → Full Essay.',
    tag: 'Multi-Step',
  },
  [ExpansionVariant.V7]: {
    id: ExpansionVariant.V7,
    name: 'V7 Text Only',
    label: 'Text Only Growth',
    description: 'Header, media, and footer stay anchored while middle text expands.',
    tag: 'Anchored Meta',
  },
  [ExpansionVariant.V8]: {
    id: ExpansionVariant.V8,
    name: 'V8 Article',
    label: 'Article Card',
    description: 'Displays estimated reading time, lead paragraph, and Medium-style layout.',
    tag: 'Editorial Read',
  },
  [ExpansionVariant.V9]: {
    id: ExpansionVariant.V9,
    name: 'V9 Blur',
    label: 'Progressive Blur',
    description: 'Backdrop CSS blur effect overlaying deeper content after ~20 lines.',
    tag: 'CSS Filter',
  },
  [ExpansionVariant.V10]: {
    id: ExpansionVariant.V10,
    name: 'V10 Overlay',
    label: 'Reading Overlay',
    description: 'Opens a focused, full-featured reading modal overlay on backdrop blur.',
    tag: 'Modal / Panel',
  },
  [ExpansionVariant.V11]: {
    id: ExpansionVariant.V11,
    name: 'V11 Book Page',
    label: 'Book Page',
    description: 'Transforms card into paper book page with shadows & margins.',
    tag: 'Paper Morph',
  },
  [ExpansionVariant.V12]: {
    id: ExpansionVariant.V12,
    name: 'V12 Hybrid Scroll',
    label: 'DropCap + Scroll + Read Width + Read Time',
    description: 'Combines read time badge, Drop Cap, 58ch measure, and max-height scrolling container.',
    tag: 'Hybrid Scroll',
  },
  [ExpansionVariant.V13]: {
    id: ExpansionVariant.V13,
    name: 'V13 Hybrid Overlay',
    label: 'DropCap + Overlay + Read Width + Read Time',
    description: 'Combines read time badge, Drop Cap, 58ch measure, and focused modal reading overlay.',
    tag: 'Hybrid Overlay',
  },
}
