# Find and save videos in Nest

Open [Nest](https://nest-ipad-pilot.onrender.com/) after the latest deployment is live. The child library opens without a website PIN. Choose **Rodičovský režim** and enter your **6–12 digit parent PIN**, then open **Vyhľadať videá**. You can also open [parent search](https://nest-ipad-pilot.onrender.com/discover) directly and sign in there. Choose **Detský režim** when finished to lock parent controls.

For a new server, set the parent PIN privately with `PARENT_PIN_OVERRIDE` in Render, or complete the protected initial setup. The retained website access PIN is only for that initial claim and legacy administration. It is not the PIN used for normal parent sign-in.

## Enable AI search once

AI search needs an OpenAI API key. API usage can incur charges and is billed separately from ChatGPT and your streaming subscriptions. The library and **Pridať odkaz** work without it.

1. Create an API key in your [OpenAI project](https://platform.openai.com/api-keys). Keep it private.
2. On your Mac, open [Render](https://dashboard.render.com/), select **nest-ipad-pilot**, then **Environment**.
3. Add **`NEST_AI_API_KEY`** and paste the key into its private value field.
4. Save, redeploy if prompted, wait for **Live**, then refresh Nest on the iPad.

Do not send the key in chat, put it in a URL, or commit it to GitHub. The optional `NEST_AI_MODEL` defaults to `gpt-5-mini`; another model must support the Responses API, web search, and structured output. Without a configured key, Nest explains that search is unavailable and does not substitute sample results.

## Search, review, and save

1. Start in **Ask Nest**. YouTube is selected by default because it can play inside Nest. Czechia is the default search country.
2. Describe what you want, for example “Gentle animal stories for a six-year-old,” then select **Vyhľadať videá**.
3. Review the title, image, source, and runtime. For YouTube, **Prehrať v Nest** opens a parent-only preview in the embedded player.
4. Select **Uložiť do detskej knižnice**. If the service did not provide a duration, enter the video's actual length in minutes when prompted.
5. Return to the library and select **Detský režim**. Approved selections are visible there. An explicit unapproved draft stays private to parents.

While a search is running, **Zastaviť hľadanie** cancels it. The request remains available to edit and retry. Nest ignores late results and aborts the provider request where possible; already processed API usage may still be billed.

Search uses public service pages and does not sign into your streaming accounts. Catalog availability, prices, subscription inclusion, and age suitability remain unverified. A topic, language, age, or runtime request guides the search but does not verify those properties. Review each result yourself.

## Images, duration, and playback

Preview cards try to use a real image from public video data or page metadata. Blocked or missing metadata and broken images fall back to an illustrated cover chosen from the title and description. Missing images on existing selections are filled when a parent opens the library.

Nest reads YouTube duration from actual public video metadata. An optional server-side **`YOUTUBE_API_KEY`** enables the Google YouTube Data API as another source; the key is not required to build the app or use manual duration entry. Enter any such key privately in Render, never in chat or client code. Paid-service runtimes are usually manual. Nest does not invent a duration with AI. Older entries with no available runtime retain an unknown-length label until edited or enriched.

The YouTube fullscreen control uses browser fullscreen when supported and an expanded view inside Nest otherwise. Close the player to stop playback. Some videos prohibit embedding. YouTube can still display ads, links, and navigation within its player; the embedded player does not guarantee access only to your approved list. To retain the requested strict child restriction, YouTube playback is available only to parents. Children can see approved streaming cards, but only approved uploaded MP4/WebM files play in child mode.

Netflix, Disney+, Prime Video, and HBO Max need a provider-supported playback integration before they can play in Nest. Recognizing their title links or showing their preview images does not add that integration. The interface does not offer a paid-service app handoff as a substitute for in-app playback.

## Paste a link

Choose **Pridať odkaz**, paste a YouTube video link, and load its details. Review or add the title and duration before selecting **Uložiť do detskej knižnice**. Other recognized catalog links can have metadata, but cannot play inside Nest yet. The interface starts with YouTube to keep that distinction clear.

The upgrade makes older saved streaming references visible in the child library once. Future entries explicitly saved as drafts remain private. A visible card for a service without an integrated player is still a catalog entry.

## Local development and hosting

Use Node.js 24. Copy `.env.example` to the ignored `.env` file and add private keys there if needed. After installing and building as described in the README, start with:

```sh
node --env-file=.env server/index.mjs
```

Plain `npm start` does not automatically load `.env`. No API key is needed for builds or mocked tests, and those tests do not demonstrate a live search with your account.

The free Render trial can reset library records and parent credentials when its temporary filesystem is replaced. Set `PARENT_PIN_OVERRIDE` privately to retain a chosen parent PIN across such fresh starts, and use persistent storage later if the library needs to survive deployments. See the [hosting guide](PUBLIC-HOSTING.md).
