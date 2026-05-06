# Deploying `otaw_site` (GitHub Pages)

This site uses [Vite](https://vitejs.dev/) for the **Projects** page (`projects.html`), which bundles TypeScript (Three.js, Cayley tools, etc.). **Serving the raw repo root on Pages will look broken**: unbuilt `projects.html` points at `./src/projects/main.ts`, which browsers cannot run.

Production must serve the **`dist/`** folder after `npm run build`.

Site media (background and floating clips, `other_media/`, etc.) lives under **`public/`** so Vite copies it into **`dist/`** with the same URLs your HTML already uses.

## Automatic deploy (recommended)

The workflow [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) builds and publishes **`dist/`** on every push to **`main`**.

1. Merge your feature branch into `main`.
2. Repo **Settings → Pages → Build and deployment**: set **Source** to **GitHub Actions** (not “Deploy from a branch” pointing at repo root).
3. Push to `main`; check **Actions** for the run. The site will be at  
   `https://nye3333.github.io/otaw_site/`  
   (including `/otaw_site/projects.html`).

## Local preview (matches GitHub Pages)

From the repo root, with [Node.js](https://nodejs.org/) installed:

```bash
cd "/path/to/otaw_site"
npm install
npm run build
npm run preview -- --host 127.0.0.1 --port 4174
```

Then open:

- **Home:** [http://127.0.0.1:4174/otaw_site/](http://127.0.0.1:4174/otaw_site/)
- **Projects:** [http://127.0.0.1:4174/otaw_site/projects.html](http://127.0.0.1:4174/otaw_site/projects.html)

`vite.config.ts` sets `base: '/otaw_site/'`, so the preview URL **must** include the `/otaw_site/` prefix.

## Local development (hot reload)

```bash
npm run dev
```

Open `http://localhost:5173/otaw_site/projects.html`.

## Manual publish (without Actions)

Build locally, then upload only the contents of **`dist/`** to whatever host backs Pages (e.g. `gh-pages` branch whose root equals `dist/`). Do **not** publish the repository root as the site root unless you only need static HTML with no Vite bundle.
