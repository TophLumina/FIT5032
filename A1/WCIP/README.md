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

- Run the site locally with `npm run dev`. Firebase Auth and Firestore use the WCIP production project `fit5032-e0aef`. Course exercises now use the separate local `demo-week67` emulators. Hosting uses the `wcip` target.
- Plant information stays in `public/data/plants.json`. `services/plants.js` shares one catalog request across pages, and `usePlants` handles loading and retries. Refresh the browser after changing the catalog.
- `PlantCard.vue` renders plant cards for the home page and finder; `utils/plantLabels.js` provides their shared labels.
- In Plant Finder, select **Search** or **Apply filters** to apply search, filter and sort changes. Applied choices and the card page number are stored in the URL. Cards show nine plants per page; **Compare plants** shows ten rows per page, sortable headings and individual-column searches. Table filters and its current page are local to the open view.
- **Download planting list (CSV)** exports all current matches in their current order, including comparison-column searches. This is a gardening export, not an account-directory export.
- The administrator Dashboard user table supports global and individual-column search, heading sorting, role filters and ten rows per page. Administrator route checks and Firestore permissions apply independently.
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
`/plants/native-violet`, `/map`, `/login`, or `/account` directly works. HTML and the
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
rules deny the former Week67 `books` exercise collection. Week67 Auth and
Firestore now connect only to the local `demo-week67` emulators.

### Course exercise isolation (16 October 2026)

The Firebase overlap came from `Week67/firebase_app`, not `Week2345`, which does
not connect to Firebase. The production `books` allow-all rule was removed and
the updated WCIP rules were deployed to `fit5032-e0aef`. Five flat exercise book
documents (`name` / `isbn`) were backed up and deleted with update-time
preconditions. Their backup, including the previous deployed rules, is stored
locally in the Git-ignored file
`.firebase/backups/legacy-books-2026-10-16T05-54-16-801Z.json`.

The exercise now uses `demo-week67` with local Auth on port 9098 and Firestore
on port 8088. Its configuration has no production fallback. See
[`Week67/firebase_app/README.md`](../../Week67/firebase_app/README.md) for startup
instructions. WCIP continues to use its existing production Firebase project;
no Hosting, Worker, AI secret, administrator role or WCIP business data was
changed by this cleanup.

Verification: all nine Firestore rule tests passed, including denied book reads,
creation, updates and deletion for guests, members and administrators. Local
exercise registration and book CRUD passed against the separate emulators. Live
anonymous book reads and writes return 403, the books collection is empty, and
all other audited collection counts are unchanged. Public guides, plant comments,
Hosting and AI availability checks passed.

Firebase Auth contains two accounts; one has a WCIP profile or role, and the
other cannot reliably be attributed to an exercise. Both accounts were retained.
Removing the unclassified account requires confirming its owner/purpose first.

The first deployment passed HTTP checks for the homepage and direct application
routes, deployed JavaScript, the plant catalog, generated images, security headers
and cache policies. Live API checks passed temporary-account registration,
password sign-in, own-profile creation/read, and denial of ordinary-user access
to the user directory, administrator directory and status records. The temporary
account and profile were removed afterward. Browser interaction, session
persistence and visual checks still require a browser smoke test.

## Google account sign-in

Both `/login` and `/register` offer **Continue with Google** through Firebase
Authentication. A new Google user gets a WCIP profile with seasonal email
subscription off by default. Existing email/password users can sign in first,
then use **My account → Sign-in methods → Connect Google account** to link Google
to their existing Firebase UID, preserving comments and administrator roles.
Firebase controls matching-email identity resolution; the application never
merges Firestore records by email. Credential conflicts explain how to sign in
to the existing account instead.

The Google provider is enabled in project `fit5032-e0aef`. The versioned
`firebase.json` Auth configuration provisions the OAuth brand and client through
Firebase CLI; no OAuth client secret or Google access token is stored in frontend
code. The popup uses the project's Firebase Auth handler at
`https://fit5032-e0aef.firebaseapp.com/__/auth/handler`. Hosting's CSP permits the
Firebase popup loader at `https://apis.google.com`. Keep any new Hosting domain
in Firebase Authentication's authorized domains. If a browser blocks the popup,
the sign-in page explains how to retry.

Firestore and callable functions accept password and Google sessions. They still
check UID-based permissions; Google sign-in alone never grants an administrator
role. Profile synchronization uses canonical Firebase Auth data. Linking that
changes the canonical email resets the seasonal subscription, requiring consent
for the new address. The AI Worker already supports verified Google Firebase
tokens and requires no additional Google credentials or deployment.

For a new environment, configure the Auth provider before publishing the UI:

```sh
npx firebase deploy --only auth --project fit5032-e0aef --non-interactive
```

The provider configuration requires a support email belonging to an authorized
project owner/editor. Firebase adds its default OAuth redirect URI automatically;
do not duplicate that URI in `authorizedRedirectUris`.

Validation (16 October 2026): 118 application tests, 22 Functions integration
scenarios and 14 Firestore-rule tests passed, along with ESLint and the production
build. Emulator coverage includes Google profile sync, login deduplication,
existing-account linking, subscription preservation, administrator access and
revocation, mail permissions, and unsupported-provider denial. Production checks
confirmed an enabled Google provider, preserved password login, the authorized
Hosting domain and creation of a Google OAuth authorization URL with the expected
callback. These checks do not complete a real user's Google consent flow; that
remains a manual browser smoke test, including popup cancellation, reload and
sign-out. Mail tests never deliver real messages.

Deployment verification: the five authenticated callables are active on Node.js
22 and return 401 for guests; deployed Firestore rules include Google sessions.
Hosting serves the current login, registration and account routes, Google popup
CSP, matching JavaScript assets and logo. The SendGrid secret remains bound only
to the send-mail function, at version 2.

