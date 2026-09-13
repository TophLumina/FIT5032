let catalogRequest

export function getPlants() {
  if (!catalogRequest) {
    catalogRequest = fetch(`${import.meta.env.BASE_URL}data/plants.json`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Plant data could not be loaded. Please try again.')
        const plants = await response.json()
        if (!Array.isArray(plants)) throw new Error('Plant data must be an array.')
        return plants
      })
      .catch((error) => {
        // Share successful requests across pages, but allow failed loads to be retried.
        catalogRequest = undefined
        throw error
      })
  }
  return catalogRequest
}
