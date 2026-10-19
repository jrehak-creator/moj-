# iPad playback experiment

This is a parent-assisted feasibility test, not a validated child-safe streaming player. The Safari pilot helps prepare one title and record what happens. Netflix handles playback; the link may open its app or a Safari page, which the parent must check. A parent starts and ends Guided Access manually.

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

A normal Safari page cannot enable or end Guided Access, lock another app's touch controls, inspect Netflix playback progress, supply controls above its protected video, detect the exact end of a movie, or force a return from Netflix. A foreground web reminder is only a reminder while the page remains active. It is not a playback timer or a reliable background alarm; pauses, ads, buffering, and iPad suspension invalidate timing assumptions.

Official Netflix downloads are an optional second experiment: download the approved title **inside Netflix**, confirm it plays offline, disconnect the iPad from the network, then repeat these checks. Downloads stay in the provider app; this pilot does not extract, copy, or rehost them. Offline use alone does not establish that only one title is accessible.

## Record the result

For each check, choose **observed pass**, **observed failure**, or **not tested**, and add a short note. Include iPad model, iPadOS version, Netflix version, profile, title/episode, autoplay settings, network state, and date. Do not store passwords or passcodes in notes.

No Netflix/iPad behavior is validated merely because the website builds or its automated tests pass. Until this physical-device experiment is completed, touch restriction, end-of-title behavior, provider handoff, and manual return remain **not tested**. Even a successful session does not establish an unattended or automatic solution across providers.
