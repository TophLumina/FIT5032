import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import SeasonalEmail from '../src/views/SeasonalEmailView.vue'
import { isAdmin, user } from '../src/services/auth'
import {
  previewSeasonalEmail,
  saveSeasonalEmailDraft,
  sendSeasonalEmail,
  downloadGuide,
} from '../src/services/seasonalEmail'

vi.mock('../src/services/auth', async () => {
  const { ref } = await import('vue')
  return { isAdmin: ref(true), user: ref({ uid: 'admin' }) }
})
vi.mock('../src/services/seasonalEmail', () => ({
  previewSeasonalEmail: vi.fn(),
  saveSeasonalEmailDraft: vi.fn(),
  sendSeasonalEmail: vi.fn(),
  downloadGuide: vi.fn(),
}))
enableAutoUnmount(afterEach)
const source = {
  guide: {
    issueId: '2026-10',
    draftVersion: 0,
    subject: 'WCIP planting guide',
    season: 'Spring',
    edition: 'October 2026',
    introduction: 'Plant for your conditions.',
    tasks: ['Check soil.'],
    note: 'Check local suitability.',
  },
  sender: { name: 'WCIP', email: 'sender@example.test', replyTo: 'sender@example.test' },
  text: 'Hello subscribers. Manage your subscription in My account.',
  digest: 'digest',
  maximumBatch: 10,
  dailyLimit: 100,
  attachment: { filename: 'guide.pdf', base64: 'JVBERi0=', type: 'application/pdf' },
  recipients: Array.from({ length: 13 }, (_, i) => ({
    uid: `u${i}`,
    email: `user${String(i).padStart(2, '0')}@example.test`,
    displayName: `User ${i}`,
    status: i === 12 ? 'accepted' : 'ready',
    attempts: i === 12 ? 1 : 0,
    selectable: i !== 12,
    message: i === 12 ? 'Already accepted this month' : 'Not sent this month',
  })),
}
source.defaults = structuredClone({
  subject: source.guide.subject,
  introduction: source.guide.introduction,
  tasks: source.guide.tasks,
  note: source.guide.note,
})
const render = () =>
  mount(SeasonalEmail, {
    global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } },
  })
beforeEach(() => {
  vi.clearAllMocks()
  isAdmin.value = true
  user.value = { uid: 'admin' }
  previewSeasonalEmail.mockResolvedValue(structuredClone(source))
  sendSeasonalEmail.mockResolvedValue({
    issueId: '2026-10',
    results: [{ uid: 'u0', status: 'accepted', message: 'Accepted; not confirmed delivered.' }],
  })
})

