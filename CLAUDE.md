# SPICA SG / SG Health Pharma — Project Context

Pharma field-sales platform: a Next.js web app plus a Capacitor-wrapped
Android app, backed by Firebase. **Single login** at `/login` — anyone signs
in there and is routed by their custom-claim role: `admin`/`manager` →
`/admin/dashboard` (Dashboard, Doctors & Reps, Districts, Presentations,
Change Requests, Visit Logs, and — admin-only — Users & Roles + Slides
Library),
`rep` → `/rep` (view presentations, offline PDF access, submit requests). The
old `/admin-login` and `/rep-login` routes still exist as thin redirect
stubs to `/login`, for old bookmarks/cached APKs. This file exists so a
fresh Claude Code session has the context that isn't obvious from just
reading the code.

**The Android app is genuinely offline-first, not live-loaded** — this is
the app's core purpose (field reps presenting to doctors with no reliable
signal) and drove a full architecture reversal this project went through;
read "Android app: offline-capable local bundle" under Architecture
decisions before touching anything Capacitor/Android-related, it explains
several otherwise-surprising things (why `/admin/*` and `/api/*` get
physically moved out of `src/` during a build, why admin login involves a
custom-token handoff, why routes work with the phone in airplane mode).

## Directory structure — read this first

You are almost certainly running from `E:\SPICA PRODUCTION\studio-main`
(the outer folder). **That is not the project.** The real project — the one
with `package.json`, `src/`, `android/`, and its own `.git` — is nested one
level down at `E:\SPICA PRODUCTION\studio-main\studio-main`. `cd` there
before doing anything. The outer folder also contains `studio-main.zip`
(a ~180MB backup — leave it alone, it's not build output) and its own `.git`
that tracks the nested folder; don't touch that outer git state without
understanding why it's structured this way first.

## Tech stack

- **Next.js 14.2.35** — not 15. This matters: some config keys differ
  between major versions (see Gotchas below).
- React 18, TypeScript, Tailwind + shadcn/ui (Radix primitives).
- **Firebase**: client SDK (`firebase`) for auth/Firestore in the browser,
  Admin SDK (`firebase-admin`) for privileged server actions. Project ID
  `studio-6785763299-c920b`.
- **Storage for presentation files**: Cloudflare R2 (S3-compatible), accessed
  via `@aws-sdk/client-s3` pointed at R2's endpoint (`R2_ACCOUNT_ID`/
  `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET`/`R2_PUBLIC_URL` — only
  configured on Vercel, not present in this machine's `.env`/`.env.local`,
  so any local script needing to touch R2 directly can't). Not real AWS,
  despite the AWS SDK dependency; not Firebase Storage either.
  `src/lib/actions/generatePresentation.ts` is the only thing that writes to
  it. This is a migration *from* Supabase Storage — some **older**
  presentation records still have a `pdfUrl` pointing at the legacy Supabase
  bucket (`ezogujldmpxycodwboos.supabase.co`) if they were never regenerated
  since; `src/app/api/view-pdf/route.ts`'s proxy allowlists both hosts for
  exactly this reason. `src/lib/supabase.ts` itself is now dead/deprecated
  (`export {}`, kept only so stray imports don't break the build).
- **Capacitor 8** wraps the web app as a native Android app.

## Deployment — Vercel, not Firebase Hosting

`https://spicasg.in` is served by **Vercel**, auto-deploying on every push
to `main` on GitHub (`vrhsr/spica_updated`) — confirmed via response
headers (`Server: Vercel`, `X-Vercel-Id`). This matters because the repo
*also* contains a `firebase.json` `"hosting"` block and
`.github/workflows/firebase-hosting-merge.yml` / `-pull-request.yml` that
look like the deploy pipeline but **are not** — they're vestigial leftovers
from an earlier setup. Running `firebase deploy --only hosting` uploads a
handful of static files to `studio-6785763299-c920b.web.app`, a URL nobody
uses; it is a complete no-op for the actual site. If `spicasg.in` needs a
manual/emergency deploy and `git push` isn't an option, it has to go
through Vercel (CLI or dashboard), not Firebase.

**`git push origin main` may be denied** depending on which GitHub account
is credentialed in the current environment/session — it was denied earlier
in one session (`403`, wrong account) and worked normally later in the same
day with no change on this end. If it's denied, don't try to work around it
(no alternate deploy path reaches Vercel) — tell the user and let them push
from their own authenticated machine/account, or fix the credentials here.

## Architecture decisions

### Android app: offline-capable local bundle, NOT live-loaded
This reversed a prior decision — an earlier session set `server.url` in
`capacitor.config.json` so the WebView loaded `https://spicasg.in` live
(instant content updates, no rebuild). That broke the app's actual purpose:
a cold launch with no signal hit Chromium's native "Webpage not available"
interstitial with zero app content, because a Service Worker can't intercept
a request that never gets that far, and reps genuinely need to open
already-downloaded presentations with zero connectivity.

Current setup: `capacitor.config.json` has **no `server.url`** — Capacitor
serves a real local static export (`webDir: "out"`) by default, so `/`,
`/login`, `/rep`, `/rep/doctors`, `/rep/requests`, `/rep/offline`,
`/rep/present/view`, `/rep/pdf/viewer` all work with **zero network**, cold
start included. `src/app/page.tsx`'s landing card and `RepLayoutInner`
(`src/app/rep/layout.tsx`) already had the offline-redirect logic for this;
it just needed `server.url` gone to ever actually run.

- **`npm run build:capacitor`** (`scripts/build-capacitor.js`) produces this
  bundle: it temporarily **moves** everything server-only out of `src/`
  (`app/admin`, `app/admin-login`, `app/api`, `app/accept-invite`,
  `lib/actions`, `lib/firebaseAdmin.ts`, `lib/supabase.ts` — none of these
  can exist in a static export; the admin section needs the Admin SDK,
  which can never ship inside a client APK), runs `next build` with
  `BUILD_TARGET=capacitor` (→ `next.config.mjs`'s `isCapacitor` branch:
  `output: 'export'`, no PWA/Service Worker — a real local bundle doesn't
  need a SW-based fallback), then **moves everything back** in a `finally`
  block. `npm run cap:sync` afterward copies the fresh `out/` into
  `android/app/src/main/assets/public/`.
- **If this script crashes mid-`next build`** (see the OOM/access-violation
  gotcha below), the `finally` restore can fail to run, leaving `src/app/admin`
  etc. physically missing and sitting under a new `.capacitor-backup/`
  directory at the repo root instead. **Always verify before trusting the
  script's own "✓ Restored" log lines** — `ls src/app/admin/users/actions.ts`
  (or similar) and a full `npm run typecheck` — this has bitten multiple
  sessions, including one where the broken mid-build state got
  auto-committed and pushed to `origin/main`, so production ran with no
  `/admin/*` or `/api/*` routes at all until it was caught and fixed
  (see the auto-commit gotcha below, and "fix: restore admin/api/
  server-action files to their real paths" in git log for the recovery).
  If `.capacitor-backup/` exists before you run the script, it refuses to
  start — resolve that (move its contents back to their real paths) first.
- **`npm run release:android`** now runs `build:capacitor` + `cap:sync`
  automatically before the Gradle build, specifically so this local bundle
  can't silently go stale on a release (same class of drift risk as the
  Firestore-rules-deploy gotcha further down).
- **`accept-invite`** (first-time password setup) is also excluded from the
  bundle — it imports `markInviteAccepted` from `admin/users/actions.ts`
  (Admin SDK). Inherently one-time/online-only anyway (reached via an
  emailed link); opening that link in a regular browser still works fine,
  it just won't resolve from inside the app specifically.

### Admin/manager: native login, then a token handoff to the live site
The rep flow above is fully local and self-contained. Admin/manager can't
be — the whole admin portal needs the Admin SDK. Rather than dead-ending
after a successful native sign-in on a route that doesn't exist locally,
`src/app/login/page.tsx`'s `routeToDestination` does this for
`role === 'admin' | 'manager'` when `isCapacitorApp()`:
1. POSTs the caller's fresh ID token to `/api/mint-handoff-token`
   (`src/app/api/mint-handoff-token/route.ts`, live-site-only — verifies the
   token, checks the role, mints a short-lived Firebase **custom token** for
   the same uid via `adminAuth.createCustomToken`).
2. `window.location.href`s to `https://spicasg.in/admin/dashboard?handoff=<token>`
   — same WebView, not a Capacitor Browser/Custom Tab (a Custom Tab was
   tried first and rejected: visible browser chrome, and a separate storage
   partition that still forced a second login).
3. `admin/layout.tsx` reads `?handoff=` from `window.location.search`
   (not `useSearchParams()`, so no Suspense boundary needed), strips it
   from the URL immediately, and calls `signInWithCustomToken` — so the
   admin/manager lands already signed in instead of typing their password
   twice just because the local bundle and the live site are different
   origins that can't share a Firebase Auth session on their own.

Grants nothing the caller didn't already have (same uid, same role) — it's
a session bridge across origins, not a privilege escalation.
**`/api/mint-handoff-token` needs its own CORS headers** (`Access-Control-
Allow-Origin: *` + an `OPTIONS` handler) since it's called cross-origin from
the local bundle with a JSON POST body, which triggers a preflight — missing
either one makes the fetch fail silently and falls back to a plain
(re-login-required) `/login` page load, which looks identical to "admin
login is stuck in a loop" from the user's side.

### Android WebView doesn't behave like a normal browser — three fixes for that
- **`env(safe-area-inset-*)` isn't reliably populated on Android WebView**
  the way it is on iOS Safari, so every fixed/sticky top or bottom element
  (rep bottom tab bar, headers, `OfflineBanner`, admin sidebar/header) reads
  `max(env(safe-area-inset-*), var(--android-inset-top|bottom, 0px))`.
  `MainActivity.java` bridges the real values in via a
  `ViewCompat.setOnApplyWindowInsetsListener` on the WebView, injecting
  `document.documentElement.style.setProperty('--android-inset-*', ...)`.
  The same listener also forwards the **IME (keyboard) inset** as
  `--android-keyboard-inset` — needed because opting into edge-to-edge
  (`WindowCompat.setDecorFitsSystemWindows(window, false)`, required so the
  inset bridging above works at all) means
  `android:windowSoftInputMode="adjustResize"` in AndroidManifest.xml no
  longer automatically shrinks the window for the keyboard; `src/app/login/
  page.tsx` uses this var to keep the password field above the keyboard
  instead of it just covering the field.
- **Any cross-origin navigation gets handed to Android's Intent system by
  default** (opens the system's default browser, a real separate app, not
  just a Custom-Tab-style overlay) unless overridden. `MainActivity.java`'s
  `BridgeWebViewClient` subclass overrides `shouldOverrideUrlLoading` to
  force any navigation whose host contains `spicasg.in` to load in the
  *same* WebView (`view.loadUrl(...)`) instead — this is what makes the
  admin/manager handoff above (and any Firebase Auth email action link)
  actually feel like part of the app instead of popping out to Chrome.
- **`ScreenOrientation.lock()`/`StatusBar.hide()` calls made in a React
  effect's cleanup can get skipped entirely** if the exit path uses
  `window.location.replace()` (a hard navigation) instead of `router.replace()`
  — the hard nav can tear down the page before the cleanup reliably runs.
  `src/app/rep/present/view/page.tsx`'s offline exit path hit exactly this
  (screen stuck in landscape after exiting a presentation offline); it now
  calls `ScreenOrientation.unlock()`/`StatusBar.show()` explicitly right
  before navigating, on both the online and offline exit paths, rather than
  relying solely on unmount-cleanup timing.

### Splash screen
`resources/icon.png` + `resources/splash.png`/`splash-dark.png` (custom-mode
convention for `@capacitor/assets`) → `npx capacitor-assets generate
--android --splashBackgroundColor '#ffffff' --splashBackgroundColorDark
'#0f0f14'` regenerates the density-fanned drawables under
`android/app/src/main/res/`. **This tool does NOT touch
`drawable*/splash_icon.png`** (the small centered icon Android 12+'s native
SplashScreen API actually shows, per `styles.xml`'s
`windowSplashScreenAnimatedIcon`) — only the pre-Android-12 compat
full-bleed background (`drawable*/splash.png`). Regenerate that one by hand
(see git history for the sharp-based script) or the new branding never
shows on modern devices regardless of the `splash.png` work.

Two concrete things that bit this exact asset:
- A source image exported with a design tool's transparency-preview
  checkerboard baked into its actual pixels (saved as JPG, which can't hold
  real alpha) will put that checkerboard on the splash screen if handed to
  the generator directly. Verify any new source visually (or
  programmatically: sample a few "background" pixels) before regenerating.
- The Android 12+ native splash icon has a **circular safe zone** (~61%
  diameter of the canvas, matching the adaptive-icon 66dp/108dp spec) —
  content outside it gets clipped by devices/OEMs that enforce the mask.
  Trim transparent padding from the source logo first, then size the
  visible content (not the padded canvas) to keep it well inside that
  circle — verify by measuring the farthest non-background pixel's distance
  from center against the safe radius directly, not just by eyeballing the
  PNG.

`MainActivity.java` calls `SplashScreen.installSplashScreen(this)` (before
`super.onCreate()`, per the API's contract) with a custom
`setOnExitAnimationListener` — the `androidx.core:core-splashscreen` Gradle
dependency was already present but unused, so the splash previously just
cut away instantly with no transition.

### Offline PDF integrity
`src/lib/offline-pdf-store.ts` validates every downloaded PDF against both
its `%PDF-` header **and** `%%EOF` trailer (not just the header — a download
truncated mid-transfer, e.g. a flaky connection during sync, still has a
valid header but is missing everything from the cutoff point on, including
the trailer) — both at download time (`savePDFOffline`, fails loudly and
immediately as a retryable sync error) and at every app-startup verification
pass (`verifyAllOfflinePDFs`, marks bad cached files `state: 'FAILED'`).
`sync-manager.ts`'s `startDaySync` re-downloads anything already marked
`FAILED`, so a rep can self-heal a corrupt/truncated download with just
another "Start Day / Sync" tap. `/rep/offline` surfaces `FAILED` presentations
with a visible "Needs re-sync" badge so a rep can see a download isn't
trustworthy without first trying to present it.

This whole class of bug traces back to one root cause worth remembering:
**any client code that fetches `/api/*` must use the absolute
`https://spicasg.in/...` URL, never a relative path.** Those routes don't
exist in the local bundle (see above) — a relative fetch resolves against
the local origin, silently gets *something* other than the intended
response, and that "something" was getting saved to IndexedDB as if it were
the real PDF. Both `/api/view-pdf` and `/api/mint-handoff-token` need CORS
headers for this same reason (cross-origin call from the local bundle).

### Android in-app update checker
`android/app/src/main/java/com/spicasg/app/UpdateManager.java` calls
Firebase App Distribution's `updateIfNewReleaseAvailable()` on launch. Pairs
with `scripts/deploy-to-firebase.js`, which pushes a release APK to the
Firebase App Distribution **"representatives"** tester group. This has been
exercised end-to-end and works: `mvrhsr@gmail.com` is registered as a
tester, and the flow has pushed multiple releases (currently build 5+)
that showed the native "Update available" prompt on a real device. The
group is no longer empty, but only has that one tester — add more with:

```
firebase appdistribution:testers:add <email> --group-alias representatives
```

(**not** `--group` — that flag doesn't exist on this firebase-tools version
and fails with "unknown option"; it's `--group-alias`, easy to get wrong).
There's no wrapper script for this yet, just the raw command above.

This whole mechanism is a beta-testing tool, not a real distribution
channel — it requires each tester to be added by email and to sign in
once inside the app before it'll check for updates. It's the right choice
for a personal/free project handing the app to a handful of known reps;
it will never feel like a Play Store "just works" experience for a
stranger. (Play Store internal/managed distribution is the actual
equivalent of that, but costs money and a Play Console account — see
Outstanding items.)

Release flow: `npm run release:android` → `scripts/release-android.js`
bumps `android/app/version.properties` (versionCode/versionName — no longer
hardcoded in `build.gradle`), runs `build:capacitor` + `cap:sync`
(automatically, so the local offline-capable bundle can't silently go
stale — see "Android app: offline-capable local bundle" above), runs
`gradlew assembleRelease`, then deploys. **Release APK is signed with the
debug keystore** — fine for App Distribution, not acceptable for a Play
Store submission; a real release keystore would need to be generated and
wired into `android/app/build.gradle` first. This also means the debug
keystore's SHA-1 fingerprint is what matters for native Google Sign-In —
see the Gotchas section.

### User management: invite-by-email, no temp passwords, three-tier roles
- **No self-signup anywhere.** Only an admin can create accounts, via the
  "Add User" dialog (`src/app/admin/users/AddUserDialog.tsx` — used from
  both the Dashboard and the Users page). This used to be shared with
  managers too (`AddRepDialog`); managers lost user-creation entirely in a
  later pass — see below.
- **Invite flow**: creating a user sends a real email via Firebase's
  `sendPasswordResetEmail` with a custom `continueUrl` pointing at
  `/accept-invite` (`src/app/accept-invite/page.tsx`), where they set their
  own password. No temp password is ever generated, stored, or shown to an
  admin.
- **Roles**: `'admin' | 'manager' | 'rep'`.
  - `admin` — exactly **one** account, forever:
    `mvrhsr@gmail.com` (`KING_ADMIN_EMAIL` in
    `src/app/admin/users/constants.ts` — deliberately its own tiny module,
    see Gotchas). Never assignable to anyone else via any UI or server
    action; the only way to grant it is `node scripts/set-admin-role.js
    <email>`, a standalone script run outside the app.
  - `manager` ("Project Manager") — admin-portal access to Dashboard,
    Doctors, Districts (Cities), Presentations, Requests, Visit Logs. **Not**
    scoped by city (deliberate choice — unscoped, sees everything, same as
    admin for operational data). **No access at all** to Users & Roles or
    Slides Library (nav items hidden, pages gate on `role === 'admin'`,
    server actions in `actions.ts` reject non-admin callers) — can't add,
    edit, suspend, or delete any user, and can't touch the master slide
    library. Can create/update districts and cities but **cannot delete**
    either (Trash icons hidden for non-admin in `admin/cities/page.tsx`;
    enforced server-side too — `firestore.rules` splits `cities` /
    `districts_cities` into `create, update: isAdminOrManager()` vs
    `delete: isAdmin()`). Can add/edit doctors freely (`isAdminOrManager()`
    on the `doctors` collection, unrestricted in the UI).
  - `rep` — field sales rep, no admin-portal access at all.
- **Real server-side authorization**: every mutating action in
  `src/app/admin/users/actions.ts` (`createUser`, `deleteUser`,
  `toggleUserStatus`, `setUserRole`, `setUserCity`, `updateUserDetails`,
  `resendInvite`) is now `assertRole(['admin'])`-only — manager access to
  all of these was removed. `listAllUsers` stays `['admin', 'manager']`
  (read-only, scoped to reps-only for a manager caller) since the Dashboard
  still needs it for stats. Every action verifies a fresh Firebase ID token
  server-side against the caller's actual custom-claim role
  (`verifyCaller`/`assertRole`) rather than trusting a client-supplied
  uid/role string.
- **Ghost accounts filtered out**: anyone who clicks "Sign in with Google"
  without ever being invited gets a real but roleless Firebase Auth account.
  `listAllUsers` filters out any account with no custom-claim `role` at all,
  so these never show up in Users & Roles for anyone, admin included. Such
  an account hitting any protected route just bounces to `/` now (see
  `useRequireRole` below) rather than crashing.
- **Firestore rules are deployed and current** as of this pass (`firebase
  deploy --only firestore:rules` — re-run this **every time** `firestore.rules`
  changes; there is no CI tying deploy to the file, so it silently drifts
  otherwise, which caused a full afternoon of "permission denied" crash
  reports mid-session before the drift was noticed). `npm run deploy:rules`
  is a shortcut for the same command.
- **`useRequireRole` hook** (`src/hooks/useRequireRole.ts`) — centralizes the
  "wait for role to resolve, then gate-or-redirect" pattern for
  `admin/layout.tsx` and `rep/layout.tsx`. The specific bug it fixes: those
  layouts used to only block rendering on `!user`, not on role — so a
  signed-in account without portal access would briefly mount the real page
  underneath (dashboard, doctors, districts, whatever), and that page's own
  unguarded Firestore queries would fire and get denied before the "you
  don't belong here" redirect finished navigating away, crashing the whole
  app via `FirebaseErrorListener`. If you add a new top-level layout with
  its own role check, use this hook rather than hand-rolling the same
  timer/redirect logic again.
- **`FirebaseErrorListener`** (`src/components/FirebaseErrorListener.tsx`)
  now only crashes the app (throws, to surface the rich structured
  rule-denial context in the dev overlay — genuinely useful for debugging
  rule bugs, which is how several of these were found) in
  `NODE_ENV === 'development'`. In production it logs to console and shows a
  toast instead, so one denied query doesn't take down the whole page for a
  real user.
- **Firestore rules unit tests**: `firestore.rules.test.ts` +
  `vitest.config.ts`, run via `npm run test:rules`
  (`firebase emulators:exec --only firestore "vitest run ..."`). Needs
  **JDK 21+** on PATH for the Firestore emulator — this dev machine only has
  17, so it's never actually been run here, only written/wired up. Covers
  the exact regressions above (manager delete-denied on districts/slides,
  manager list-denied on `users`, rep city-scoping on doctors/presentations,
  owner-can't-change-own-role) so they can't silently come back.

### Premium visual system
- **Brand color is indigo-600** (`#4F46E5`), set once as `--primary` (and
  `--ring`) in `src/app/globals.css`'s CSS variables — every shadcn
  component (Button, Badge, Input, focus rings) inherits it automatically.
  It's also duplicated in three other places that don't read the CSS
  variable and need updating by hand if the brand color ever changes again:
  `android/app/src/main/res/values/colors.xml` (`colorPrimary`/
  `colorPrimaryDark`, native chrome), `public/manifest.json`
  (`theme_color`, PWA), and the `<meta name="theme-color">` tag in
  `src/app/layout.tsx`.
- **Two fonts**: Inter for body (`--font-body`), **Plus Jakarta Sans** for
  headlines (`--font-headline`) — both loaded via `next/font/google` in
  `src/app/layout.tsx` and mapped in `tailwind.config.ts`. Before this,
  `font-headline` was silently aliased back to Inter, so every
  `CardTitle`/`h1` in the app looked like body text despite the class being
  used everywhere — if headings ever look plain again, check this mapping
  didn't get reverted.
- **`--radius` is `0.75rem`** (was `0.5rem`) — matches what most pages were
  already hand-overriding to (`rounded-xl`/`rounded-2xl`), so the shared
  Button/Input default now agrees with the rest of the app.
- **`.bg-brand-gradient` / `.text-brand-gradient`** utility classes
  (`globals.css`, `@layer utilities`) formalize the blue/violet wash used
  on `/login`, `/accept-invite`, and the district cards — use these instead
  of retyping `bg-gradient-to-br from-blue-100 via-purple-100 ...` again.
- **Table headers** (`src/components/ui/table.tsx`) are uppercase/tracked/
  muted by default now. Gotcha: a `TableHead` that wraps a `<Button>` (e.g.
  a sortable-column filter trigger, see `admin/presentations/page.tsx`)
  needs the button's own text classes matched to
  `text-xs font-semibold uppercase tracking-wider text-muted-foreground`
  explicitly — the button's own `text-sm font-medium` otherwise overrides
  the inherited header style, which is exactly what happened there before
  it got fixed.
- **Dashboard stat cards** (`admin/dashboard/page.tsx`): the destructive
  (red-bordered/alarm) styling on "Pending Requests" and "Errors in 24h" is
  **conditional on the count being > 0**, not hardcoded — a stat card
  showing "0" should never look alarming. If you add a new stat card with a
  `variant`, make it conditional the same way.

### Doctors & Reps page (merged view)
`admin/doctors/page.tsx` — renamed from "Doctors" to "Doctors & Reps" (nav
label too, in `admin/layout.tsx`) — now has a Doctors/Reps segmented toggle
at the top, synced to a `?view=reps` query param (default is the doctors
view). The Reps side is a separate `RepsSection` component defined in the
same file, sourcing data from `listAllUsers` (same reasoning as the
`users` collection gotcha below — a direct Firestore query would fail for
a manager) and is **intentionally read-only**: no edit/suspend/delete
controls, since account management stays exclusively in Users & Roles
(admin-only). District cards on `admin/cities/page.tsx` link their
Doctors/Reps stat tiles straight into this page
(`/admin/doctors?city=X` and `/admin/doctors?city=X&view=reps`) instead of
showing static numbers — if you add a third "type" to browse this way
(e.g. presentations by district), follow the same `?view=` pattern rather
than inventing a new one.

## Gotchas that will bite you if you don't know them

- **`next.config.mjs` / Next 14 vs 15**: `serverExternalPackages` only
  exists as a top-level config key in Next 15+. On this project's Next
  14.2.x it must be `experimental.serverComponentsExternalPackages`,
  otherwise Next silently ignores it with just a console warning (this was
  broken for a while before being fixed this session).
- **`'use server'` files can only export async functions** (plus type-only
  exports, which are fine — types are erased at compile time). A plain
  `export const FOO = 'bar'` in a `'use server'` file breaks the *entire*
  dev server build, across every page, not just files that import it — the
  error is confusing and looks unrelated to the actual cause. This is why
  `KING_ADMIN_EMAIL` lives in `src/app/admin/users/constants.ts` rather than
  alongside the server actions in `actions.ts`.
- **`AddUserDialog`** (`src/app/admin/users/AddUserDialog.tsx`, admin-only)
  is the single shared "create any user" dialog, used from both
  `admin/dashboard/page.tsx` and `admin/users/page.tsx`. It used to live
  misnamed at `src/app/admin/reps/AddRepDialog.tsx` and take a
  `viewerRole` prop for manager access — that's gone now that managers
  can't create users at all. If you change how user creation works, grep
  for *all* its usages — it's easy to miss one (this bit twice already,
  once with `listAllUsers` call sites in dashboard/requests pages, once
  with this dialog itself).
- **Direct client-side Firestore queries on `users` will fail for a
  manager**, even though managers otherwise have broad admin-portal
  access — `firestore.rules` intentionally restricts `list` on `users` to
  `isAdmin()` only (managers get a *scoped* view, reps-only, but only
  through the `listAllUsers` server action, which uses the Admin SDK and
  bypasses rules entirely). Two pages got bitten by this
  (`admin/cities/page.tsx`'s rep-count query, `admin/visit-logs/page.tsx`'s
  now-removed dead `users` query) — if a page needs user data and might be
  viewed by a manager, go through `listAllUsers`, never
  `collection(firestore, 'users')` directly.
- **This dev machine is memory-constrained** — often only 900MB–2GB free RAM
  with Chrome/VS Code open, out of ~16GB total. Gradle/Android builds can
  OOM-crash with a native memory allocation failure (`hs_err_pid*.log`,
  `replay_pid*.log`). If that happens, ask the user to close some apps
  before retrying rather than endlessly retrying. `android/gradle.properties`
  already has a trimmed JVM config
  (`-Xmx768m -XX:TieredStopAtLevel=1 -XX:CICompilerCount=1 -XX:+UseSerialGC`).
- **No `chromium-cli` in this environment.** Playwright *is* available, but
  only via npx's cache, not as a project dependency — find the cached
  package under `~/AppData/Local/npm-cache/_npx/*/node_modules/playwright`
  and set `NODE_PATH` to that dir when running a throwaway driver script
  (`chromium.launch({ args: ['--no-sandbox'] })`).
- **Dev server runs on port 9002**, not 3000 (`next dev -p 9002`).
- **`.gitignore` used to be silently broken** — one line had embedded NUL
  bytes that defeated a credentials-filename ignore pattern, and it never
  covered build logs or crash dumps at all. That's why dozens of
  `hs_err_pid*.log`/`build-*.log`/scratch files had been committed to git
  history before this session cleaned them out. Current `.gitignore` covers
  `*.log`, `build*.txt`, `/dist/` — keep it that way.
- **Storage bucket naming inconsistency**: `google-services.json` lists
  `studio-6785763299-c920b.firebasestorage.app` while
  `src/firebase/config.ts`'s client config lists
  `studio-6785763299-c920b.appspot.com`. Both may resolve to the same
  underlying bucket (Firebase's newer default domain vs the legacy one), but
  this hasn't been verified — worth checking if storage access ever behaves
  unexpectedly.
- **This environment auto-commits (and can auto-push) periodic snapshots of
  the working tree**, outside of any explicit `git commit` call. Normally
  harmless, but it has more than once captured — and pushed to
  `origin/main`, which Vercel deploys from — a snapshot taken mid-`build:
  capacitor`, i.e. with the entire admin section/API routes/server actions
  sitting under `.capacitor-backup/` instead of their real paths (the
  script's own `finally`-block restore hadn't run yet). That means
  **production can end up silently broken** (no `/admin/*`, no `/api/*` at
  all) with no explicit action on anyone's part, and it can look completely
  unrelated on the surface — one instance of this presented as "admin login
  loops forever," which had nothing to do with the login code itself. If a
  bug report doesn't match what the code should be doing, check `git status`
  for `.capacitor-backup/*` deletions paired with `??` untracked entries at
  the real paths *before* debugging the reported symptom itself — that
  pattern means HEAD (and possibly what's deployed) is out of sync with a
  correct working tree, not that the working tree is broken. Recovery is a
  `git add -A` + commit (git detects it as pure renames back to the real
  paths — verify with `git diff --stat` that it's 100% renames, no content
  changes, before trusting it) + push.
- **`next build`'s static-generation phase can crash a Node worker process
  outright** on this memory-constrained machine — not a normal JS error, a
  raw exit code like `3221226505` (`0xC0000005`, a Windows access
  violation) right after linting/type-checking succeed. Default behavior
  spawns one worker *process* per CPU core for prerendering, each loading
  its own copy of the build graph; `next.config.mjs`'s `experimental: {cpus:
  1, workerThreads: false}` forces fully sequential prerendering instead —
  slower, but it only needs one worker's worth of memory at a time instead
  of several concurrently, and this is what actually stopped the crashes
  (confirmed by re-running the same build after the change). If it still
  happens, close other memory-heavy apps (Chrome, VS Code) first — same
  underlying constraint as the Gradle OOM gotcha above, just hitting the
  Next.js build step instead this time.
- **Native Google Sign-In fails with a SHA-1 fingerprint mismatch** — the
  fingerprint registered in Firebase/Google Cloud Console for
  `com.spicasg.app`'s Android OAuth client does not match this machine's
  actual debug keystore (`~/.android/debug.keystore`, which the release
  build uses per `build.gradle`'s implicit `signingConfigs.debug` — there's
  no explicit signing config). This is an external configuration problem,
  not fixable in code: add this machine's SHA-1
  (`keytool -list -v -keystore ~/.android/debug.keystore -alias
  androiddebugkey -storepass android -keypass android`) to the Firebase
  Console project's Android app settings. Whichever machine actually
  produces the installed APK is the one whose debug keystore fingerprint
  needs to be registered — if that changes (new dev machine, CI, etc.),
  this will need doing again.

## Scripts

- `npm run dev` — dev server on `:9002`.
- `npm run typecheck` — `tsc --noEmit`, fast and reliable for catching
  cross-file breakage (used heavily this session; no browser access implies
  leaning on this + Playwright headless checks + curl smoke tests).
- `npm run build:capacitor` — produces the Android app's local offline-capable
  bundle (`scripts/build-capacitor.js` + `next.config.mjs`'s `isCapacitor`
  branch). See "Android app: offline-capable local bundle" above before
  touching this — verify the restore actually completed (`ls src/app/admin/
  users/actions.ts`, full `npm run typecheck`) before trusting its own log
  output, every time.
- `npm run cap:sync` — `npx cap sync android`, copies web assets (i.e. the
  `out/` that `build:capacitor` just produced) + `capacitor.config.json`
  into the native project. Run `build:capacitor` first or this just
  re-copies whatever's already there.
- `npm run deploy:rules` — `firebase deploy --only firestore:rules`. Run
  this every time `firestore.rules` changes.
- `npm run test:rules` — Firestore rules unit tests (`firestore.rules.test.ts`
  via vitest, against the Firestore emulator). Needs JDK 21+ on PATH.
- `npm run release:android` — one-command Android release: bump version,
  build signed release APK, push to Firebase App Distribution.
- `node scripts/deploy-to-firebase.js "release notes"` — just the App
  Distribution push, using whatever's already built at
  `android/app/build/outputs/apk/release/app-release.apk`.
- `node scripts/set-admin-role.js <email>` — sets the `role: admin` custom
  claim directly via the Admin SDK, bypassing the app's own "one true admin"
  restriction. This is the *only* sanctioned way to (re)assign the admin
  account, e.g. for recovery.

## Firebase project details

- Project ID: `studio-6785763299-c920b`.
- Service account credentials live in `.env.local` as `FIREBASE_SERVICE_ACCOUNT`
  (a JSON string) — already gitignored via `.env*`. Never print, log, or
  echo this value; if you need to run a one-off Admin SDK script, load it
  with `require('dotenv').config({ path: '.env.local' })` and keep output
  to non-sensitive fields only.
- `firebase login` is already authenticated in this environment as
  `mvrhsr@gmail.com` (checked via `firebase login:list` this session).

## Outstanding items for the user (not done automatically)

1. **Real release keystore** — needed before any Play Store submission;
   currently release APKs are debug-signed. Decided against Play Store for
   now (personal/free project) — App Distribution is the update mechanism
   instead, see above. Revisit only if this ever needs to go to real users
   beyond a small known group of reps.
2. **App Distribution "representatives" group has only one tester**
   (`mvrhsr@gmail.com`) — add reps as they come on board:
   `firebase appdistribution:testers:add <email> --group-alias representatives`.
   Each new tester has to sign in once inside the app before update checks
   work for them.
3. **Visual premium pass**: the core system (brand color, headline font,
   table styling, gradient utility) now applies app-wide, plus dedicated
   redesigns of the Dashboard, Districts (cities), and the new Doctors &
   Reps page. Presentations, Visit Logs, and the PDF viewer have only
   inherited the system-level changes, not a bespoke pass — still open if
   more polish is wanted there specifically.
4. **`npm run test:rules` has never actually run** — this dev machine has
   JDK 17, the Firestore emulator needs 21+. Install a newer JDK (or run it
   in CI) to actually execute `firestore.rules.test.ts`.
5. **No CI** — `npm run typecheck` / `test:rules` / `deploy:rules` are all
   manual. Firestore rules have already drifted from deployed once this
   project's life (a whole session's worth of "permission denied" bugs
   traced back to it); wiring at least `deploy:rules` into a CI step after
   merge to main would prevent a repeat. (Vercel already auto-deploys the
   web app itself on push — this gap is specifically about Firestore
   rules, which are a separate deploy Vercel doesn't know about.)
6. **Google Sign-In is currently broken** in the installed app — the SHA-1
   registered in Firebase Console doesn't match this machine's debug
   keystore. See the Gotchas entry; needs someone with Firebase Console
   access to add the fingerprint. Email/password sign-in is unaffected.
7. **`npm run test:rules` and the memory-constrained-machine gotchas would
   both benefit from a real CI runner** — a machine with enough RAM and a
   real JDK 21 install would eliminate both the Next.js build worker
   crashes and the never-run Firestore rules tests in one move, on top of
   item 5 above.
8. **The auto-commit/checkpoint mechanism in this environment is outside
   this project's control** but has caused real, production-affecting
   incidents (see the Gotchas entry) — worth the user's awareness that
   `origin/main` can change without an explicit `git commit`/`git push`
   from a session, and should be spot-checked (`git log`, `git status`)
   after any Android build work before assuming the deployed state matches
   intent.
