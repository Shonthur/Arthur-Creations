# Arthur Creations

Portfolio website for Arthur Creations: web development, graphic design and video work.
Built with plain HTML, CSS and a little JavaScript. Hosted on GitHub Pages.

## Pages

| Page | File |
| --- | --- |
| Splash screen (opens first) | `index.html` |
| Home | `pages/homepage.html` |
| Web projects | `pages/portfolio_gallery.html` |
| **Graphics portfolio** | `pages/graphics.html` |
| Owner upload page (private) | `pages/upload.html` |
| Services and pricing | `pages/services_pricing.html` |
| Video showcase | `pages/video_showcase_theater.html` |
| About | `pages/about_process.html` |
| Case studies | `pages/client_success_hub.html` |

## Adding graphics (PDF to gallery)

1. Export your design from Illustrator (or any app) as a **PDF**. Each page of the PDF becomes one image in the gallery.
2. Upload the PDF. Pick one way:
   - **Upload page (easiest):** open `pages/upload.html` on the live site (or press **Owner upload** in the footer of the Graphics page). Paste your GitHub token once, choose the PDF, fill in the title and category, and press **Upload**. Your browser makes the HD images itself, so only a few MB are sent, even for a 30 MB PDF. See "Upload page token" below.
   - **On GitHub:** open the `graphics-src/` folder, then **Add file > Upload files**, drop the PDF and commit.
3. Wait about a minute. With the upload page, the site updates by itself. With a PDF placed in `graphics-src/`, a GitHub Action (`.github/workflows/build-graphics.yml`) turns every page into HD images and saves them in `assets/graphics/`.
4. Refresh `pages/graphics.html`. The new project is there.

Optional: add a settings file with the **same name** as the PDF to set the title, category and more.
See `graphics-src/README.md` for the details.

To build on your own computer instead:

```bash
# needs poppler (pdftoppm) and Pillow
python scripts/build_graphics.py
```

### Upload page token

The upload page needs a GitHub **fine-grained token**. Only you should have it.

1. Go to https://github.com/settings/personal-access-tokens/new
2. Repository access: **Only select repositories**, then `Arthur-Creations`.
3. Repository permissions: **Contents = Read and write**. Nothing else is needed.
4. Generate, copy, and paste it into the upload page.

How the upload page works: pdf.js (kept in `js/vendor/pdfjs`, no outside server) draws each PDF page in your browser, and the images are saved to `assets/graphics/<name>/` in one commit together with `assets/graphics/projects.json`. Projects made this way have `"source": "browser"` in `projects.json`, and `scripts/build_graphics.py` never deletes them.

Visitors cannot upload anything. Without the token the page does nothing. If a token is ever exposed, delete it on that same GitHub settings page.

## Editing styles (Tailwind)

All pages share `css/site.css` (header, footer, sections) and `js/site.js` (menu, price calculator). The old compiled Tailwind file `css/main.css` is still loaded by the Graphics and Upload pages.

```bash
npm install
npm run build:css
```

The Graphics page has its own small stylesheet, `css/graphics.css`, and script, `js/graphics.js`. They do not need a build step.

## Project structure

```
.github/workflows/    build-graphics.yml  (turns PDFs into gallery images)
assets/graphics/      generated images and projects.json (do not edit by hand)
css/                  main.css (compiled Tailwind), tailwind.css, graphics.css, upload.css
graphics-src/         put your PDFs here
js/                   graphics.js (gallery and viewer), upload.js (upload page)
js/vendor/pdfjs/      pdf.js (Mozilla, Apache 2.0): reads PDFs in the browser
pages/                all site pages and media
scripts/              build_graphics.py
index.html            splash screen
```

Built by Arthur Creations.
