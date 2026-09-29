# Independent bundle reproduction — September 29, 2026

**Result: standalone HTML, Playables ZIP and package manifest are byte-identical to the final main-tree 0.2.1 build.** A second Playables build in another time zone also produces the same bytes. Archive validation passes.

## Method

- Created a new local Git clone at `/tmp/nightfall-repro-sept29-lbjx7vou/checkout`, based on commit `2f8a3397ab8fc45e040d5a67b70b45c652a9030e`, then overlaid the frozen candidate's tracked/untracked working-tree source. This includes the uncommitted 0.2.1 changes; it is not a claim that the base commit alone produces these artifacts.
- Started without `node_modules`, `out`, `.next` or `dist`; removed the tracked generated `game.html` before building. No main-tree generated output was used as a build input.
- Ran a **fresh `npm ci --no-audit --no-fund`**, installing 360 packages. No prior checkout's installed dependencies were reused. npm's normal package download cache was allowed; dependency versions and integrity stayed governed by the unchanged lockfile.
- Environment: macOS `darwin arm64`, Node `v24.19.0`, npm `12.1.0`. npm reported unapproved install hooks for esbuild, fsevents and unrs-resolver; no approval/configuration change was made, and both builds succeeded under that existing policy.
- Checked hashes of 23 application/build/config/lock inputs against the main tree after its final build: **zero differences**. Lockfile SHA-256: `1a82aae7e57e469097fb96d6c5df2678ec65d7c75fb353c2babb16413e4c2573`.

Commands in the temporary checkout:

```sh
npm ci --no-audit --no-fund
TZ=UTC npm run build:standalone
TZ=UTC npm run build:playables
TZ=America/Los_Angeles npm run build:playables
npm run validate:playables
```

Compared full file bytes, as well as sizes/SHA-256, between the clean UTC build and main. Then compared the alternate-time-zone ZIP and manifest to both earlier copies. Main-tree source, artifacts and user-owned development servers were not modified by this audit.

## Results

| Artifact | Bytes | SHA-256 | Comparison |
| --- | ---: | --- | --- |
| `game.html` | 409,725 | `2977552319c48664b3e994a69f5569f889fb09800c1aa1cdcd859bb7de236f39` | Clean UTC build equals main. |
| `dist/nightfall-survivors-playables.zip` | 130,201 | `9e944a8e30d39b12ecaf9087db2b72666afaeac212cea4668e9f8e70b14ab8c6` | Clean UTC and America/Los_Angeles builds equal main. |
| `dist/playables-manifest.json` | 1,031 | `5e108271f14d2e137c6b6841fb1ddcb99270e7de66f24172bb0cf0fedaea094e` | Clean UTC and America/Los_Angeles builds equal main. |

The independent archive validator reports **5 files, 412,928 bytes uncompressed, SDK first, relative assets valid**.

Temporary evidence is retained beside the checkout: `input-hashes.json`, `main-comparison.json`, `utc-results.json` and `final-results.json`. The input-hash manifest SHA-256 is `c26f4230731ea4639cd8dc8f87ba065cb4fa707470dfbcaa4c723a2d90cdace5`.

## Limits

This confirms the two dedicated bundles reproduce from the same frozen source and lockfile on this OS/architecture/toolchain, including the tested ZIP time-zone variation. It does not establish cross-OS/toolchain reproducibility, repeat the Next.js website build or aggregate tests, test physical devices, verify browser gameplay, or confer YouTube certification. Those results belong to the separate candidate verification records.
