import { mkdir, readFile, writeFile } from 'node:fs/promises'
const plants = JSON.parse(
  await readFile(new URL('../public/data/plants.json', import.meta.url), 'utf8'),
)
await mkdir(new URL('../functions/data/', import.meta.url), { recursive: true })
// The emulator must not fetch production mail credentials. Never overwrite an existing override.
await writeFile(
  new URL('../functions/.secret.local', import.meta.url),
  'SENDGRID_API_KEY=emulator-disabled\n',
  { flag: 'wx' },
).catch((error) => {
  if (error.code !== 'EEXIST') throw error
})
await writeFile(
  new URL('../functions/data/plants.json', import.meta.url),
  JSON.stringify(
    plants.map(({ slug, commonName, scientificName, sunlight, water }) => ({
      slug,
      commonName,
      scientificName,
      sunlight,
      water,
    })),
    null,
    2,
  ) + '\n',
)
