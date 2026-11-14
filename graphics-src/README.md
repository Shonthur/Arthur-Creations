# graphics-src

Put your design PDFs in this folder. Each PDF becomes one project on the Graphics page,
and every page of the PDF becomes an HD image you can open and zoom.

## Quick start

1. Export your design as a PDF (for example `2027-wall-calendar.pdf`).
2. Upload it here.
3. Wait about a minute, then refresh the Graphics page.

The file name becomes the title (`2027-wall-calendar.pdf` shows as "2027 wall calendar")
unless you add a settings file.

## Optional settings file

Create a file with the **same name** as the PDF but ending in `.json`.
For `2027-wall-calendar.pdf` the file is `2027-wall-calendar.json`:

```json
{
  "title": "2027 Wall Calendar",
  "category": "Calendars",
  "year": 2027,
  "tools": ["Adobe Illustrator"],
  "description": "A twelve month wall calendar with a clean, modern layout."
}
```

| Setting | What it does |
| --- | --- |
| `title` | Name shown on the card and project page |
| `category` | Groups projects. Filter buttons appear when there are two or more categories |
| `year` | Shown under the title |
| `tools` | Shown as small tags |
| `description` | Short text on the project page |
| `order` | A number. Lower numbers show first. Without it, newest shows first |

Every setting is optional. Keep the quotes and commas exactly as shown.

## Tips for the best quality

- Use the real page size you designed in. The converter makes images 2600 pixels on the longest side.
- Visitors cannot download your PDF from the gallery. But anything in this folder can be opened by anyone who knows its web address. To keep a PDF private, use the upload page (`pages/upload.html`) instead. It makes the images in your browser and never stores the PDF.
- Use simple file names with letters, numbers and dashes.
- To remove a project, delete its PDF (and its `.json` file). Its images are removed automatically.
