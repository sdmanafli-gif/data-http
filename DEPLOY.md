# Deploy to GitHub Pages

The app is built for GitHub Pages with base path `/mobideal/` (repo name). The workflow `.github/workflows/deploy-pages.yml` builds and deploys on every push to `main`.

## Multi-factor login (MFA / TOTP)

The app requires a one-time code from an authenticator app after password login (`MFA_REQUIRED` in `src/config/auth.js`).

1. Open **Supabase Dashboard** → **Authentication** → **Multi-Factor**.
2. Enable **TOTP** (authenticator apps).
3. Save. Users will be asked to scan a QR code on next login, then enter a 6-digit code on every sign-in.

Staff settings: in-app **Təhlükəsizlik** (`/hesab/tehlukesizlik`).

## First-time setup (required once)

If the workflow fails with **"Failed to create deployment (status: 404)"** or **"Ensure GitHub Pages has been enabled"**, enable Pages:

1. Open **https://github.com/bestells/mobideal/settings/pages**
2. Under **Build and deployment**, set **Source** to **GitHub Actions** (not "Deploy from a branch").
3. Save. Then push to `main` again or re-run the workflow in the **Actions** tab.

The site will be at:
   **https://\<your-username\>.github.io/mobideal/**

## If your repo name is not `mobideal`

Edit `.github/workflows/deploy-pages.yml` and change:

- `VITE_BASE_PATH: /mobideal/` to your repo name, e.g. `VITE_BASE_PATH: /my-repo/`

## Building for GitHub Pages locally

```bash
VITE_BASE_PATH=/mobideal/ npm run build
```

Then copy `dist/index.html` to `dist/404.html` so client-side routes work when someone opens a direct link. The workflow does this automatically.
