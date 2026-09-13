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

## Application structure

- Run the site locally with `npm run dev`. Firebase Auth and Firestore remain connected to the Week67 project; Firebase Hosting is disabled.
- Plant information stays in `public/data/plants.json`. `services/plants.js` shares one catalog request across pages, and `usePlants` handles loading and retries. Refresh the browser after changing the catalog.
- `PlantCard.vue` renders plant cards for the home page and finder; `utils/plantLabels.js` provides their shared labels.
- In Plant Finder, select **Search** or **Apply filters** to apply search, filter and sort changes. Applied choices and the page number are stored in the URL. Results show nine plants per page.
- `npm run lint` uses ESLint; Prettier handles formatting. No test scripts or emulator components are kept in the project.
