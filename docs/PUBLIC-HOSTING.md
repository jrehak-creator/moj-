# Open Nest on your iPad with a hosted web address

Nest's default homepage is the child library. It opens without a website PIN. Approved video cards and approved uploaded media are public to anyone who can reach the site; parent search, edits, drafts, and unapproved media require the parent session. **Rodičovský režim** asks for a **6–12 digit parent PIN**. **Detský režim** signs out parent controls.

This guide uses Render for an HTTPS address that Safari can reach. Your GitHub repository can stay private. Publishing the cloud development environment does not host the website. The service may still be named **nest-ipad-pilot**, but the old iPad experiment is no longer a page or navigation item in Nest.

The default deployment requests Render's **free** plan with no paid disk. Availability and pricing depend on Render and your account. This temporary filesystem can lose saved titles, uploaded files, and hashed parent credentials when the service restarts, redeploys, or replaces its instance. Environment settings remain in Render. Use a persistent configuration before relying on the library for permanent storage.

## 1. Connect the repository

1. On your Mac, open [Render](https://dashboard.render.com/) and sign in.
2. Select **New → Blueprint** and connect GitHub if requested. Grant access to **jrehak-creator/moj-**.
3. Choose the repository's **main** branch, with the current `render.yaml` committed and pushed.
4. Review the proposed **nest-ipad-pilot** web service. The default recipe requests the **free** plan and **no disk**. Review any paid option before purchasing it.

## 2. Set private deployment values

1. Set **`SITE_ACCESS_PIN`** privately to **8–12 digits**. This retained value protects the first library claim and legacy administrative access; it is not a child homepage password.
2. Add **`PARENT_PIN_OVERRIDE`** privately with your chosen **6–12 digit parent PIN**. This configures parent access before the first visitor can claim the library. Use a different value from the initial-claim PIN.
3. Keep **`REQUIRE_SITE_ACCESS=true`**, **`SESSION_COOKIE_SECURE=true`**, **`TRUST_PROXY=1`**, and **`DATA_DIR=.data`** as prepared. Render supplies `PORT` and `RENDER_EXTERNAL_URL`.
4. Deploy and wait until Render reports **Live**. The build installs dependencies and creates the app, then starts the server.
5. Copy the actual HTTPS address from Render's dashboard. The current test service is [Nest](https://nest-ipad-pilot.onrender.com/). A localhost address or private cloud container address will not work on the iPad.

The server still validates the required `SITE_ACCESS_PIN` at startup. Do not remove it or disable protection to bypass a deployment error. With a configured parent PIN, normal browsing and parent login do not require entering it. If you do not preconfigure `PARENT_PIN_OVERRIDE`, complete the protected initial library claim yourself before sharing the address.

Private keys belong in Render's environment fields, never in GitHub, URLs, or chat. Optional **`NEST_AI_API_KEY`** enables AI search. Optional **`YOUTUBE_API_KEY`** provides another source for verified YouTube duration metadata. Read the [parent guide](PARENT-DISCOVERY.md) for setup and billing limits.

## 3. Open and check Nest on the iPad

1. Open the HTTPS address in Safari. The child library should appear directly, with no website PIN prompt.
2. Select **Rodičovský režim** and enter the parent PIN configured in Render.
3. Open **Vyhľadať videá**, search YouTube or use **Pridať odkaz**, and review a video. Select **Uložiť do detskej knižnice**. Add its actual duration if prompted.
4. Select **Detský režim**, refresh, and confirm that the approved selection is visible while editing controls are locked. An unapproved draft must stay out of child view.
5. Try the same address in a Private Browsing tab. Approved cards should remain visible; parent actions should still require the parent PIN.
6. To add Nest to the Home Screen, use Safari's **Share → Add to Home Screen**. This does not lock the device or restrict an embedded provider player.

Start with YouTube because it has an embedded player. Netflix, Disney+, Prime Video, and HBO Max need a provider-supported integration before they can play inside Nest; the app does not send the child into those services. YouTube can still show ads and navigation within its player, so it remains parent-only. Children can see approved streaming cards; child playback currently uses approved uploaded files. Preview the actual video on the actual iPad before relying on its playback behavior.

The login endpoints limit repeated PIN attempts. If temporarily locked out, wait for the retry period rather than continuing to guess. The parent PIN protects changes and private records, not the browser or device itself.

## PIN recovery

The parent PIN can be reset without knowing its old value:

1. Open [Render](https://dashboard.render.com/), select **nest-ipad-pilot**, then **Environment → Edit**.
2. Add or change **`PARENT_PIN_OVERRIDE`** to a new **6–12 digit PIN**.
3. Save and redeploy. If automatic deployment is disabled, deploy the latest commit from **main**. Wait for **Live**.
4. Open Nest, select **Rodičovský režim**, and enter the new parent PIN. The child homepage still has no website PIN prompt.

The override replaces the saved parent credential at startup and preserves existing family records and uploaded files. Only illustrative samples are removed when claiming a fresh library. The saved credential is a salted hash, and an invalid override prevents startup. Restarting signs out old sessions.

Leave the override configured if you want that parent PIN reapplied across fresh free-trial starts. Removing it keeps the last saved PIN only while the library data survives. Changing the override does not make temporary storage persistent.

To change the separate initial-claim/legacy administration PIN, edit **`SITE_ACCESS_PIN`** privately in Render to contain **8–12 digits** and redeploy. It is separate from ordinary parent login. Older instructions titled “Reset both PINs” referred to a website-wide gate that the current child homepage no longer uses.

## If deployment fails

- **Repository missing:** check Render's GitHub connection and repository access.
- **Build fails:** read the build log. The expected command is `npm ci --include=dev && npm run build`, using Node.js 24 from `.node-version`.
- **Invalid PIN setting:** `SITE_ACCESS_PIN` needs 8–12 digits; a configured `PARENT_PIN_OVERRIDE` needs 6–12 digits. Correct the private value and redeploy without sharing it in support messages.
- **Parent login fails:** use the parent PIN, then check the configured override or recover it as above. The child homepage does not ask for the initial-claim PIN.
- **Mutation requests fail:** use the exact HTTPS address provided by Render. A custom domain needs `PUBLIC_ORIGIN` set to its origin, with no path, followed by a restart.
- **Library disappeared:** free trial storage is temporary. Environment values can restore a configured parent PIN but cannot restore missing videos. Permanent storage requires the separate configuration below.

To stop the trial, delete the service in Render's dashboard.

## Optional permanent storage

The alternative [render.persistent.yaml](../render.persistent.yaml) uses a paid `starter` service with a **1 GB persistent disk**, `DATA_DIR=/var/data/nest`, and the retained deployment settings. It is not selected automatically. Review Render's current service and disk charges before choosing it.

A maintainer can prepare a separate branch with `render.persistent.yaml` copied over `render.yaml`, commit and push it, then select that branch in the Blueprint flow. Do not assume separate deployments share data; moving temporary trial data requires a separate migration.

After deployment, restart the service and verify that saved titles and the parent PIN survive. Keep one service instance and one server process, and back up the library if it matters. Deleting the persistent disk deletes its library records and uploads.
