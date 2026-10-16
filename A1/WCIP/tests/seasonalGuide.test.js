import { describe, expect, it } from 'vitest'
import { createSeasonalGuide } from '../functions/seasonalGuide.js'
import { senderConfig } from '../functions/emailMessage.js'
import plants from '../public/data/plants.json'

describe('seasonal guide and email provider', () => {
  it('uses Melbourne month boundaries and avoids encouraging summer planting', () => {
    const spring = createSeasonalGuide(plants, new Date('2026-08-31T14:01:00Z'))
    expect(spring.season).toBe('Spring')
    expect(spring.issueId).toBe('2026-09')
    const summer = createSeasonalGuide(plants, new Date('2026-11-30T13:01:00Z'))
    expect(summer.season).toBe('Summer')
    expect(summer.introduction).toContain('not a recommendation to plant during heat')
    expect(createSeasonalGuide(plants, new Date('2027-02-28T13:01:00Z')).season).toBe('Autumn')
    expect(createSeasonalGuide(plants, new Date('2027-05-31T14:01:00Z')).season).toBe('Winter')
  })
  it('requires a fixed configured sender and does not accept header injection', () => {
    expect(() => senderConfig({})).toThrow('not been configured')
    expect(() =>
      senderConfig({
        MAIL_FROM_EMAIL: 'a@example.test',
        MAIL_REPLY_TO_EMAIL: 'a@example.test',
        MAIL_FROM_NAME: 'WCIP\r\nBCC: bad',
      }),
    ).toThrow()
  })
})
