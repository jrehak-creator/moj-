# Open Nest on your iPad using your Mac

Your Mac runs the test app. Your iPad opens it in Safari over your home Wi-Fi. You do not need to make the code public or pay for hosting. Keep the Mac awake while testing.

You need your Mac, your iPad, the same home Wi-Fi connection on both, and Netflix installed and signed in on the iPad.

## 1. Get the app onto your Mac

1. On your Mac, open this chat and download **nest-ipad-mac.zip** from the attachment link.
2. Open **Finder → Downloads**. Double-click the ZIP if Safari has not already extracted it.
3. You should see a folder named **nest-ipad-pilot**. Leave it there for now.

Use this ZIP, rather than downloading from GitHub: the prototype has not been uploaded to the repository yet.

## 2. Install Node.js

Node.js is the program that runs this app on your Mac. This installation is needed only once.

1. In Safari on your Mac, visit [nodejs.org/en/download](https://nodejs.org/en/download).
2. Select **Node.js 24 LTS** and the **macOS Installer (.pkg)**. Choose the official installer rather than the commands shown for other installation methods.
3. Open the downloaded `.pkg` and follow the installer. Your Mac may ask for your Mac login password.

## 3. Start the app on your Mac

1. Press **Command + Space**, type **Terminal**, and press **Return**.
2. Type `cd` followed by one space. Do not press Return yet.
3. Drag the **nest-ipad-pilot** folder from Finder into the Terminal window. Its location will appear after `cd`.
4. Press **Return**.
5. Copy this command into Terminal and press Return:

   ```bash
   bash scripts/start-mac.sh
   ```

6. The first run downloads the app's dependencies. Wait until it prints the addresses for opening Nest.
7. If macOS asks whether **Node** may access devices on the local network or accept incoming network connections, allow it for this test on your trusted home network.
8. Leave this Terminal window open. Leave the Mac awake with its lid open.

The script prints an iPad address similar to `http://192.168.1.25:3001`. The numbers will be different on your Mac. Use the address it prints.

## 4. Open it on your iPad

1. Check **Settings → Wi-Fi** on the iPad. It must be on the same home network as your Mac. Avoid a guest network.
2. Open **Safari**.
3. Tap the address bar, enter the complete **iPad address** printed in Terminal, including `http://` and `:3001`, then tap **Go**. Enter it in the address bar rather than a Google search box.
4. You should see Nest and **“The iPad experiment.”**

Do not use `localhost` on the iPad: that would refer to the iPad itself, rather than your Mac.

This setup is for your home network. It does not publish a public website. Keep the app on a trusted network; the parent PIN is not a password protecting the whole website.

## 5. Prepare one short Netflix test

Do this first test yourself, with the iPad in your hands.

1. In iPad **Settings → Accessibility → Guided Access**, turn Guided Access on and set its passcode. Keep that passcode private. It is separate from the Nest parent PIN.
2. In the Netflix profile settings, turn off **autoplay next episode** and **autoplay previews**, where available. You may need to do this on Netflix's website. Check the settings for the profile you will actually use.
3. Choose a short, suitable Netflix video or episode. Copy its Netflix link using Netflix's share/copy-link option, or copy its address from Netflix's website. Use a `https://www.netflix.com/watch/…` or `/title/…` address. A title-page link may require you to choose the exact episode afterward.
4. Return to Nest in Safari and tap **Create parent PIN**. Create a PIN for this prototype. Do not use your Netflix password or your device passcode.
5. Enter the **Movie or episode name** and **Netflix video link**. Set a short **Parent check-in after** time, then tap **Prepare the test**.
6. Set a separate iPad Clock alarm as a parent reminder. Nest's reminder is not reliable while Netflix is open.
7. Read and tick the three preparation boxes. Tap **Lock Nest & prepare handoff**, then **Open Netflix — parent action**.
8. Check that the correct Netflix profile, title, and exact episode opened. Start playback yourself. A link may open the app or a Safari page; record which one happens.

## 6. Lock touch and observe the ending

1. With the chosen video playing, triple-click the **top button** on an iPad without a Home button, or the **Home button** on a model with one. Choose **Guided Access** if a shortcut menu appears.
2. Open **Options** and turn **Touch off**. Start Guided Access and enter its passcode if asked. Follow the on-device prompts if your iPadOS labels differ.
3. Try tapping controls, swiping from the screen edges, and using the Home/app-switch gesture. Observe whether you can reach other content.
4. Stay with the iPad until the video ends. Watch the credits and any countdown. Does another episode or title start on its own? Even a brief unexpected start is a failed result for the approved-title-only goal.
5. Use the Guided Access exit shortcut, authenticate, and tap **End**. Follow the iPad's prompt if it offers a different shortcut for your configuration. Stop Netflix playback.
6. Return manually to the same Safari tab. Unlock Nest's parent access if asked, and record what actually happened in **See what happened**. Choose **not tested** for anything you did not observe.

**Touch off also disables the on-screen pause button.** A parent must exit Guided Access to use it. The prototype cannot automatically lock Netflix, stop the next title, or return to Safari. This experiment checks whether this manual approach works on your particular iPad; it does not yet establish an unattended child-safe player.

For interruption and offline experiments after this first test, see [the complete iPad test guide](IPAD-TEST.md).

## 7. Stop and reopen later

To stop the app, click its Terminal window and press **Control + C**. Your local app data stays in the extracted app folder. Keep that folder if you want to retain the library.

To run it another day, repeat step 3 and use the new iPad address printed by the script. Your Mac's Wi-Fi address can change.

## If something does not open

| What you see | What to try |
| --- | --- |
| `node` or `npm` is not found | Finish installing Node.js, close Terminal, open a new Terminal window, and repeat step 3. |
| Terminal cannot find `scripts/start-mac.sh` | Check that you extracted the ZIP. Repeat the `cd` and folder-drag steps using the folder that contains `package.json` and `scripts`. |
| Safari cannot open the page on the iPad | Keep the Mac awake and Terminal running. Check both devices use the same Wi-Fi and enter the printed iPad address exactly. |
| The Mac can open Nest but the iPad cannot | Check that Node has permission in **System Settings → Network → Firewall → Options**, if the firewall is enabled. Allow Node rather than disabling the firewall. Guest Wi-Fi or router client isolation can also prevent devices from reaching each other. |
| Netflix opens a series page | Select the intended episode yourself and confirm it before enabling Guided Access. |
| A different title starts automatically | End the session, record an observed failure, and check the actual profile's autoplay settings before another supervised test. |

If a step fails, note the step number and the exact message you see. Do not share passwords, PINs, or passcodes.
