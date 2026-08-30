export function cleanDisplayText(value?: string | null) {
  return (value || '')
    .replace(/\u00c2\u00b7/g, '·')
    .replace(/\u00e2\u20ac\u00a6/g, '…')
    .replace(/\u00e2\u20ac\u201d/g, '—')
    .replace(/\u00e2\u20ac\u201c/g, '–')
    .replace(/\u00e2\u2020\u2019/g, '→')
    .replace(/\u00e2\u2020\u2014/g, '↗')
    .replace(/\u00e2\u20ac\u0153/g, '“')
    .replace(/\u00e2\u20ac\u009d/g, '”')
    .replace(/\u00c3\u00a2\u00e2\u201a\u00ac\u00e2\u201e\u00a2/g, '’')
    .replace(/\u00c3\u00a2\u00e2\u201a\u00ac\u00cb\u0153/g, '‘')
    .replace(/\u00e2\u201d\u20ac/g, '─')
}

export function cleanMetadataChips<T extends { label: string; value: string }>(chips: T[]) {
  return chips.map((chip) => ({ ...chip, value: cleanDisplayText(chip.value) }))
}
