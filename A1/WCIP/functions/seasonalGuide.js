import { createHash } from 'node:crypto'
import { HttpsError } from 'firebase-functions/v2/https'
import { siteDay } from './shared/siteDate.js'

export const siteUrl = 'https://wcip-fit5032-e0aef.web.app'
const sources = [
  {
    title: 'Merri-bek City Council - Gardening with Indigenous Plants',
    url: 'https://www.merri-bek.vic.gov.au/globalassets/website-merri-bek/areas/living-merri-bek/environment/gardening-food-production/gardening-with-indigenous-plants-in-merri-bek-guide-booklet-1.pdf',
  },
  {
    title: 'State Flora - Planting Australian natives in spring',
    url: 'https://www.stateflora.sa.gov.au/news/planting-natives-in-spring',
  },
]
const seasons = {
  Spring: {
    introduction:
      'Use mild spring weather to establish suitable native plants before summer. Choose a position that matches the plant, and plan how you will water it while it settles in.',
    tasks: [
      'Plant when soil is moist and the forecast is mild.',
      'Check local frost risk before planting tender nursery stock.',
      'Keep new plants watered as warmer weather arrives.',
    ],
    slugs: ['common-everlasting', 'native-violet', 'spiny-headed-mat-rush', 'common-correa'],
  },
  Summer: {
    introduction:
      'Focus on caring for established plants and planning autumn planting. Hot weather can stress new plants; the shortlist below is for planning, not a recommendation to plant during heat.',
    tasks: [
      'Postpone new in-ground planting during hot, dry conditions.',
      'Check soil moisture around young plants and containers.',
      'Review shade, space and water needs before choosing autumn plants.',
    ],
    slugs: ['coastal-rosemary', 'common-everlasting', 'kangaroo-grass', 'spiny-headed-mat-rush'],
  },
  Autumn: {
    introduction:
      'Autumn is a useful planting window for Melbourne native gardens when the soil is moist and temperatures are mild. Start with a small area and match plants to its conditions.',
    tasks: [
      'Remove competing weeds before planting.',
      'Choose healthy nursery plants suited to your local soil.',
      'Water new plants in and keep checking moisture as they establish.',
    ],
    slugs: ['common-correa', 'common-everlasting', 'native-violet', 'kangaroo-grass'],
  },
  Winter: {
    introduction:
      'Use winter to review your garden and prepare for spring. Plant growth is slower in cold weather; check drainage and local frost conditions before putting new plants in the ground.',
    tasks: [
      'Avoid working in waterlogged planting areas.',
      'Inspect available light and room for mature plants.',
      'Ask a local indigenous nursery which plants suit your site.',
    ],
    slugs: ['common-correa', 'spiny-headed-mat-rush', 'native-violet', 'common-everlasting'],
  },
}

export function createSeasonalGuide(plants, date = new Date()) {
  const day = siteDay(date)
  const month = Number(day.slice(5, 7))
  const season =
    month >= 9 && month <= 11
      ? 'Spring'
      : month >= 3 && month <= 5
        ? 'Autumn'
        : month >= 6 && month <= 8
          ? 'Winter'
          : 'Summer'
  const issueId = day.slice(0, 7)
  const edition = new Intl.DateTimeFormat('en-AU', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Australia/Melbourne',
  }).format(date)
  const selected = seasons[season]
  const recommendations = selected.slugs.map((slug) => {
    const plant = plants.find((entry) => entry.slug === slug)
    if (!plant?.scientificName || !plant.sunlight?.length || !plant.water)
      throw new Error(`Missing seasonal plant facts: ${slug}`)
    return {
      name: plant.commonName,
      scientificName: plant.scientificName,
      conditions: `Light: ${plant.sunlight.map((value) => value.replaceAll('-', ' ')).join(' / ')}. Water once established: ${plant.water}.`,
      url: `${siteUrl}/plants/${slug}`,
    }
  })
  return {
    revision: 1,
    draftVersion: 0,
    issueId,
    edition,
    season,
    subject: `WCIP | ${edition} Melbourne planting guide`,
    introduction: selected.introduction,
    tasks: selected.tasks,
    recommendations,
    note: 'This is a WCIP shortlist from our plant catalogue, not a species-specific sowing calendar. Check mature size, soil, frost exposure and local suitability with a nursery. Low water needs describe established plants; new plants still need care.',
    sources,
    accountUrl: `${siteUrl}/account`,
    filename: `WCIP-Melbourne-${issueId}-planting-guide.pdf`,
  }
}

export function guideContent(guide) {
  return {
    subject: guide.subject,
    introduction: guide.introduction,
    tasks: [...guide.tasks],
    note: guide.note,
  }
}

// Only editorial text can change; plant facts, links, sender and subscription footer stay server-owned.
export function validateGuideContent(content) {
  const keys = ['subject', 'introduction', 'tasks', 'note']
  if (
    !content ||
    typeof content !== 'object' ||
    Array.isArray(content) ||
    Object.keys(content).length !== keys.length ||
    Object.keys(content).some((key) => !keys.includes(key))
  )
    throw new HttpsError(
      'invalid-argument',
      'Provide the subject, introduction, checklist and note.',
    )
  function text(value, label, maximum, multiline = true, required = true) {
    if (
      typeof value !== 'string' ||
      value.length > maximum ||
      (!multiline && /[\r\n]/.test(value)) ||
      [...value].some((character) => {
        const code = character.charCodeAt(0)
        return (code < 32 && !['\r', '\n', '\t'].includes(character)) || code === 127
      })
    )
      throw new HttpsError(
        'invalid-argument',
        `${label} must be valid text of at most ${maximum} characters.`,
      )
    const result = value.replaceAll('\r\n', '\n').replaceAll('\r', '\n').trim()
    if (required && !result) throw new HttpsError('invalid-argument', `${label} cannot be empty.`)
    return result
  }
  if (!Array.isArray(content.tasks) || content.tasks.length < 1 || content.tasks.length > 6)
    throw new HttpsError('invalid-argument', 'Include between 1 and 6 checklist items.')
  return {
    subject: text(content.subject, 'Subject', 200, false),
    introduction: text(content.introduction, 'Introduction', 1200),
    tasks: content.tasks.map((task) => text(task, 'Each checklist item', 240, false)),
    note: text(content.note, 'Additional note', 1200, true, false),
  }
}

export function emailText(guide) {
  return [
    `Hello from WCIP,`,
    `${guide.edition} | ${guide.season} in Melbourne`,
    guide.introduction,
    'This month in your garden:\n' + guide.tasks.map((task) => `- ${task}`).join('\n'),
    'Plants to explore:\n' +
      guide.recommendations
        .map(
          (plant) => `${plant.name} (${plant.scientificName})\n${plant.conditions}\n${plant.url}`,
        )
        .join('\n\n'),
    guide.note,
    'Your planting guide is attached as a PDF. It includes these recommendations and links to the gardening references.',
    `You received this because you subscribed to seasonal planting emails on WCIP. To unsubscribe, sign in to My account, turn off Seasonal planting emails and save: ${guide.accountUrl}`,
    'WCIP',
  ].join('\n\n')
}

export function previewDigest(guide, sender) {
  return createHash('sha256').update(JSON.stringify({ guide, sender })).digest('hex')
}
