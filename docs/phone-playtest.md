# Android and iPhone playtest

The owner has both platforms; exact models, OS versions and physical results are still unrecorded. This guide prepares the test. It does not claim that either device has passed.

## Open the same candidate on both phones

On the Mac, from this project folder:

```sh
npm run build:web
npm run preview:mobile
```

The server prints one or more `Phone URL` addresses. Connect the phone and Mac to the same trusted Wi-Fi, then open the Mac's Wi-Fi address in Android Chrome or iPhone Safari. `localhost` on a phone points to the phone, so use the printed address. The Mac must remain awake. Stop the preview with Ctrl-C afterward. This shares only the exported game folder on the local network; it does not publish or upload anything.

If port 4173 is already serving another preview, use `npm run preview:mobile -- --port 4174`. A guest network may isolate devices; use a network that allows them to communicate rather than changing security settings. If macOS asks about incoming connections, the owner can decide whether to permit this local test.

Use the same address and browser throughout each save test. A changed IP, port, private-browsing session or different browser is a separate save origin. These website saves do not transfer to YouTube. Private browsing is unsuitable for durability testing.

## Ten-minute first pass per phone

1. Record model, OS and browser version below. Rotate portrait → landscape → portrait on the menu and during a paused hunt. No progress should reset, and every menu action should remain reachable by scrolling.
2. Pick a hunter, drag to move, release, change direction, lift/reapply your finger and try a second touch. Your hunter should stop when movement is released or cancelled. Menus should scroll without moving the hunter.
3. Choose a level-up, inspect Your build, then try fixed joystick on both sides and floating joystick. Check that the thumb does not cover an essential warning or control.
4. Pause and record time, health, kills and equipment. Change settings, switch apps briefly, return, reload the page and resume the saved hunt. The restored checkpoint may be older than the last unsaved action, but should be coherent and remain paused until resumed.
5. Mute the game, move the volume sliders, then unmute. Try music and effects separately. Record any clipped, stuck or unexpected sound.
6. End the hunt deliberately, inspect the result and gold, then reload. Banked gold should remain consistent. Only buy an affordable power-up; refund it and confirm the exact paid gold returns.

## Full-run and repeated-session pass

Complete the [release checklist's physical test card](release-checklist.md#physical-device-test-card), including full thirty-minute hunts, all bosses, dense evolved builds and three consecutive retries. Use a fresh profile first; later compare partial and full permanent upgrades. Record confusing choices, unavoidable-looking damage, first evolution time, boss duration and any heat, input delay or long stall. Do not treat an assisted QA scenario as a natural win.

Official YouTube cloud, app pause/resume, platform mute and certification tests remain separate and require the Developer Portal/Dev Link. Local Wi-Fi testing cannot establish those results.

## Result record — complete once per device/build

```text
Date:
Candidate version / ZIP SHA-256:
Device model:
OS version:
Browser + version:
Orientation and display/text scaling:
Hunter / permanent ranks / starting profile:
Touch and cancellation: PASS / FAIL / NOT TESTED
Menus, scrolling and rotation: PASS / FAIL / NOT TESTED
Pause, app switch and reload: PASS / FAIL / NOT TESTED
Gold, purchase and refund: PASS / FAIL / NOT TESTED
Audio and mute: PASS / FAIL / NOT TESTED
Full-run result, time, build and death cause:
Evolution time / boss durations:
Heat, battery change and noticeable stalls:
Issue reproduction steps and expected/actual behavior:
```
