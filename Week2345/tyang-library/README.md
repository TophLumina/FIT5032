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
error, so this project was created using Direct Upload. The GitHub Actions
workflow below deploys changes to `main` once its Cloudflare credentials are set.

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

### GitHub Actions deployment

Workflow: [deploy-week2345.yml](../../.github/workflows/deploy-week2345.yml).
GitHub requires this file in the repository root's `.github/workflows` directory;
its shell commands run inside `Week2345/tyang-library`.

| Event | Behavior |
| --- | --- |
| Pull request targeting `main` | Install dependencies and build; no deployment credentials are used |
| Push to `main` | Install dependencies, build, and deploy to the existing Pages project |
| Manual run on `main` | Build and deploy |
| Manual run on another branch | Build only |

Push and pull request runs are filtered to changes in `Week2345/tyang-library/**`
or the workflow itself. Unrelated coursework changes do not trigger this workflow.
It reads `.node-version`, caches npm downloads using this application's lockfile,
and deploys only after the build succeeds. Production runs are serialized.

Configure the following in the repository's **Settings > Secrets and variables >
Actions**:

| Type | Name | Value |
| --- | --- | --- |
| Repository variable | `CLOUDFLARE_ACCOUNT_ID` | `669146a25a4a81b6fadf5df303c07e9e` (configured during setup) |
| Repository secret | `CLOUDFLARE_API_TOKEN` | A Cloudflare API token with Account > Cloudflare Pages > Edit permission, limited to the target account |

Create the token at <https://dash.cloudflare.com/profile/api-tokens> and save it
directly in [GitHub Actions secrets](https://github.com/TophLumina/FIT5032/settings/secrets/actions).
Do not commit the token or copy Wrangler's local OAuth credentials into GitHub.
If credentials are missing, the deployment step fails with a setup message while
the build result remains visible in the logs.

After the workflow is pushed to GitHub and the credentials are configured, open
**Actions > Week2345 build and deploy > Run workflow**, select `main`, and run it.
Subsequent matching pushes to `main` deploy automatically. This uses Wrangler
Direct Upload and does not depend on Cloudflare's GitHub App integration.

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
