import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const imagesDirectory = fileURLToPath(new URL('../public/images/', import.meta.url))
const manifestDirectory = fileURLToPath(new URL('../src/generated/', import.meta.url))
const targetWidths = [320, 640, 1280]
const webpOptions = { quality: 80, effort: 4 }
const manifest = {}
let variantCount = 0
let originalBytes = 0
let smallestBytes = 0
let largestBytes = 0

for (const folder of ['pages', 'plants']) {
  const entries = await readdir(join(imagesDirectory, folder), { withFileTypes: true })
  const outputDirectory = join(imagesDirectory, 'generated', folder)
  await mkdir(outputDirectory, { recursive: true })

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isFile() || !/\.(jpe?g|png)$/i.test(entry.name)) continue

    const input = await readFile(join(imagesDirectory, folder, entry.name))
    const metadata = await sharp(input).metadata()
    const rotated = [5, 6, 7, 8].includes(metadata.orientation)
    const width = rotated ? metadata.height : metadata.width
    const height = rotated ? metadata.width : metadata.height
    const widths = [...new Set(targetWidths.map((target) => Math.min(target, width)))]
    // Fingerprint the source and conversion settings so changed photos get new URLs.
    const fingerprint = createHash('sha256')
      .update(input)
      .update(JSON.stringify({ targetWidths, webpOptions, sharp: sharp.versions }))
      .digest('hex')
      .slice(0, 12)
    const stem = basename(entry.name, extname(entry.name))
    const variants = []

    for (const targetWidth of widths) {
      const filename = `${stem}-${fingerprint}-${targetWidth}.webp`
      const info = await sharp(input)
        .rotate()
        .resize({ width: targetWidth, withoutEnlargement: true })
        .webp(webpOptions)
        .toFile(join(outputDirectory, filename))

      variants.push({
        src: `/images/generated/${folder}/${filename}`,
        width: info.width,
        height: info.height,
        bytes: info.size,
      })
    }

    manifest[`/images/${folder}/${entry.name}`] = { width, height, variants }
    variantCount += variants.length
    originalBytes += input.length
    smallestBytes += variants[0].bytes
    largestBytes += variants.at(-1).bytes
  }
}

await mkdir(manifestDirectory, { recursive: true })
await writeFile(
  join(manifestDirectory, 'responsive-images.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
)

console.log(`Generated ${variantCount} WebP variants for ${Object.keys(manifest).length} photos.`)
console.log(
  `Total sizes: originals ${(originalBytes / 1000).toFixed(0)} kB; ` +
    `smallest variants ${(smallestBytes / 1000).toFixed(0)} kB; ` +
    `largest variants ${(largestBytes / 1000).toFixed(0)} kB.`,
)
