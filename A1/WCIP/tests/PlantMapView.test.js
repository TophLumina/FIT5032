import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import PlantMapView from '../src/views/PlantMapView.vue'
import { getMapOccurrences, searchMapPlaces } from '../src/services/map'

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
vi.mock('../src/services/map', () => ({ getMapOccurrences: vi.fn(), searchMapPlaces: vi.fn() }))
enableAutoUnmount(afterEach)

const observation = {
  id: '123',
  scientificName: 'Viola hederacea',
  eventDate: '2024-01-01',
  year: 2024,
  latitude: -37.81,
  longitude: 144.97,
  locality: 'Melbourne',
  dataset: 'Example dataset',
  datasetUrl: 'https://www.gbif.org/dataset/example',
  license: 'CC BY 4.0',
  uncertaintyMetres: 100,
  basisOfRecord: 'HUMAN_OBSERVATION',
  url: 'https://www.gbif.org/occurrence/123',
}
const result = {
  data: [observation],
  meta: {
    total: 400,
    returned: 1,
    limit: 300,
    truncated: true,
    excluded: 0,
    bounds: [144.75, -38, 145.35, -37.55],
    yearFrom: 2000,
    yearTo: 2026,
    commonName: 'Native Violet',
    acceptedName: 'Viola hederacea',
    sourceUrl: 'https://www.gbif.org/occurrence/search',
  },
}
const place = {
  id: 1,
  name: 'Fitzroy',
  region: 'Victoria',
  latitude: -37.79839,
  longitude: 144.97833,
}
beforeEach(() => {
  getMapOccurrences.mockResolvedValue(structuredClone(result))
  searchMapPlaces.mockResolvedValue({ data: [place] })
})
async function setup(query = '') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/map', name: 'plant-map', component: PlantMapView },
    ],
  })
  await router.push('/map' + query)
  await router.isReady()
  const wrapper = mount(PlantMapView, {
    global: {
      plugins: [router],
      stubs: {
        PlantObservationMap: {
          name: 'PlantObservationMap',
          props: ['records', 'mode', 'targetBounds', 'queriedBounds', 'selectedId'],
          emits: ['bounds-change', 'select'],
          template: '<div aria-label="Map test stand-in" />',
        },
      },
    },
  })
  await flushPromises()
  return wrapper
}
const button = (wrapper, text) => wrapper.findAll('button').find((item) => item.text() === text)

describe('plant map workflows', () => {
  it('honours plant-detail links and explains limited data with a keyboard-accessible record list', async () => {
    const wrapper = await setup('?plant=coastal-rosemary')
    expect(getMapOccurrences.mock.calls[0][0].plant).toBe('coastal-rosemary')
    expect(wrapper.text()).toContain('non-random subset')
    expect(wrapper.findAll('#map-records-search')).toHaveLength(1)
    await button(wrapper, 'View record 123').trigger('click')
    expect(wrapper.get('#record-heading').text()).toBe('Observation details')
    expect(wrapper.text()).toContain('100 metres')
    expect(wrapper.find('a[href="https://www.gbif.org/occurrence/123"]').exists()).toBe(true)
    await button(wrapper, 'Close details').trigger('click')
    expect(wrapper.find('#record-heading').exists()).toBe(false)
  })

  it('searches places on submission and recentres/queries when a result is chosen', async () => {
    const wrapper = await setup()
    await wrapper.get('#map-place').setValue('Fitzroy')
    expect(searchMapPlaces).not.toHaveBeenCalled()
    await wrapper.findAll('form')[0].trigger('submit')
    await flushPromises()
    expect(searchMapPlaces.mock.calls[0][0]).toBe('Fitzroy')
    await wrapper
      .findAll('button')
      .find((item) => item.text().includes('Fitzroy'))
      .trigger('click')
    await flushPromises()
    expect(getMapOccurrences).toHaveBeenCalledTimes(2)
    const bounds = getMapOccurrences.mock.calls[1][0].bounds
    expect(bounds[0]).toBeCloseTo(place.longitude - 0.045, 4)
    expect(wrapper.text()).toContain('Area centred near Fitzroy')
  })

  it('queries the current viewport with selected years, and provides a density table', async () => {
    const wrapper = await setup()
    wrapper
      .findComponent({ name: 'PlantObservationMap' })
      .vm.$emit('bounds-change', [144.8, -37.9, 145.1, -37.7])
    await wrapper.get('#map-from').setValue('2020')
    await wrapper.get('#map-to').setValue('2024')
    await wrapper.findAll('form')[1].trigger('submit')
    await flushPromises()
    expect(getMapOccurrences.mock.calls.at(-1)[0]).toMatchObject({
      bounds: [144.8, -37.9, 145.1, -37.7],
      yearFrom: 2020,
      yearTo: 2024,
    })
    await button(wrapper, 'Record density').trigger('click')
    expect(wrapper.text()).toContain('Density data as a table')
    expect(wrapper.findComponent({ name: 'PlantObservationMap' }).props('mode')).toBe('density')
  })

  it('reports errors and empty searches without fake records, and allows retry', async () => {
    getMapOccurrences.mockRejectedValueOnce(new Error('GBIF unavailable'))
    const wrapper = await setup()
    expect(wrapper.get('[role="alert"]').text()).toContain('GBIF unavailable')
    expect(wrapper.find('#map-records-search').exists()).toBe(false)
    getMapOccurrences.mockResolvedValue({
      ...result,
      data: [],
      meta: { ...result.meta, total: 0, returned: 0, truncated: false },
    })
    await button(wrapper, 'Try again').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Missing records do not mean the plant is absent')
  })

  it('rejects reversed years without requesting data', async () => {
    const wrapper = await setup()
    await wrapper.get('#map-from').setValue('2025')
    await wrapper.get('#map-to').setValue('2020')
    await wrapper.findAll('form')[1].trigger('submit')
    expect(getMapOccurrences).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[role="alert"]').text()).toContain('Start year')
  })

  it('cancels stale observation requests and ignores late results', async () => {
    let resolveFirst
    getMapOccurrences.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve
        }),
    )
    const wrapper = await setup()
    const firstSignal = getMapOccurrences.mock.calls[0][1]
    await wrapper.get('#map-place').setValue('Fitzroy')
    await wrapper.findAll('form')[0].trigger('submit')
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((item) => item.text().includes('Fitzroy'))
      .trigger('click')
    await flushPromises()
    expect(firstSignal.aborted).toBe(true)
    resolveFirst({ ...result, meta: { ...result.meta, commonName: 'Stale result' } })
    await flushPromises()
    expect(wrapper.text()).not.toContain('Stale result')
  })
})
