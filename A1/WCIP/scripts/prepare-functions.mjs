import { mkdir, readFile, writeFile } from 'node:fs/promises'
const plants = JSON.parse(
  await readFile(new URL('../public/data/plants.json', import.meta.url), 'utf8'),
)
await mkdir(new URL('../functions/data/', import.meta.url), { recursive: true })
await writeFile(
  new URL('../functions/data/plants.json', import.meta.url),
  JSON.stringify(
    plants.map(({ slug, commonName }) => ({ slug, commonName })),
    null,
    2,
  ) + '\n',
)
