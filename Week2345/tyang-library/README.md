# tyang-library

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

## Cloudflare Pages deployment

Production site: <https://tyang-library-week2345.pages.dev>

| Setting | Value |
| --- | --- |
| Pages project | `tyang-library-week2345` |
| Deployment method | Direct Upload with Wrangler |
| Production branch | `main` |
| Application directory | `Week2345/tyang-library` |
| Build command | `npm run build` |
| Build output | `dist` |
| Node.js version | `22.18.0` (see `.node-version`) |

The first production deployment was published on 2026-10-23. HTTP checks of `/`,
`/about`, and all referenced JavaScript, CSS, and favicon files returned 200 and
matched the local build. Cloudflare's Git integration returned an installation
error, so this project was created using Direct Upload. Git pushes alone do not
currently deploy the site.

### Deploy from an IDE terminal

Run from `Week2345/tyang-library`:

```sh
npm ci
npx wrangler login
npm run deploy
```

Login is only needed when Wrangler is not already authenticated. The deploy
script builds the local working tree and uploads only `dist` to the production
branch of `tyang-library-week2345`. Wrangler is pinned in `devDependencies`;
`wrangler.jsonc` records the Pages project name and build output directory.

The app uses Vue Router's history mode. Pages supplies SPA fallback for paths
such as `/about` when the output has no top-level `404.html`.

### Future GitHub Actions deployment

This Direct Upload project supports deployments from GitHub Actions. No workflow
has been configured yet. A future workflow should:

- Live at the repository root, for example `.github/workflows/deploy-week2345.yml`.
- Filter changes to this application and its workflow file.
- Use `Week2345/tyang-library` as the working directory for shell commands.
- Set up Node.js using this application's `.node-version` file and run `npm ci`.
- Run any checks, then `npm run deploy` for production changes on `main`.
- Supply `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` through GitHub Actions
  secrets. The API token needs Cloudflare Pages Edit access to the target account.

If Cloudflare's built-in Git integration is preferred later, repair the GitHub
installation and create a new Git-connected Pages project. Direct Upload
projects cannot be converted to that integration. For the new project's build
settings, use repository `TophLumina/FIT5032`, branch `main`, root directory
`Week2345/tyang-library`, build command `npm run build`, and output `dist`.
Update both `wrangler.jsonc` and the deploy script to that new project's name.

### C3

C3 (`create-cloudflare`) scaffolds a new application and can perform its initial
deployment. This existing application uses Wrangler directly, so it does not
need to be recreated with C3.

References: [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/),
[GitHub Actions deployment](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/),
[Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/),
[C3](https://developers.cloudflare.com/pages/get-started/c3/),
[SPA routing](https://developers.cloudflare.com/pages/configuration/serving-pages/).
