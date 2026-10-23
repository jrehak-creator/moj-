# Nest: family video discovery and library

Nest brings parent search and saved video links into one shared family library. Open **`/discover`** for **Ask Nest**, a natural-language search across selected public pages from YouTube, Netflix, Disney+, Prime Video, and HBO Max, or **Add a link** to inspect and save a title. Czechia is the default search country. Follow the [parent discovery guide](docs/PARENT-DISCOVERY.md) to enable AI search with an optional server-side OpenAI API key.

Search results include supporting source links. They do not establish Czech catalog availability, access through your subscription, or current prices. Selecting a service chooses where to search; it does not connect your streaming account. Saved streaming links remain parent-only references. **`/library`** plays approved uploaded videos in child view.

The default page is a parent-assisted iPad streaming experiment: prepare one approved title, use Netflix's own player with manually enabled Guided Access, then record observed behavior. It does not provide a locked Netflix player or automatic return to the library. Start with the [iPad test guide](docs/IPAD-TEST.md) before handing a device to a child.

The optional [iPad Shortcut experiment](docs/IPAD-SHORTCUT.md) explicitly passes the selected Netflix URL to a named, user-installed Shortcut on each launch. It tests an Open URLs → Wait → Start Guided Access sequence, alongside the working two-step fallback. The website cannot verify that Netflix is ready or that the lock started; actual ending detection and automatic return remain unsupported.

To open the app on an iPad using an internet address, follow the [public hosting guide](docs/PUBLIC-HOSTING.md). The default Render Blueprint requests a free HTTPS trial with a website access PIN and temporary storage. Free-plan availability depends on the hosting account and Render's current rules; review the dashboard before deploying. The service may sleep, and all server-side library data and the parent PIN can reset. Reports stay in Safari's storage; export a copy. An optional paid persistent configuration is included separately for later. The files alone do not deploy a website. Your GitHub repository can remain private.

## Run locally

Use Node.js 24 and npm. From this checkout:

```sh
npm ci
npm run build
npm test
npm start
```

The built app listens on port **3001**. For development, `npm run dev` starts the API on **3001** and Vite on **5173**. Use `npm run build` after changing the client before running `npm start`.

To open it on an iPad, the server must be reachable from that iPad. On your own computer, connect both devices to the same trusted network and use the computer's local network address with port 3001 (or 5173 for development). For a cloud workspace, use a securely hosted or authenticated preview URL that the iPad can reach. A cloud container's private address and a `localhost` link are not iPad preview URLs. Configure hosting separately; running these commands does not publish the app.

## Data and parent controls

The prototype uses one shared family library on one server. The existing library supports a 6–12 digit parent PIN, with server-side authentication for parent actions. First-time PIN creation claims the shared library; do this yourself before giving others access. Keep the PIN private and return to child mode after editing. There is no email PIN recovery.

Library data, PIN credentials, and uploaded media persist under `.data/` by default; `DATA_DIR` can select another writable directory. Keep this directory private and back it up if the data matters. Restarting the server may require signing in again. The parent PIN protects library changes; it does not lock Safari, Netflix, or the iPad. Use a trusted household network or an appropriately secured host.

Public hosting must also require a separate **website access PIN**. The Render configuration sets `REQUIRE_SITE_ACCESS=true` and asks you to set `SITE_ACCESS_PIN` securely to 8–12 digits. The server refuses to start if this required PIN is missing or invalid. It protects library APIs and uploaded media before a visitor signs in; the app shell and health/access-status endpoints remain available. HTTPS hosting uses secure cookies. Do not commit PIN values or store them in URLs. This access gate does not provide Netflix/device restrictions.

The link adapters recognize and normalize supported title links from all five services. YouTube public metadata can supply a title, creator, and thumbnail; other services currently need manual details. Runtime stays unknown unless entered manually. Link recognition and AI discovery do not provide playback control or turn streaming links into child-contained playback. Verified catalog availability, subscription/rental comparisons, richer metadata, and native device controls remain future work.

## Validation

`npm test` checks server behavior; `npm run build` checks TypeScript and creates the browser build. Physical iPad tests in [docs/IPAD-TEST.md](docs/IPAD-TEST.md) are still required. Record **not tested** whenever there is no device evidence. In particular, a passing web test does not validate Netflix autoplay settings, Guided Access restrictions, playback end detection, or automatic return.

AI discovery tests use mocked provider responses. Live OpenAI search requires your own API key and has not been verified by those tests.
