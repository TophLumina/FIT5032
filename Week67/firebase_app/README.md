# firebase_app

This course exercise uses the local Firebase demo project `demo-week67`. It must
not use WCIP's production Firebase project (`fit5032-e0aef`).

## Isolated Firebase setup

Start Auth (127.0.0.1:9098) and Firestore (127.0.0.1:8088) from `A1/WCIP`, which
already includes the Firebase CLI:

```powershell
$env:DEBUG = $null
npx firebase emulators:start --config ../../Week67/firbase_emulator/firebase.json --project demo-week67 --only auth,firestore
```

Then run `npm run dev` from `Week67/firebase_app` in another terminal. Create a
new local account for the exercise; WCIP accounts are not imported. Local emulator
data is temporary unless explicitly exported. Stopping the emulators makes exercise
requests fail locally; both development and built code have no production fallback.
The permissive books rules belong only to this demo and must not be deployed to a
real Firebase project. WCIP uses separate emulator ports (9099 / 8080).

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
