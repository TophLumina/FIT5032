export function formatLabel(value) {
  return String(value)
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function joinLabels(values) {
  return values.map(formatLabel).join(' / ')
}