References: [Firebase Google sign-in](https://firebase.google.com/docs/auth/web/google-signin),
[account linking](https://firebase.google.com/docs/auth/web/account-linking),
[popup resolver dependencies](https://firebase.google.com/docs/auth/web/custom-dependencies).
The local `public/images/brand/google-g.png` asset is Google's
[official G logo](https://developers.google.com/static/identity/images/g-logo.png),
used with its [sign-in branding guidance](https://developers.google.com/identity/branding-guidelines).

## Cloud Functions: account activity and reporting

The `wcip` codebase runs Node.js 22 in `australia-southeast1`, alongside Firestore.
Each function has zero minimum instances and at most two instances. Firebase
billing is enabled; production APIs are enabled during setup.

| Function                   | Purpose                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `wcipSyncUserActivity`     | Verify the Firebase session, read canonical Auth profile data, sync the directory and record an observed authentication session |
| `wcipEmailPreferences`     | Read or save the caller's own seasonal-email subscription; reject supplied recipients or other profile fields                   |
| `wcipSeasonalEmailPreview` | Administrator-only current-month email, subscriber eligibility and PDF preview                                                  |
| `wcipSendSeasonalEmail`    | Administrator-only SendGrid delivery with PDF, live consent checks and monthly duplicate protection                             |
| `wcipDashboard`            | Return a prepared report only to a current administrator                                                                        |
| `wcipAggregateVisits`      | Maintain visit totals and daily counts after Firestore writes                                                                   |
| `wcipAggregateComments`    | Maintain current comment totals, user counts, daily plant rating sums and report details after create/update/delete             |
| `wcipHealth`               | Infrastructure health check                                                                                                     |

### Login meaning and permissions

Firebase Auth performs registration, password/Google authentication and session
persistence. The client calls `wcipSyncUserActivity` after authentication state
restoration and after the registration display name changes. The function accepts
no UID, email, name, count or timestamp from the request body. It reads UID and
`auth_time` from verified token claims and profile fields from Admin Auth.
Concurrent/repeated requests use the same SHA-256 UID/auth_time event key in one
Firestore transaction. A separate per-day UID marker ensures each account counts
once in that day's signed-in-user total. Token refresh and page reload do not
create a new authentication session.

`users.lastLoginAt` contains the latest known Auth sign-in time. The dashboard
also shows recorded sign-in counts and daily signed-in users, separately from app
opens/reloads. New history starts at `status/config.loginTrackingStartedAt`;
older restored sessions update their profile without inventing historical counts.
These are website-observed successful sessions, not an exhaustive authentication
security audit: a client that never calls the function is not recorded. Registration
also creates an authentication session. No password, raw token, IP address or chat
content is stored by these functions. Private login history and summary documents
are inaccessible to clients; the user's own synchronized profile remains readable.

### Aggregation and migration

`analyticsEntries` stores each source document's last applied contribution.
A transaction re-reads the current source and compares its projection before
applying deltas. This makes duplicate events, out-of-order delivery, edits,
deletions and historical backfill safe to repeat. The same transaction maintains
`analyticsTotals`, `analyticsDays`, `analyticsUserStats` and `analyticsComments`.
Functions retry failures; errors must be monitored so a persistent failure does
not leave reports stale. No trigger writes to its own source collection. Role
totals are joined to current WCIP profiles on the server.

Production data and rules were backed up before migration to the Git-ignored
`.firebase/backups/cloud-functions-migration-1792131237942.json`.
Backfill uses existing Firebase CLI authorization in memory; it creates no
service-account key file and does not change existing source records or roles.

```powershell
$env:DEBUG = $null
npm run functions:check
npm run test:functions
npm run test:rules
npx firebase deploy --only functions:wcip --project fit5032-e0aef --force --non-interactive
node scripts/backfill-analytics.mjs --project fit5032-e0aef
npx firebase deploy --only "firestore:rules,hosting:wcip" --project fit5032-e0aef
```

The initial deploy needs `--force` to acknowledge the newly enabled retry
policy; handlers are idempotent. Publish Hosting and tightened rules after
functions and backfill are ready. The frontend CSP permits the exact regional
Functions origin. AI and map requests continue to use the existing Worker; their
secrets and usage limits are unchanged. The seasonal email functions use this
codebase with a dedicated Secret Manager binding, as described in phase 7 above.

For local testing, run `npm run dev:emulators` and `npm run seed:emulators`,
then start Vite with `VITE_USE_EMULATORS=true`. The Functions SDK also connects
to localhost:5001 in this mode. Production builds always use the live backend.
The seed now backfills its synthetic activity summaries. Integration tests exercise
real callable Auth verification and Firestore triggers, parallel login deduplication,
canonical profile sync, same-day user deduplication, historical backfill, rating
edits/deletion, date validation and administrator revocation.

Migration validation (16 October 2026): 94 application tests, 12 permission-rule
tests and five Functions integration scenarios passed, alongside ESLint and the
production build. Browser checks verified last-sign-in column search, login counts
remaining unchanged after reload, prepared charts, sign-out clearing private data
and ordinary-user redirects. A temporary live ordinary account verified canonical
profile synchronization, login deduplication and administrator-report denial; the
account, profile and its statistical contribution were removed afterward. A live
visit creation/deletion exercised both trigger paths and totals matched source
records. Existing accounts and administrator roles were retained.

References: [Callable authentication](https://firebase.google.com/docs/functions/callable),
[Firestore trigger delivery](https://firebase.google.com/docs/functions/firestore-events),
[Write-time aggregation](https://firebase.google.com/docs/firestore/solutions/aggregation).
