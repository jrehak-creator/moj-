# Find and save videos in Nest

Open [Nest parent discovery](https://nest-ipad-pilot.onrender.com/discover) after the latest deployment is live. Enter your website access PIN, then unlock parent space with your separate parent PIN. The website PIN has 8–12 digits; the parent PIN has 6–12 digits.

## Enable Ask Nest once

AI search needs an OpenAI API key. API usage can incur charges and is billed separately from ChatGPT and your streaming subscriptions. The library and **Add a link** work without it.

1. Create an API key in your [OpenAI project](https://platform.openai.com/api-keys). Keep it private.
2. On your Mac, open [Render](https://dashboard.render.com/), select **nest-ipad-pilot**, then **Environment**.
3. Add an environment variable named **`NEST_AI_API_KEY`** and paste the key into its private value field. Keep the existing website PIN settings.
4. Save the change and redeploy if Render prompts you. Wait for **Live**, then refresh Nest on the iPad.

Do not send the key in chat, put it in a URL, or commit it to GitHub. It belongs on the server. The optional `NEST_AI_MODEL` variable defaults to `gpt-5-mini`; another model must support the Responses API, web search, and structured output.

On the free Render trial, a restart or deployment can reset saved titles and the parent PIN. The website access PIN stays in Render's environment settings. Recreate the parent PIN if the library resets.

## Search across services

1. In **Ask Nest**, choose the services you want searched. Czechia is the default country.
2. Describe what you want, for example **“Gentle animal stories for a six-year-old”** or **“Find Toy Story.”**
3. Review each suggestion and its source. Tap **Add to library** to save a parent-only reference.

Nest searches publicly available service pages. It does not sign into your streaming accounts or read your subscription entitlements. Results may be incomplete, outdated, or unavailable in Czechia; **availability is unverified and prices are not supplied**. A runtime, language, or age request helps guide the search but is not a verified filter. Check suitability and the exact title yourself before playback.

Without a configured key, Nest explains that AI search is unavailable. It does not substitute sample results. Automated checks use mocked responses; they do not demonstrate a live OpenAI search with your account.

## Paste a link instead

1. Choose **Add a link** and paste a title or video link from YouTube, Netflix, Disney+, Prime Video, or HBO Max.
2. Inspect the recognized service and cleaned link. YouTube can provide a public title, creator, and thumbnail. Other services currently require a title you enter yourself; video length is not read from the link.
3. Review the title and tap the save button. Open **Library** to manage saved references.

Streaming references stay in parent space. Saving one does not enable a restricted streaming player, skip intros, detect an episode ending, or return automatically from another app. Approved uploaded files remain the only child-playable videos in the web library. The existing [iPad experiment](IPAD-TEST.md) remains a separate parent-assisted playback test.

## Local development

Use Node.js 24. Copy `.env.example` to the ignored `.env` file and add your key privately. After installing and building as described in the README, start with:

```sh
node --env-file=.env server/index.mjs
```

Plain `npm start` does not load `.env` automatically. Set environment variables in your shell instead if preferred. No API key is needed to build the app or run its mocked tests.
