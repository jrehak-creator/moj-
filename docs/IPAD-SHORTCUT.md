# iPad Shortcut experiment

This experiment starts a named Shortcut **each time the parent launches a title from Nest**. It does not depend on Netflix's “App Is Opened” event. The user reported that opening a title from Nest and then running the locking Shortcut afterward worked on their iPad. This supports the two-step method; it does not establish why the earlier timing failed or that a combined shortcut will work.

The child-playback session remains supervised. This has not been validated on the user's iPad. A successful run would establish automatic lock activation for that test only; it would not establish automatic playback, intro skipping, end detection, or return to Nest.

## Before starting

1. Keep the iPad yourself. End any existing Guided Access session using the iPad's own exit shortcut and Guided Access passcode.
2. In **Settings → Accessibility → Guided Access**, confirm Guided Access is enabled and that you know how to end it. The Guided Access passcode is separate from both Nest PINs; do not enter any passcode into the Shortcut or Nest notes.
3. Confirm Netflix's correct profile has **autoplay next episode** disabled. Touch lock does not disable autoplay.
4. Confirm a manual Guided Access session in Netflix has **Touch off**, and that you can end it. The Shortcut does not configure these options. Recheck the resulting restriction during the experiment rather than assuming the previous options carry over.
5. If you created a Netflix **App Is Opened** personal automation, temporarily disable it in **Shortcuts → Automation** while testing. Depending on iPadOS, use **Enable This Automation → off** or **Don't Run**. Keep it available until the new method has been tested, but avoid running both methods together.

## Create a regular Shortcut

Keep the working locking Shortcut. Create a separate experiment so that you can return to the working method if it fails. Open **Shortcuts** and select the **Shortcuts** tab, not **Automation**. Tap **+** to create a regular Shortcut and name it exactly:

```text
Nest Playback
```

Add these three actions in order:

1. **Open URLs** (search for “Open URLs” or “Open URL”). For its URL value, choose the **Shortcut Input** variable. Tap or press and hold the URL field and choose **Select Variable → Shortcut Input**, if needed. Do not enter the Netflix home page or choose an **Open App → Netflix** action: Nest will pass the selected title's Netflix URL to the Shortcut.
2. **Wait**, set to **15 seconds**.
3. **Start Guided Access**.

The completed sequence should read approximately:

```text
Open [Shortcut Input]
Wait 15 seconds
Start Guided Access
```

Save the Shortcut. Labels and variable menus may differ by iPadOS version. If **Start Guided Access** is unavailable, do not substitute a similarly named action and assume it works. Use the manual method in [the iPad test guide](IPAD-TEST.md) and record which action is missing.

The 15-second delay is preparation time, not a playback detector. It can lock a login screen, profile chooser, wrong title, Safari, or another screen if the intended Netflix playback is not ready. A parent must stay present. Adjust the wait in Shortcuts if necessary, but a longer wait still does not confirm playback.

## Connect Nest to the Shortcut

1. Open Nest in Safari and enter the website PIN if asked.
2. Prepare the approved Netflix title using its actual `netflix.com/watch/…` or `netflix.com/title/…` link. A series page may still need manual episode selection.
3. In the parent preparation screen, choose **iPad Shortcut (experiment)** as the launch method.
4. Enter **Nest Playback** as the Shortcut name, matching the name in Shortcuts, including spaces. Confirm that you have installed the Shortcut.
5. Complete the remaining preparation checks, tap **Lock Nest & prepare handoff**, then tap **Run iPad Shortcut — parent action**.
6. Safari may ask to open Shortcuts. Confirm the request on the iPad. Other confirmation prompts or provider app-opening prompts may also appear; the website cannot suppress them.
7. Watch which app and title open. During the delay, confirm the correct Netflix profile and episode and start playback if needed. If the wrong screen is locked, end Guided Access using the device's exit shortcut and passcode.
8. When Guided Access starts, check that touch is actually disabled and that the iPad remains in Netflix. Use the known Guided Access exit method to stop this first test.

Nest passes the selected canonical Netflix URL as text to the named Shortcut through Apple's `shortcuts://run-shortcut` URL scheme. The handoff contains no Nest PIN or Guided Access passcode. It does not install the Shortcut, run arbitrary Shortcut actions from the website, or report success back to Nest.

Opening a Netflix link may still show Safari, a provider prompt, a sign-in screen, or title details instead of immediate app playback. If that happens, record it; the Shortcut does not remove those limitations. Nest retains the direct Netflix handoff as a fallback, with manual Guided Access activation.

## Test these cases separately

Each case must begin with Guided Access ended. Keep the old Netflix-opened automation disabled so that it cannot mask the result.

| Starting state | Parent action | Record |
| --- | --- | --- |
| Netflix is fully closed | Open Nest in Safari and invoke **Run iPad Shortcut — parent action** | Did the named Shortcut run, did the correct title open, and did Netflix lock with touch off? |
| Netflix is already open | Return to Nest and invoke the same button again | Did the explicitly launched Shortcut run and lock Netflix without relying on the app-opened event? |
| A different approved title is selected | End the prior session, choose the other title in Nest, and invoke the button again | Was the new title's URL used, and did the new session lock correctly? |

Do not infer automatic locking from the button being tapped or from Netflix merely opening. Record the actual restriction and whether any confirmation was required. If the action fails while Shortcuts is in the background or locks the wrong app, record that result and return to manual Guided Access.

After each test, end Guided Access with the device's own passcode or configured authentication, stop playback, return to Nest manually, and save observations without including any PINs. Record the iPad model, iPadOS version, Netflix version, Shortcut actions and wait duration, starting state, and the outcome.

## Remaining limits

- The parent explicitly starts this Shortcut for every title. A tap on a normal Netflix link does not run it, and no automatic app-opened event is required.
- Netflix decides whether a link opens the intended episode and whether it starts or resumes playback.
- Touch off also disables Netflix's on-screen pause and skip-intro buttons. The parent can skip an intro before the lock if the preparation delay permits it; Nest has no supported automatic skip-intro control.
- Neither Nest nor this Shortcut reads Netflix's actual progress or ending. A duration-based wait would be inaccurate after pauses, buffering, ads, resumed playback, or intro skipping.
- This Shortcut starts Guided Access; it does not end it or jump back to Nest when the episode ends. The parent must end the session and return manually. The Nest parent PIN cannot unlock Guided Access.
- End-of-title autoplay and recommendations remain separate physical-device tests described in [the iPad test guide](IPAD-TEST.md).
