# Deploying `otaw_site` (GitHub Pages)

This site uses [Vite](https://vitejs.dev/) for the **Projects** page only (`projects.html`), which bundles the Cayley tools directly (no iframes).

## One-time setup

```bash
cd "/path/to/otaw_site"
npm install
```

## Build

```bash
npm run build
```

Output goes to `dist/`. `vite.config.ts` sets `base: '/otaw_site/'` so asset URLs match  
`https://nye3333.github.io/otaw_site/`.

## Publish

Configure GitHub Pages to serve the contents of **`dist/`** on your `main` branch (or upload `dist/` to the Pages branch your repo uses).  
Do **not** serve the raw repo root without building — `projects.html` needs the hashed JS/CSS from `dist/`.

## Local preview (matches production paths)

```bash
npm run preview
```

Open the printed URL and navigate to `/otaw_site/projects.html` (Vite will respect `base`).

## Local development

```bash
npm run dev
```

Then open `http://localhost:5173/otaw_site/projects.html` (note the `/otaw_site` prefix).
