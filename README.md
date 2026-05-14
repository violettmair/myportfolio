# Mary Khoury Art Portfolio Website — Version 4

This is a static art portfolio website designed for GitHub Pages.

It has separate pages for:

- `index.html` — About / home page
- `illustration.html` — Illustration gallery
- `visual-development.html` — Visual Development gallery
- `graphic-design.html` — Graphic Design gallery

The design is intentionally black and white so the artwork stays the focus.

## How to add artwork

Add image files to these folders:

```text
artwork/illustration/
artwork/visual-development/
artwork/graphic-design/
```

Use filenames to control the order:

```text
1_hidden-cave.jpg
2_elephant-room.jpg
3_arrival-poster.jpg
```

The gallery sorts filenames naturally, so `2_` comes before `10_`.

Supported image formats:

```text
.jpg, .jpeg, .png, .webp, .gif, .svg, .avif
```

## Local testing

Do not double-click `index.html`. Browsers block JavaScript from reading local folders when the site is opened as a file.

Instead, run a small local server from inside the website folder.

### Windows

Double-click:

```text
start-local-preview.bat
```

This uses Windows PowerShell, so Python is not required. It should open your browser automatically. If it does not, open:

```text
http://localhost:8000
```

### Mac / Linux

Open Terminal inside this folder and run:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

When you add, remove, or rename images in the artwork folders, refresh the browser page. You do not need to edit any JavaScript.


## If the preview window says Python was not found

Use the Version 4 `start-local-preview.bat` file. It does not use Python. It starts the included `local-preview-server.ps1` PowerShell server instead.

If Windows asks whether PowerShell can run the file, choose to allow it for this preview. The script only serves the website folder on your own computer at `http://localhost:8000`.

## Important: how the dynamic folder loading works

A normal static webpage cannot directly list files in a folder when it is opened by double-clicking the HTML file.

This version supports two dynamic loading modes:

1. **Local preview mode** — when served from `localhost`, the site reads the local folder listing from the included PowerShell preview server.
2. **GitHub Pages mode** — when served from a `github.io` URL, the site uses the public GitHub Contents API to read the artwork folders at page load.

That means:

- You do not need to edit any JavaScript when adding images.
- You do not need to run a build script.
- The repository needs to be public for GitHub Pages dynamic loading to work without authentication.
- The live site needs to be opened from a `github.io` GitHub Pages URL.

## How to deploy on GitHub Pages

1. Create a public GitHub repository.
2. Upload everything in this folder to the repository.
3. Delete the sample SVG images if you do not want them to appear.
4. Add your own image files to the artwork folders.
5. In GitHub, open **Settings → Pages**.
6. Under **Build and deployment**, choose **Deploy from a branch**.
7. Select your main branch and the root folder.
8. Save.

Your portfolio should appear at a URL like:

```text
https://yourusername.github.io/repository-name/
```

or, for a user site repository named `yourusername.github.io`:

```text
https://yourusername.github.io/
```

## Optional artwork descriptions

The site can show artwork titles and descriptions in the popup preview.

You do not have to edit this file, but if you want custom descriptions, edit:

```text
data/artwork-meta.json
```

Example:

```json
{
  "artwork/illustration/1_hidden-cave.jpg": {
    "title": "Hidden Cave",
    "description": "Alibaba entering the hidden cave after the bandits left.",
    "year": "2025",
    "medium": "Digital"
  }
}
```

If you do not add metadata, the site automatically turns the filename into a title. For example:

```text
1_hidden-cave.jpg → Hidden Cave
```
"# myportfolio" 
"# myportfolio" 
