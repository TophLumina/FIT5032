let plantsRequest = null

// Share both in-flight and completed requests until the page is reloaded.
export function getPlants() {
  if (!plantsRequest) {
    plantsRequest = fetchPlants().catch((error) => {
      // A failed request must not prevent later visits from trying again.
      plantsRequest = null
      throw error
    })
  }

  return plantsRequest
}

async function fetchPlants() {
  const response = await fetch(`${import.meta.env.BASE_URL}data/plants.json`)
  if (!response.ok) throw new Error(`Plant data request failed with status ${response.status}.`)

  const data = await response.json()
  if (!Array.isArray(data)) throw new TypeError('Plant data must be an array.')

  return data
}
