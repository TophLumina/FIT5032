import { plantColumns } from './plantQuery.js'
import { cellText } from './tableQuery.js'

export const siteOrigin = 'https://wcip-fit5032-e0aef.web.app'

function csvCell(value) {
  let text = String(value ?? '')
  // Prefix potentially executable spreadsheet content, including leading whitespace/control chars.
  if (/^[\s\p{Cc}]*[=+@-]/u.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

export function plantingListCsv(plants) {
  const headers = [
    ...plantColumns.map(({ label }) => label),
    'Plant page',
    'Image author',
    'Image licence',
    'Image source',
  ]
  const rows = plants.map((plant) => [
    ...plantColumns.map((column) => cellText(plant, column)),
    `${siteOrigin}/plants/${encodeURIComponent(plant.slug)}`,
    plant.imageCredit?.author,
    plant.imageCredit?.license,
    plant.imageCredit?.sourceUrl,
  ])
  return (
    '\uFEFF' + [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
  )
}
