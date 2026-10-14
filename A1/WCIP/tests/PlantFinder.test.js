import { afterEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import plants from '../public/data/plants.json'
import PlantFinderView from '../src/views/PlantFinderView.vue'
import { downloadCsv } from '../src/utils/download.js'

vi.mock('../src/composables/usePlants', async () => {
  const { ref } = await import('vue')
  const { default: catalog } = await import('../public/data/plants.json')
  return {
    usePlants: () => ({
      plants: ref(catalog),
      loading: ref(false),
      error: ref(''),
      loadPlants: vi.fn(),
    }),
  }
})
vi.mock('../src/utils/download', () => ({ downloadCsv: vi.fn() }))
enableAutoUnmount(afterEach)

async function setup(query = '') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/plants', name: 'plants', component: PlantFinderView },
      { path: '/plants/:slug', name: 'plant-detail', component: { template: '<div />' } },
    ],
  })
  await router.push('/plants' + query)
  await router.isReady()
  const wrapper = mount(PlantFinderView, {
    global: {
      plugins: [router],
      stubs: {
        PlantCard: {
          props: ['plant'],
          template: '<div class="plant-card">{{ plant.commonName }}</div>',
        },
      },
    },
  })
  await flushPromises()
  return { wrapper, router }
}
const button = (wrapper, text) => wrapper.findAll('button').find((item) => item.text() === text)

describe('plant finder comparison and planting lists', () => {
  it('keeps cards, switches to a real 10-row table and downloads all 24 results', async () => {
    const { wrapper } = await setup()
    expect(wrapper.findAll('.plant-card')).toHaveLength(9)
    await button(wrapper, 'Compare plants').trigger('click')
    expect(wrapper.findAll('tbody tr')).toHaveLength(10)
    await button(wrapper, 'Next').trigger('click')
    await button(wrapper, 'Download planting list (CSV)').trigger('click')
    const [csv, filename] = downloadCsv.mock.calls[0]
    expect(filename).toBe('wcip-planting-list.csv')
    expect(csv.split('\r\n')).toHaveLength(plants.length + 2)
  })

  it('exports the filtered table in the selected order, and disables empty exports', async () => {
    const { wrapper, router } = await setup('?space=balcony&sort=name-desc')
    await button(wrapper, 'Compare plants').trigger('click')
    await wrapper.get('#plant-comparison-water').setValue('moderate')
    await wrapper.get('button[aria-label="Sort by Common name, ascending"]').trigger('click')
    const shownNames = wrapper.findAll('tbody tr td:first-child').map((item) => item.text())
    await button(wrapper, 'Download planting list (CSV)').trigger('click')
    const [csv] = downloadCsv.mock.calls[0]
    expect(
      csv
        .split('\r\n')
        .slice(1, -1)
        .map((line) => line.split(',')[0].slice(1, -1)),
    ).toEqual(shownNames)
    expect(router.currentRoute.value.query.space).toBe('balcony')
    await wrapper.get('#plant-comparison-commonName').setValue('unmatched')
    expect(button(wrapper, 'Download planting list (CSV)').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('No rows match')
  })

  it('applies the existing condition form and supports legacy pollinator links', async () => {
    const { wrapper, router } = await setup('?benefit=pollinators&page=999')
    expect(wrapper.get('#benefit-bees').element.checked).toBe(true)
    expect(wrapper.get('#benefit-butterflies').element.checked).toBe(true)
    await wrapper.get('#plant-search').setValue('Native Violet')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.findAll('.plant-card')).toHaveLength(1)
    expect(router.currentRoute.value.query.page).toBeUndefined()
    expect(router.currentRoute.value.query.q).toBe('Native Violet')
  })
})
