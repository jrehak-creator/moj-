# Nest: a family video library

Nest opens directly into the child library at **`/`**, without a website PIN. Approved videos and their preview cards are public to anyone who can open the site. Select **Rodičovský režim** and enter the **6–12 digit parent PIN** to search, add videos, or edit the library. **Detský režim** signs out parent controls and returns to the child library. `/library` opens the same library; `/discover` is the parent search area.

Search starts with **YouTube**, the streaming service currently supported by Nest's embedded player. The other service adapters can recognize catalog links and collect public metadata, but Netflix, Disney+, Prime Video, and HBO Max need a provider-supported integration before they can play inside Nest. The current interface does not hand a child off to those apps. Follow the [parent discovery guide](docs/PARENT-DISCOVERY.md) to enable AI search with a private server-side API key.

Use **Vyhľadať videá** to search and **Zastaviť hľadanie** to cancel. The input stays available for another attempt, and late results from a canceled request are ignored. Cancellation aborts the upstream request where possible; API work already processed may still be billed. Czechia remains the default search country. Public search results do not verify local availability, subscription access, age suitability, or prices.

Preview cards prefer the video's public web thumbnail. If an image is unavailable or fails to load, Nest shows an illustrated cover selected from the title and description. Missing images and durations on existing entries are refreshed when a parent opens the library. YouTube duration comes from actual public video metadata or the optional YouTube Data API, rather than an AI estimate. When a new result has no runtime, the save flow asks the parent to enter it. Older entries can still show an unknown duration until metadata is available or a parent edits them.

Use **Prehrať v Nest** in parent mode to preview a YouTube video inside Nest. The parent chose strict child containment: children see approved streaming cards but cannot launch their provider players. Child playback currently uses approved uploaded files. The fullscreen control uses browser fullscreen where supported, with an expanded in-page view as a fallback. Closing the player stops the video. YouTube's embedded player can show ads, links, and navigation to other content; Nest does not guarantee that streaming playback stays within the selected list. Some videos prohibit embedding. Approved uploaded MP4/WebM files use Nest's own player.

## Run locally

Use Node.js 24 and npm. From this checkout:

```sh
npm ci
npm run build
npm test
npm start
```

The built app listens on port **3001**. `npm run dev` starts the API on **3001** and Vite on **5173**. Rebuild the client before production startup after changing its source.

An iPad needs an address it can reach: a computer's local network address on a trusted Wi-Fi network or an HTTPS hosting address. Loopback and cloud container addresses are not iPad preview URLs. Publishing the development environment does not host the website. See the [public hosting guide](docs/PUBLIC-HOSTING.md) for Render setup.

## Visibility, data, and parent controls

New streaming selections are approved for the child library by default. A parent can keep an explicit unapproved draft private. The upgrade publishes external references saved by older versions once, because those versions forced all streaming links into parent-only storage. Future explicit drafts stay private. A visible catalog card does not create playback support for its service.

Parent authentication protects search, changes, drafts, and unapproved uploaded media. The parent PIN does not lock the browser or device. There is no email recovery; the server owner can set **`PARENT_PIN_OVERRIDE`** privately in Render to recover parent access. See [PIN recovery](docs/PUBLIC-HOSTING.md#pin-recovery).

The existing **`SITE_ACCESS_PIN`** deployment setting is retained for the protected initial library claim and legacy administrative access. It is not requested before the default child library or ordinary parent sign-in. The Render recipe still requires this private 8–12 digit value at startup; do not remove it to troubleshoot a deployment. Preconfiguring `PARENT_PIN_OVERRIDE` establishes the parent PIN without an initial setup claim through the browser.

Library records, hashed parent credentials, and uploaded files use `.data/` by default; `DATA_DIR` can select another writable directory. Preserve and back up this data if it matters. Sessions are in memory, so restarting signs parents out. The default free Render service uses temporary storage and can lose its library during a restart or deployment. The optional paid persistent configuration is separate and must be reviewed before use.

## Validation and archived experiments

`npm test` checks server behavior and mocked provider integrations; `npm run build` checks TypeScript and produces the browser build. A mocked AI response does not verify a live search with your API account. Browser checks do not prove that a particular YouTube video permits embedding, that fullscreen works on a physical iPad, or that the player contains a child within the selected list. Check the actual video and device.

The earlier [iPad feasibility guide](docs/IPAD-TEST.md) and [Shortcut experiment](docs/IPAD-SHORTCUT.md) are archived references. They are not routes or navigation in the current app. Their Netflix/Guided Access experiments did not establish automatic episode ending detection, intro skipping, or return to Nest.
