# Open Nest on your iPad with a hosted web address

This guide uses Render to run the app at an HTTPS address reachable from Safari. Your GitHub repository can stay private. Publishing the cloud development environment does not host the website.

The default deployment requests Render's **free** plan for a short test, with no paid disk. Availability depends on your account and Render's current rules; review the dashboard before confirming. This is a deployment recipe, not an already-live website, and its live schema and current pricing have not been verified here.

**This temporary setup can lose all server-side test data**, including saved titles, uploads, and the parent PIN, when the service restarts, redeploys, or replaces its filesystem. It may sleep while idle and take time to wake up. The website access PIN remains in Render's environment settings. Observation reports are stored separately in the iPad's Safari storage; use **Export JSON** to keep a copy. Do not use this short trial as your permanent family library.

## 1. Connect your repository

1. On your Mac, open [Render](https://dashboard.render.com/) and sign in or create an account. Signing in with GitHub can simplify the next step.
2. Select **New → Blueprint**. Labels can change; look for the option to deploy from a repository's `render.yaml` file.
3. Connect GitHub if requested. Grant Render access to **jrehak-creator/moj-**; you do not need to make the repository public or grant access to unrelated repositories.
4. Choose that repository and its **main** branch. The `render.yaml` file must already be committed and pushed to this branch.
5. Continue to the deployment review screen. Render should propose a service named **nest-ipad-pilot**, a **free** service plan, and **no disk**.

## 2. Set the website access PIN and deploy

1. Confirm that the service uses the **free** plan with **no disk**. If the dashboard asks you to choose a paid plan, do not confirm a purchase just to run this trial; first review the options and your account's free-service eligibility.
2. When Render asks for **SITE_ACCESS_PIN**, enter a randomly chosen **8–12 digit PIN** in its secure environment-variable field. Keep it in your password manager. Do not put it in a GitHub file, URL, test note, or chat message.
3. Leave **REQUIRE_SITE_ACCESS=true**, **SESSION_COOKIE_SECURE=true**, **TRUST_PROXY=1**, and **DATA_DIR=.data** as prepared. Render supplies `PORT` and `RENDER_EXTERNAL_URL` automatically; you do not need to enter them.
4. Select Render's deploy/apply button after reviewing the settings. Wait until the service reports that it is live. The build installs dependencies and creates the browser app, then starts the server.
5. Open the service's HTTPS web address from its dashboard, typically ending in **.onrender.com**. Copy this actual address; `localhost` and the cloud workspace's private address will not work on your iPad.

The server refuses to start with a missing or invalid access PIN when `REQUIRE_SITE_ACCESS=true`. Do not turn off that setting to bypass a deployment error.

## 3. Open it on the iPad

1. Open **Safari** on the iPad and enter the Render HTTPS address.
2. At the website access screen, enter the **8–12 digit access PIN** you saved in Render, then tap **Open our Nest**.
3. Tap **Create parent PIN**. Choose and confirm a separate **6–12 digit parent PIN**. This claims the library and removes the example collection. There is no email recovery for this parent PIN.
4. Enter a short Netflix movie or episode name and its Netflix link. You can copy a link from Netflix's Share feature; a parent must still verify the exact episode after opening it.
5. Follow the [iPad test guide](IPAD-TEST.md), starting with **Prepare**, before giving the iPad to a child.
6. To put Nest on the iPad Home Screen, use Safari's **Share → Add to Home Screen**. This shortcut does not enable Guided Access or restrict Netflix.

The website access PIN opens this hosted site. The separate parent PIN protects library changes. Neither PIN locks the iPad or controls Netflix; Guided Access is configured on the iPad and started and ended by the parent. Netflix still requires its own app/subscription where applicable.

## 4. Check the hosted site before sharing its address

1. In a Safari Private Browsing tab, open the HTTPS address again. It should ask for the website access PIN before displaying library information.
2. Try one incorrect access PIN and confirm that it is rejected. Enter the correct PIN afterward.
3. Add a test title while in parent mode. Use **Lock parent controls**, reload, and confirm that changes require the parent PIN again.
4. Treat every title and parent PIN in this free trial as disposable. If the library resets, sign in with the website access PIN again, create a new parent PIN, and add the short test title again. Export your observation report before clearing Safari's website data or changing the site's address.
5. Keep your test supervised. Hosted web checks do not establish that Netflix autoplay, touch restriction, or the end of a video behaves correctly on the physical iPad.

The login endpoints limit repeated PIN attempts. If locked out after multiple failures, wait for the displayed retry period instead of repeatedly retrying.

## If deployment fails

- **Repository not visible:** check Render's GitHub connection and grant access to this repository.
- **Missing `render.yaml`:** the latest app and deployment files need to be pushed to `main` first.
- **Build fails:** read the Render build log. The expected command is `npm ci --include=dev && npm run build`, using Node.js 24 from `.node-version`.
- **Invalid access PIN:** correct `SITE_ACCESS_PIN` in Render's environment settings to contain 8–12 digits, then redeploy/restart as prompted. Do not paste its value into support messages.
- **PIN form rejects every request:** use the exact HTTPS address Render provides. A custom domain needs `PUBLIC_ORIGIN` set to that domain's origin, with no path, followed by a restart.
- **Changes disappear:** the default free trial has temporary storage, so a reset is possible. Recreate the parent PIN and test title as needed. The optional persistent version below is for keeping a library.

To stop the trial, use Render's dashboard to delete the service. No paid resource purchase is required by the default configuration.

## Optional: keep a permanent library later

The alternative [render.persistent.yaml](../render.persistent.yaml) uses a paid `starter` service with a **1 GB persistent disk**, `DATA_DIR=/var/data/nest`, and the same required website access PIN. It is not used automatically. Review Render's current service and disk charges before choosing it.

A maintainer can prepare a separate Git branch with `render.persistent.yaml` copied over `render.yaml`, commit and push that branch, then choose it in the Blueprint flow. This makes the paid configuration explicit at review time without changing the default free trial. Do not deploy both versions under the assumption that they share data; moving temporary trial data into a persistent service requires a separate migration.

After deploying the persistent version, restart its service once and verify that the saved title and parent PIN survive. Keep one service instance and one server process, back up the library if it matters, and remember that deleting the persistent disk deletes its saved library and uploads. Review and remove any paid resources you no longer want in Render's dashboard.
