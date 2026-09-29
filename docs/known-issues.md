# Candidate limitations and open verification

Version 0.4.0 is a local test candidate. See [the latest verification record](difficulty-update-0.4.0.md) and [release checklist](release-checklist.md) for observed results.

- Physical Android/iPhone input, interruption, performance, heat and battery tests have not been performed.
- Natural full-run balance for every hunter/save profile and dense combat readability have not been established. Headless assisted fixtures and deterministic bots do not establish those results.
- Current normal-health bots produced seven defeats and one alive-but-unfinished finale in eight seed-1 cases. Fresh Knight died at 00:32. The bots resolve choices instantly and are not skilled human players, but early hunter fairness and excessive difficulty are explicit concerns for the next playthrough. Previous win rates describe old versions.
- A huge-HP, normal-damage progression probe reached a complete build at 30:01.52, with only 48/78 equipment ranks at minute 17. This supports the revised pacing direction but does not establish 27–30-minute completion for every hunter, profile or build. Start a fresh hunt to test it; migration retains previously earned equipment ranks.
- A main boss still alive at the next main's minute delays that arrival; mini-bosses can overlap main fights. Stronger boss health can keep support elites/chests deferred for long periods. At dawn, a surviving mini is cleared without rewards by the existing finale handoff. Dawnless has only the minute-29 window. Human pacing and fairness are unverified.
- Selected 0.4.0 Chrome QA flows and an actual battlefield capture were reviewed. Full responsive layouts, dense combined warnings, all new enemy silhouettes and natural ritual difficulty still need human/device checks.
- Selected responsive screens, keyboard recovery focus, purchase/refund, checkpoint restoration and isolated storage-fault/conflict recovery passed local Chrome checks on earlier candidates. Full current-build touch/assistive-technology and listening coverage remains open; see the dated observed matrix in the release checklist.
- Dense hit-flash readability was improved after an actual canvas capture. Short development-browser and Node CPU diagnostics do not establish sustained release/mobile FPS, heap stability or thermal behavior.
- Actual YouTube cloud, lifecycle, audio and certification checks require portal access, which the owner does not yet have. Local SDK preview progress is temporary.
- One active profile writer is supported. Two devices playing concurrently are not merged; conflicts require reloading the latest progress.
- Closing immediately after new progress may lose changes after the last durable checkpoint. Large run snapshots cannot rely on YouTube's small best-effort exit-save window.
- Standalone file-URL persistence depends on the browser. HTTP-served standalone checks passed; direct file opening remains manual because browser automation blocks `file:` navigation. The served website is preferred for durable local progress.
- Canvas gameplay does not provide a complete nonvisual mode. Controller support, remapping and localization are future work.

Report reproducible problems with version, device/browser, hunter, permanent ranks, build, approximate run minute and observed behavior. Include a seed if using the isolated developer lab. Do not send personal browsing data or clear real saves to reproduce a problem.
