# Candidate limitations and open verification

Version 0.2.0 is a local test candidate. See [the dated verification record](verification-2026-09-28.md) and [release checklist](release-checklist.md) for observed results.

- Physical Android/iPhone input, interruption, performance, heat and battery tests have not been performed.
- Natural full-run balance for every hunter/save profile and dense combat readability have not been established. Headless assisted fixtures and deterministic bots do not establish those results.
- Selected responsive screens, purchase/refund and website checkpoint restoration passed local Chrome checks. Full keyboard/touch/failure/recovery and listening coverage remains open; see the exact observed matrix in the verification record.
- Actual YouTube cloud, lifecycle, audio and certification checks require portal access, which the owner does not yet have. Local SDK preview progress is temporary.
- One active profile writer is supported. Two devices playing concurrently are not merged; conflicts require reloading the latest progress.
- Closing immediately after new progress may lose changes after the last durable checkpoint. Large run snapshots cannot rely on YouTube's small best-effort exit-save window.
- Standalone file-URL persistence depends on the browser. HTTP-served standalone checks passed; direct file opening remains manual because browser automation blocks `file:` navigation. The served website is preferred for durable local progress.
- Canvas gameplay does not provide a complete nonvisual mode. Controller support, remapping and localization are future work.

Report reproducible problems with version, device/browser, hunter, permanent ranks, build, approximate run minute and observed behavior. Include a seed if using the isolated developer lab. Do not send personal browsing data or clear real saves to reproduce a problem.
