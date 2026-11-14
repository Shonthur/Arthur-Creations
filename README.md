# Arthur Creations

Portfolio website for Arthur Creations: web development, graphic design and video work.
Built with plain HTML, Tailwind CSS and a little JavaScript. Hosted on GitHub Pages.

## Pages

| Page | File |
| --- | --- |
| Splash screen (opens first) | `index.html` |
| Home | `pages/homepage.html` |
| Web portfolio | `pages/portfolio_gallery.html` |
| **Graphics portfolio** | `pages/graphics.html` |
| Services and pricing | `pages/services_pricing.html` |
| Video showcase | `pages/video_showcase_theater.html` |
| About | `pages/about_process.html` |
| Success stories | `pages/client_success_hub.html` |

## Adding graphics (PDF to gallery)

1. Export your design from Illustrator (or any app) as a **PDF**. Each page of the PDF becomes one image in the gallery.
2. Put the PDF in the `graphics-src/` folder.
   - On GitHub: open the folder, then **Add file > Upload files**, drop the PDF and commit.
3. Wait about a minute. A GitHub Action (`.github/workflows/build-graphics.yml`) turns every page into HD images and saves them in `assets/graphics/`.
4. Refresh `pages/graphics.html`. The new project is there.

Optional: add a settings file with the **same name** as the PDF to set the title, category and more.
See `graphics-src/README.md` for the details.

To build on your own computer instead:

```bash
# needs poppler (pdftoppm) and Pillow
python scripts/build_graphics.py
```

## Editing styles (Tailwind)

The main pages use compiled Tailwind CSS in `css/main.css`.

```bash
npm install
npm run build:css
```

The Graphics page has its own small stylesheet, `css/graphics.css`, and script, `js/graphics.js`. They do not need a build step.

## Project structure

```
.github/workflows/    build-graphics.yml  (turns PDFs into gallery images)
assets/graphics/      generated images and projects.json (do not edit by hand)
css/                  main.css (compiled Tailwind), tailwind.css, graphics.css
graphics-src/         put your PDFs here
js/                   graphics.js (gallery and viewer)
pages/                all site pages and media
scripts/              build_graphics.py
index.html            splash screen
```

Built by Arthur Creations.