describe('seasonal mail administrator flow', () => {
  it('blocks sending edited content until saved, then requires another review of the new preview', async () => {
    const wrapper = render()
    await flushPromises()
    await wrapper.get('input[aria-label="Send to user00@example.test"]').setValue(true)
    await wrapper.get('#mail-reviewed').setValue(true)
    await wrapper.get('#mail-subject').setValue('A guide for our community')
    await wrapper.get('#mail-introduction').setValue('Water young plants this weekend.')
    await wrapper.get('#mail-checklist').setValue('Check soil.\nWater seedlings.')
    await wrapper.get('#mail-note').setValue('Welcome to the community garden.')
    expect(wrapper.get('#mail-reviewed').element.checked).toBe(false)
    expect(wrapper.get('#mail-reviewed').element.disabled).toBe(true)
    expect(wrapper.get('button[type="submit"]').element.disabled).toBe(true)
    const pdf = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Download PDF to review')
    expect(pdf.element.disabled).toBe(true)
    const updated = {
      ...structuredClone(source),
      guide: {
        ...source.guide,
        subject: 'A guide for our community',
        introduction: 'Water young plants this weekend.',
        tasks: ['Check soil.', 'Water seedlings.'],
        note: 'Welcome to the community garden.',
        draftVersion: 1,
      },
      digest: 'edited-digest',
      text: 'The updated message.',
      attachment: { ...source.attachment, base64: 'updated-pdf' },
    }
    saveSeasonalEmailDraft.mockResolvedValueOnce(updated)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Save draft and update preview')
      .trigger('click')
    await flushPromises()
    expect(saveSeasonalEmailDraft).toHaveBeenCalledWith({
      issueId: '2026-10',
      draftVersion: 0,
      content: {
        subject: updated.guide.subject,
        introduction: updated.guide.introduction,
        tasks: updated.guide.tasks,
        note: updated.guide.note,
      },
    })
    expect(sendSeasonalEmail).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('The updated message.')
    expect(wrapper.get('button[type="submit"]').element.disabled).toBe(true)
    await pdf.trigger('click')
    expect(downloadGuide).toHaveBeenCalledWith(updated.attachment)
    await wrapper.get('#mail-reviewed').setValue(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(sendSeasonalEmail).toHaveBeenCalledWith(
      expect.objectContaining({ digest: 'edited-digest', recipientUids: ['u0'] }),
    )
  })
  it('validates checklist limits and restores saved text without sending or saving', async () => {
    const wrapper = render()
    await flushPromises()
    await wrapper
      .get('#mail-checklist')
      .setValue(Array.from({ length: 7 }, (_, i) => `Task ${i}`).join('\n'))
    expect(wrapper.get('[role="alert"]').text()).toContain('1 to 6')
    expect(
      wrapper.findAll('button').find((button) => button.text() === 'Save draft and update preview')
        .element.disabled,
    ).toBe(true)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Discard edits')
      .trigger('click')
    expect(wrapper.get('#mail-checklist').element.value).toBe('Check soil.')
    expect(saveSeasonalEmailDraft).not.toHaveBeenCalled()
    expect(sendSeasonalEmail).not.toHaveBeenCalled()
  })
  it('preserves typed text on a save conflict and requires reloading before sending', async () => {
    saveSeasonalEmailDraft.mockRejectedValueOnce({
      code: 'functions/failed-precondition',
      message: 'Another administrator updated this draft. Reload before editing again.',
    })
    const wrapper = render()
    await flushPromises()
    await wrapper.get('#mail-subject').setValue('My unsaved subject')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Save draft and update preview')
      .trigger('click')
    await flushPromises()
    expect(wrapper.get('#mail-subject').element.value).toBe('My unsaved subject')
    expect(wrapper.text()).toContain('Another administrator updated')
    expect(wrapper.get('button[type="submit"]').element.disabled).toBe(true)
    expect(sendSeasonalEmail).not.toHaveBeenCalled()
  })
  it('ignores a draft save response after an account change', async () => {
    let finish
    saveSeasonalEmailDraft.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const wrapper = render()
    await flushPromises()
    await wrapper.get('#mail-subject').setValue('Edited subject')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Save draft and update preview')
      .trigger('click')
    isAdmin.value = false
    user.value = null
    await flushPromises()
    finish(source)
    await flushPromises()
    expect(wrapper.text()).not.toContain('Draft saved')
    expect(wrapper.find('#mail-subject').exists()).toBe(false)
  })
  it('requires selection and review, then submits only UIDs and the server preview digest', async () => {
    const wrapper = render()
    await flushPromises()
    expect(wrapper.get('button[type="submit"]').element.disabled).toBe(true)
    expect(sendSeasonalEmail).not.toHaveBeenCalled()
    await wrapper.get('input[aria-label="Send to user00@example.test"]').setValue(true)
    expect(wrapper.get('button[type="submit"]').element.disabled).toBe(true)
    await wrapper.get('#mail-reviewed').setValue(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(sendSeasonalEmail).toHaveBeenCalledWith({
      issueId: '2026-10',
      digest: 'digest',
      recipientUids: ['u0'],
      requestId: expect.any(String),
    })
    expect(wrapper.text()).toContain('not confirmed delivered')
    expect(wrapper.get('button[type="submit"]').element.disabled).toBe(true)
    expect(wrapper.text()).toContain('Reload the preview')
  })
  it('paginates ten subscribers, limits selection and keeps accepted accounts locked', async () => {
    const wrapper = render()
    await flushPromises()
    expect(wrapper.findAll('tbody tr')).toHaveLength(10)
    for (const checkbox of wrapper.findAll('tbody input[type="checkbox"]'))
      await checkbox.setValue(true)
    await wrapper.get('#mail-subscribers-page').setValue('2')
    expect(wrapper.findAll('tbody tr')).toHaveLength(3)
    expect(wrapper.findAll('tbody input').every((input) => input.element.disabled)).toBe(true)
    await wrapper.get('#mail-subscribers-email').setValue('user12')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.get('tbody input').element.disabled).toBe(true)
    expect(wrapper.get('tbody').text()).toContain('Accepted by Gmail')
  })
  it('downloads the exact preview attachment without sending mail', async () => {
    const wrapper = render()
    await flushPromises()
    const button = wrapper
      .findAll('button')
      .find((entry) => entry.text() === 'Download PDF to review')
    await button.trigger('click')
    expect(downloadGuide).toHaveBeenCalledWith(source.attachment)
    expect(sendSeasonalEmail).not.toHaveBeenCalled()
  })
  it('distinguishes historical SendGrid acceptance from Gmail and shows confirmed blocks', async () => {
    const preview = structuredClone(source)
    preview.recipients = [
      { ...preview.recipients[12], provider: 'sendgrid' },
      {
        ...preview.recipients[0],
        provider: 'sendgrid',
        status: 'blocked',
        message: 'DMARC check failed',
        selectable: true,
      },
    ]
    previewSeasonalEmail.mockResolvedValueOnce(preview)
    const wrapper = render()
    await flushPromises()
    expect(wrapper.get('tbody').text()).toContain('Previously accepted by SendGrid')
    expect(wrapper.get('tbody').text()).toContain('Delivery blocked')
    expect(wrapper.get('input[aria-label="Send to user00@example.test"]').element.disabled).toBe(
      false,
    )
    expect(wrapper.get('input[aria-label="Send to user12@example.test"]').element.disabled).toBe(
      true,
    )
  })
  it('requires reloading after an uncertain response instead of silently resending', async () => {
    sendSeasonalEmail.mockRejectedValueOnce(new Error('network disconnected'))
    const wrapper = render()
    await flushPromises()
    await wrapper.get('input[aria-label="Send to user00@example.test"]').setValue(true)
    await wrapper.get('#mail-reviewed').setValue(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('check recorded results')
    await wrapper.get('form').trigger('submit')
    expect(sendSeasonalEmail).toHaveBeenCalledTimes(1)
  })
  it('clears subscriber details on an account change and ignores stale responses', async () => {
    let finish
    previewSeasonalEmail.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const wrapper = render()
    isAdmin.value = false
    user.value = null
    await flushPromises()
    finish(source)
    await flushPromises()
    expect(wrapper.text()).not.toContain('user00@example.test')
    expect(wrapper.find('form').exists()).toBe(false)
  })
})
