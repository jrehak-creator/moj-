# iPad playback experiment

The user also reported that opening a Netflix title from Nest and then running their locking Shortcut afterward successfully activated the restriction. Keep this two-step method available. Automatic per-title Shortcut invocation, readiness timing, and automatic episode completion remain separate, unverified behaviors.

This is a parent-assisted feasibility test, not a validated child-safe streaming player. The Safari pilot helps prepare one title and record what happens. Netflix handles playback; the link may open its app or a Safari page, which the parent must check. The baseline uses manual Guided Access activation and exit. A separate [named Shortcut experiment](IPAD-SHORTCUT.md) tests starting the lock through an explicit parent action in Nest.

The question is: **with touch disabled, can this particular iPad play the selected title without navigating to, or automatically starting, other content?** Record failures as well as successes. A pass applies only to the tested device, app version, profile, and title.

## Prepare

- Use an iPad with Netflix installed, a working subscription, and a title available in your region. Keep the iPadOS version and Netflix app version in your notes.
- Open the pilot in Safari using a URL reachable from the iPad. A computer's `localhost` address will not work on the iPad. See [running the app](../README.md).
- Keep the device passcode and Guided Access passcode private. The library's parent PIN is a separate control; it does not lock the device.
- In Netflix profile settings, disable **autoplay next episode** and **autoplay previews**, where available. Verify the settings for the actual profile used. These settings may need to be changed on Netflix's website. Touch lock does not disable autoplay.
- Select one approved short title or exact episode. A series title link may open a detail page rather than the intended episode, so the parent must confirm the episode in Netflix. Record the title and episode in the pilot.
- In iPad **Settings → Accessibility → Guided Access**, turn Guided Access on and configure its passcode settings. Check the current on-device instructions if labels differ on your iPadOS version.

## Run the first session

1. Keep the iPad with the parent. Use the pilot's handoff, or open Netflix manually. Confirm the intended profile, title, and episode; start playback.
2. Triple-click the **top button** on an iPad without a Home button, or the **Home button** on a model with one. Select Guided Access if an accessibility menu appears.
3. Open **Options**, turn **Touch off**, and start Guided Access. This disables all touch, including Netflix's on-screen pause and seek controls. The Safari pilot cannot draw a play/pause overlay over Netflix.
4. Observe playback yourself first. Tap the video and controls, swipe from the edges, and try the Home/app-switch gestures and physical buttons. Confirm that the child cannot browse within Netflix or leave it using the tested actions. Record each result; do not assume all routes are blocked.
5. Stay nearby for the supervised child trial. If anything unexpected appears, end the session yourself. Do not rely on the pilot to detect or stop it.
6. Let the selected short test video reach its end while still in Netflix. Observe credits, end screens, recommendations, and any countdown. **Does another title start without a tap?** Record even a brief unexpected start as a failure for the strict selected-title requirement.
7. Use the Guided Access exit shortcut and authenticate. Follow the device's prompt; biometric shortcuts can differ by configuration. End Guided Access, then return to Safari manually and record the outcome.

Guided Access may have a **Time Limit** option. Test a short limit in a separate supervised session and record what the iPad actually does. A session limit or device lock is not evidence that playback stopped, that Netflix closed, or that Safari reopened.

## Optional: start the lock through a Shortcut

Follow [the iPad Shortcut guide](IPAD-SHORTCUT.md) to create a regular **Nest Playback** Shortcut and invoke it explicitly from Nest for each title. This tests a different path from a Netflix **App Is Opened** personal automation. The user reported that the app-opened trigger did not work when Netflix was already open or launched through Nest in Safari.

Keep the parent present and test Netflix closed, Netflix already open, and a second selected title separately. A delay before **Start Guided Access** is preparation time, not confirmation that the correct episode is playing. The parent still ends Guided Access and returns to Nest manually. Do not assume that this experiment supports automatic intro skipping or end-of-episode return.

## Test interruptions separately

Repeat on the same title/profile and record results for each case:

| Case | What to observe |
| --- | --- |
| Pause and resume | The parent ends Guided Access, pauses/resumes, then re-enables it. Touch-off offers no child-operated pause button. |
| Buffering or lost network | Whether an error screen, retry action, different content, or unexpected continuation appears. |
| End of episode | Autoplay setting honored; no next episode starts; what remains visible during credits and afterward. |
| Guided Access time limit | Visible alert/lock and actual audio/video behavior. Parent still ends the session manually. |
| Manual return | Parent can unlock, stop playback, return to Safari, and save the observation. |

Do not interrupt a child's session just to provoke errors; conduct these checks with the parent holding the device.

## What the web pilot can and cannot do

It can store the approved-title plan, hand off a link, show a preparation checklist, and save parent-entered observations. Opening a provider link may open Safari or the installed app; check the actual behavior on the iPad. The parent remains responsible for selecting and starting the exact episode.

A normal Safari page cannot directly enable or end Guided Access, lock another app's touch controls, inspect Netflix playback progress, supply controls above its protected video, detect the exact end of a movie, or force a return from Netflix. The experimental handoff can ask iPadOS to run a separately installed Shortcut; the device runs its actions, and the website cannot verify the outcome. A foreground web reminder is only a reminder while the page remains active. It is not a playback timer or a reliable background alarm; pauses, ads, buffering, and iPad suspension invalidate timing assumptions.

Official Netflix downloads are an optional second experiment: download the approved title **inside Netflix**, confirm it plays offline, disconnect the iPad from the network, then repeat these checks. Downloads stay in the provider app; this pilot does not extract, copy, or rehost them. Offline use alone does not establish that only one title is accessible.

## Record the result

For each check, choose **observed pass**, **observed failure**, or **not tested**, and add a short note. Include iPad model, iPadOS version, Netflix version, profile, title/episode, autoplay settings, network state, and date. Do not store passwords or passcodes in notes.

No Netflix/iPad behavior is validated merely because the website builds or its automated tests pass. In the conversation, the user reported that the selected video played **in the Netflix app** and that manual Guided Access worked. The iPad model, iPadOS version, Netflix version, precise restrictions tested, and end-of-title result were not recorded. Treat this as a user-reported partial result, not completion of the checklist above.

The explicit named-Shortcut handoff, automatic lock activation from that handoff, all navigation escape checks, autoplay/end-of-title behavior, and automatic return remain **not verified** on the physical iPad. Even a successful session does not establish an unattended or automatic solution across providers.
