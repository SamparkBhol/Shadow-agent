# Shadow Agent

A terminal that learns how you work and predicts your next command — entirely on your device.

> It learns your hands. Nothing leaves your machine.

Shadow Agent watches the commands you run in a sandboxed, in-browser terminal, learns the patterns in how you work — both the sequences you repeat (`git add` → `git commit` → `git push`) and the *kinds* of commands you reach for — and suggests your next move as you type. All of the learning and prediction happens locally in the browser. No server, no account, no data collection.

## How it works

Two models run side by side, both on your device:

- **A sequence model** (a variable-order Markov chain) predicts the next command from the commands you just ran. It runs synchronously on every keystroke, so the inline suggestion never lags behind your typing.
- **A semantic model** (a MiniLM sentence-embedding model running in a Web Worker, via WebGPU with a WASM fallback) recognises when your current situation resembles something you did before, even if the exact commands differ.

A ranking step blends the two, leaning on semantic similarity early on and trusting observed sequences more as it learns your habits. Everything it learns is stored locally in IndexedDB and restored when you come back.

The terminal itself is a sandboxed simulator — a virtual filesystem with stand-ins for `git`, `npm`, `docker`, `curl`, and the usual shell tools. It never touches your real machine, which is what makes it safe to open in any browser.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000. The embedding model and runtime are vendored under `public/`, so there is nothing else to download or configure. (If you ever need to refresh those assets, run `npm run fetch:model`.)

## Deploy

Push the repository to GitHub and import it on Vercel. It is a standard Next.js app and deploys with **zero configuration** — no environment variables, no build settings, no backend. Every push updates the live site automatically.

## Optional: multi-device sync

By default everything stays on the one device. If you want to carry your learned model between devices, set a single environment variable:

```
NEXT_PUBLIC_SYNC_URL=https://your-sync-endpoint
```

When it is set, the app encrypts your learned model state on the client (AES-GCM) before it is sent — your raw command history never leaves the browser. When it is unset, sync is completely off and the corresponding code never runs.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | Type-check with `tsc` |
| `npm run lint` | Lint |
| `npm test` | Unit tests |
| `npm run test:cov` | Unit tests with coverage |
| `npm run e2e` | End-to-end tests (Playwright) |
| `npm run fetch:model` | Re-vendor the embedding model and runtime |

## Privacy

- Inference runs entirely in your browser. There is no inference server.
- Your commands and learned model are stored locally (IndexedDB) and never uploaded by default.
- There is no telemetry.

## Tech

Next.js (App Router), TypeScript, Tailwind CSS, xterm.js, Hugging Face Transformers (transformers.js), and a small hand-written prediction engine.

## License

MIT — see [LICENSE](./LICENSE).
