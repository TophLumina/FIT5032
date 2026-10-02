# WCIP

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
  - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

## Responsive photo prototype

`npm run dev` and `npm run build` first generate WebP versions of the JPEG/PNG photos
in `public/images/plants` and `public/images/pages`. The target widths are 320, 640,
and 1280 pixels, capped at each original's width. Original photos remain available
as JPEG fallbacks, and existing photo credits are preserved.

`src/components/ResponsiveImage.vue` supplies these variants through a `<picture>`
element with `srcset` and layout-specific `sizes`. The browser chooses a resolution
for the available space and screen density. Cards load lazily; detail-page hero
images load eagerly. No browser-side resizing or image server is required.

To regenerate after adding or replacing a photo while the dev server is running:

```sh
npm run images:generate
```

Generated files live in `public/images/generated` and
`src/generated/responsive-images.json`; both are excluded from Git. The generator
prints size totals and fingerprints source photos and conversion settings in the
variant filenames. Update each view's `sizes` if its image layout changes.

To inspect the prototype, open the browser's Network panel, disable its cache,
and reload `/plants` at different viewport sizes and device pixel ratios. Image
requests should use the generated `.webp` files. An image's `currentSrc` reveals
the selected variant. Compare fresh loads: a browser may reuse an already cached
larger variant after the window becomes smaller.
