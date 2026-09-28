# Clean-install reproduction

Verified 2026-09-28 on Node **v24.19.0** and npm **12.1.0**.

A temporary directory received only app/source, scripts, public files, tests, package lock and configuration. No node_modules, .next, out, dist or prebuilt game.html was copied. All lockfile package URLs use registry.npmjs.org. Final source was refreshed after the last edits; the lockfile stayed unchanged, and generated outputs were removed before the final builds.

| Check | Result | Elapsed |
| --- | --- | ---: |
| `npm ci --no-audit --no-fund` | Pass | 230.96s |
| `npm run build:standalone` | Pass | 1.16s |
| `npm run build:playables` | Pass | 0.96s |
| Playables rebuild with `TZ=America/Los_Angeles` | Pass; identical ZIP | 0.94s |

The install ran during host CPU contention; these timings are verification records, not performance benchmarks. npm12 reported blocked install scripts for esbuild, fsevents and unrs-resolver; both bundles built successfully with the installed registry packages.

The final clean and primary-workspace ZIPs are **byte-identical**: **128,794 bytes**.

```text
SHA256 751a086403dfa8897a29245331c52997deb381934bc6b8e7ea59831708821ccd
```

The final evolution-card copy correction was included in the refreshed source and both timezone builds. Standalone `game.html` also matches exactly (404,916 bytes). Final app/scripts source hashes were checked against the primary workspace.

Two reproducibility issues found during the check were fixed before the final comparison: Tailwind now scans the explicit app source directory, and ZIP timestamps use a fixed local calendar date so DOS timestamp bytes remain identical across timezones.

Temporary artifacts remain at `/tmp/nightfall-clean-vuodf67p`. Detailed local execution record: `/tmp/nightfall-clean-build.md`. This verifies local build reproduction; it does not establish physical-device performance or YouTube certification.
