# Candidate limitations and open verification

Version 0.2.1 is a local test candidate. See [the latest verification record](verification-2026-09-29.md) and [release checklist](release-checklist.md) for observed results.

- Physical Android/iPhone input, interruption, performance, heat and battery tests have not been performed.
- Natural full-run balance for every hunter/save profile and dense combat readability have not been established. Headless assisted fixtures and deterministic bots do not establish those results.
- The 24-case bot matrix won 22 cases but lost fresh/partial Reaper seed 2 in the first minute. Winning runs reached levels 183–213. Human early Reaper control and late surplus-draft interruption frequency need review before tuning; the bot resolves choices instantly.
- Selected responsive screens, keyboard recovery focus, purchase/refund, checkpoint restoration and isolated storage-fault/conflict recovery passed local Chrome checks. Full touch/assistive-technology and listening coverage remains open; see the exact observed matrix in the verification record.
- Dense hit-flash readability was improved after an actual canvas capture. Short development-browser and Node CPU diagnostics do not establish sustained release/mobile FPS, heap stability or thermal behavior.
- Actual YouTube cloud, lifecycle, audio and certification checks require portal access, which the owner does not yet have. Local SDK preview progress is temporary.
- One active profile writer is supported. Two devices playing concurrently are not merged; conflicts require reloading the latest progress.
- Closing immediately after new progress may lose changes after the last durable checkpoint. Large run snapshots cannot rely on YouTube's small best-effort exit-save window.
- Standalone file-URL persistence depends on the browser. HTTP-served standalone checks passed; direct file opening remains manual because browser automation blocks `file:` navigation. The served website is preferred for durable local progress.
- Canvas gameplay does not provide a complete nonvisual mode. Controller support, remapping and localization are future work.

Report reproducible problems with version, device/browser, hunter, permanent ranks, build, approximate run minute and observed behavior. Include a seed if using the isolated developer lab. Do not send personal browsing data or clear real saves to reproduce a problem.
