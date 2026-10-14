# WCIP

What Can I Plant? is a Vue application for a Melbourne gardening community.
It uses Firebase Authentication and Cloud Firestore, with Firebase Hosting for
the production frontend.

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

## Application structure

- Run the site locally with `npm run dev`. Firebase Auth and Firestore use `fit5032-e0aef`, which is also used by the Week67 exercise. Hosting uses a separate `wcip` target; this does not isolate the shared database or accounts.
- Plant information stays in `public/data/plants.json`. `services/plants.js` shares one catalog request across pages, and `usePlants` handles loading and retries. Refresh the browser after changing the catalog.
- `PlantCard.vue` renders plant cards for the home page and finder; `utils/plantLabels.js` provides their shared labels.
- In Plant Finder, select **Search** or **Apply filters** to apply search, filter and sort changes. Applied choices and the page number are stored in the URL. Results show nine plants per page.
- `npm run lint` uses ESLint; Prettier handles formatting.

## Firebase Hosting

The Firebase project is `fit5032-e0aef`. The `wcip` Hosting target in
`.firebaserc` points to the dedicated site `wcip-fit5032-e0aef`.
The frontend is deployed at [https://wcip-fit5032-e0aef.web.app](https://wcip-fit5032-e0aef.web.app).
Do not deploy WCIP over another application's default Hosting site.

Sign in with an account that can deploy to the project:

```sh
npx firebase login
npx firebase hosting:sites:list --project fit5032-e0aef
```

On first setup only, create the dedicated site if it is absent:

```sh
npx firebase hosting:sites:create wcip-fit5032-e0aef --project fit5032-e0aef
```

Publish the frontend:

```sh
npm run deploy:hosting
```

The Hosting predeploy hook builds the application and generates its responsive
images. Only `dist/` is uploaded. This command deploys only the `wcip` Hosting
target; it does not deploy functions or replace the project's shared Firestore
rules.

Hosting rewrites application routes to `index.html`, so opening or refreshing
`/plants/native-violet`, `/login`, or `/account` directly works. HTML and the
plant catalog are revalidated; fingerprinted JavaScript, CSS and generated
images have immutable caching. Security headers are defined in `firebase.json`
and reused by `npm run preview`.

To test the Hosting configuration locally:

```sh
npm run hosting:serve
```

Open `http://127.0.0.1:5000`. This serves the frontend locally; the application
still connects to the existing live Auth and Firestore services.

After deployment, verify the homepage, a direct plant detail URL, image loading,
registration, sign-in, session persistence after refresh, and sign-out. A signed-out
visitor to `/status` should be sent to sign-in; a signed-in ordinary user should
be sent to `/account`. Firestore must also reject ordinary-user access to the
user directory and status records, independent of the router guard.

Firebase Authentication's authorized domains include `wcip-fit5032-e0aef.web.app`
and `wcip-fit5032-e0aef.firebaseapp.com`. Add the corresponding authorized domain
if the Hosting site or custom domain changes. Administrator roles remain in `admins/{uid}`
with `role: "admin"`, provisioned only through a trusted administrator. The
existing shared rules retain the Week67 `books` exercise; review a separate
Firebase project before isolating or changing those shared resources.

The first deployment passed HTTP checks for the homepage and direct application
routes, deployed JavaScript, the plant catalog, generated images, security headers
and cache policies. Live API checks passed temporary-account registration,
password sign-in, own-profile creation/read, and denial of ordinary-user access
to the user directory, administrator directory and status records. The temporary
account and profile were removed afterward. Browser interaction, session
persistence and visual checks still require a browser smoke test.

## Cloud Functions foundation

`functions/` is a separate Node.js 22 package and the `wcip` codebase. Its
`wcipHealth` HTTP function runs in `australia-southeast1` with zero minimum
instances and a maximum of two instances. It returns a basic service status and
server timestamp for GET/HEAD and rejects other methods. It does not read or
write user data. This is an infrastructure check, not the later email or map
business functionality required by E.1.

```sh
npm ci --prefix functions
npm run functions:check
npm run functions:serve
```

Use Node.js 22 when developing functions. The isolated emulator uses the demo
project `demo-wcip`, and its endpoint is:

```text
http://127.0.0.1:5001/demo-wcip/australia-southeast1/wcipHealth
```

The function has passed local Node.js 22 emulator checks for GET, HEAD and rejected
POST requests. It has not been deployed: project billing is currently disabled.
Production function deployment requires enabling the Blaze plan in Firebase first:

```sh
npm run deploy:functions
```

Use the function URL returned by Firebase after a successful deployment. Hosting
does not depend on this function, so it can be deployed independently on Spark.
Future email API keys belong in server-side secret storage, never in frontend
`VITE_*` variables. Future privileged endpoints must verify Firebase ID tokens
and administrator roles on the server; Admin SDK access bypasses Firestore rules.
