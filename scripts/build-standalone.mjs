// Backward-compatible entry point. Fresh CSS is compiled without a Next.js build.
process.argv[2] = 'standalone';
await import('./build-game.mjs');
