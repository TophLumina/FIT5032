const collator = new Intl.Collator('en-AU', { numeric: true, sensitivity: 'base' })

export function searchText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replaceAll('-', ' ')
    .trim()
}

export function cellText(row, column) {
  const value = row[column.key]
  return column.format ? column.format(value) : String(value ?? '')
}

// Shared by both table views and the public plant API. Never mutates input rows.
export function selectRows(
  rows,
  columns,
  { q = '', filters = {}, sort = '', direction = 'asc' } = {},
) {
  const term = searchText(q)
  const result = rows.filter(
    (row) =>
      (!term || columns.some((column) => searchText(cellText(row, column)).includes(term))) &&
      columns.every(
        (column) =>
          !searchText(filters[column.key]) ||
          searchText(cellText(row, column)).includes(searchText(filters[column.key])),
      ),
  )
  const column = columns.find((item) => item.key === sort)
  if (!column) return result
  return result.sort((a, b) => {
    const first = a[sort]
    const second = b[sort]
    const order =
      typeof first === 'number' && typeof second === 'number'
        ? first - second
        : collator.compare(cellText(a, column), cellText(b, column))
    return (
      (direction === 'desc' ? -order : order) ||
      collator.compare(String(a.id ?? a.uid ?? ''), String(b.id ?? b.uid ?? ''))
    )
  })
}
