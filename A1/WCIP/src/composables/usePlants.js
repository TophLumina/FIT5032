import { onMounted, ref, shallowRef } from 'vue'
import { getPlants } from '@/services/plants'

export function usePlants() {
  const plants = shallowRef([])
  const loading = ref(true)
  const error = ref('')

  async function loadPlants() {
    loading.value = true
    error.value = ''
    try {
      plants.value = await getPlants()
    } catch {
      error.value = 'Plant data could not be loaded. Please try again.'
    } finally {
      loading.value = false
    }
  }

  onMounted(loadPlants)
  return { plants, loading, error, loadPlants }
}
