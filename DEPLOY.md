# Deploy to GitHub Pages

The app is built for GitHub Pages with base path `/mobideal/` (repo name). The workflow `.github/workflows/deploy-pages.yml` builds and deploys on every push to `main`.

## First-time setup

1. In your repo: **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push to `main` (or re-run the workflow). The site will be at:
   **https://\<your-username\>.github.io/mobideal/**

## If your repo name is not `mobideal`

Edit `.github/workflows/deploy-pages.yml` and change:

- `VITE_BASE_PATH: /mobideal/` to your repo name, e.g. `VITE_BASE_PATH: /my-repo/`

## Building for GitHub Pages locally

```bash
VITE_BASE_PATH=/mobideal/ npm run build
```

Then copy `dist/index.html` to `dist/404.html` so client-side routes work when someone opens a direct link. The workflow does this automatically.
