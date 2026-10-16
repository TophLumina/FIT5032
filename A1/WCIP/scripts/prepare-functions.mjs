import { mkdir, readFile, writeFile } from 'node:fs/promises'
const plants = JSON.parse(
  await readFile(new URL('../public/data/plants.json', import.meta.url), 'utf8'),
)
await mkdir(new URL('../functions/data/', import.meta.url), { recursive: true })
// Always provide an emulator-only override, including after migrating from SendGrid.
const secretsPath = new URL('../functions/.secret.local', import.meta.url)
const overrides = await readFile(secretsPath, 'utf8').catch((error) => {
  if (error.code !== 'ENOENT') throw error
  return ''
})
if (!/^GMAIL_SENDER_CREDENTIALS=/m.test(overrides))
  await writeFile(
    secretsPath,
    `${overrides.trimEnd()}\nGMAIL_SENDER_CREDENTIALS=emulator-disabled\n`,
  )
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
