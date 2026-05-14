const IMAGE_EXTENSIONS = /\.(avif|gif|jpe?g|png|svg|webp)$/i;

const CATEGORY_FOLDERS = {
  "illustration": "artwork/illustration",
  "visual-development": "artwork/visual-development",
  "graphic-design": "artwork/graphic-design",
};

function initNavigation() {
  const toggle = document.querySelector("[data-nav-toggle]");
  const nav = document.querySelector("[data-site-nav]");

  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const isOpen = document.body.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.querySelector(".sr-only").textContent = isOpen ? "Close navigation" : "Open navigation";
  });

  nav.addEventListener("click", event => {
    if (event.target.closest("a")) {
      document.body.classList.remove("nav-open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

function setYear() {
  document.querySelectorAll("[data-current-year]").forEach(element => {
    element.textContent = new Date().getFullYear();
  });
}

function inferGitHubRepository() {
  const hostname = window.location.hostname;

  if (!hostname.endsWith("github.io")) {
    return null;
  }

  const owner = hostname.replace(".github.io", "");
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const firstPathPart = pathParts[0] || "";
  const isPageFile = firstPathPart.endsWith(".html");
  const isUserSiteRoot = !firstPathPart || isPageFile;
  const repo = isUserSiteRoot ? `${owner}.github.io` : firstPathPart;

  return { owner, repo };
}

async function fetchGitHubFolder(folder) {
  const repository = inferGitHubRepository();

  if (!repository) {
    throw new Error("This page is not running on GitHub Pages.");
  }

  const endpoint = `https://api.github.com/repos/${repository.owner}/${repository.repo}/contents/${folder}`;
  const response = await fetch(endpoint, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Could not read ${folder} from GitHub. Make sure the folder exists, your images are committed, and the repository is public.`);
  }

  const files = await response.json();

  return files.map(file => ({
    name: file.name,
    type: file.type,
    src: file.download_url,
  }));
}

async function fetchLocalFolder(folder) {
  const folderUrl = `${folder}/`;
  const response = await fetch(folderUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Could not open the local folder listing for ${folder}. Run the included local preview server, then open http://localhost:8000 instead of double-clicking the HTML file.`);
  }

  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const baseUrl = new URL(folderUrl, window.location.href);

  const files = Array.from(doc.querySelectorAll("a"))
    .map(link => link.getAttribute("href") || "")
    .filter(href => href && !href.startsWith("?") && href !== "../")
    .map(href => {
      const url = new URL(href, baseUrl);
      const name = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "");
      return { name, type: "file", src: url.href };
    })
    .filter(file => IMAGE_EXTENSIONS.test(file.name));

  return dedupeFiles(files);
}

function dedupeFiles(files) {
  const seen = new Set();
  return files.filter(file => {
    const key = file.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchArtworkFolder(folder) {
  if (window.location.protocol === "file:") {
    throw new Error("Local folder loading cannot work from a double-clicked file because browsers block folder access. Use the included start-local-preview file, then open http://localhost:8000.");
  }

  if (inferGitHubRepository()) {
    return fetchGitHubFolder(folder);
  }

  return fetchLocalFolder(folder);
}

async function fetchMetadata() {
  try {
    const response = await fetch("data/artwork-meta.json", { cache: "no-store" });
    if (!response.ok) return {};
    return response.json();
  } catch {
    return {};
  }
}

function getMetadataForImage(metadata, folder, filename) {
  const possibleKeys = [
    `${folder}/${filename}`,
    filename,
    filename.replace(IMAGE_EXTENSIONS, ""),
  ];

  for (const key of possibleKeys) {
    if (metadata[key]) return metadata[key];
  }

  return {};
}

function fileNameToTitle(filename) {
  const withoutExtension = filename.replace(IMAGE_EXTENSIONS, "");
  const withoutOrder = withoutExtension.replace(/^\d+[\s_.-]*/, "");
  const readable = withoutOrder.replace(/[_-]+/g, " ").trim();

  if (!readable) return withoutExtension;

  return readable.replace(/\w\S*/g, word => word.charAt(0).toUpperCase() + word.slice(1));
}

function sortByFileName(a, b) {
  return a.name.localeCompare(b.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function makeArtworkItem(file, folder, categoryTitle, metadata) {
  const itemMeta = getMetadataForImage(metadata, folder, file.name);

  return {
    filename: file.name,
    src: file.src,
    title: itemMeta.title || fileNameToTitle(file.name),
    description: itemMeta.description || "Add a description in data/artwork-meta.json when you want this artwork to have custom details.",
    year: itemMeta.year || "",
    medium: itemMeta.medium || "",
    category: itemMeta.category || categoryTitle,
  };
}

function renderGallery(artwork) {
  const grid = document.querySelector("[data-gallery-grid]");
  if (!grid) return;

  grid.innerHTML = artwork.map((item, index) => `
    <button class="gallery-item" type="button" data-artwork-index="${index}" aria-label="Open ${escapeHTML(item.title)}">
      <figure>
        <img src="${item.src}" alt="${escapeHTML(item.title)}" loading="lazy" />
        <figcaption>${escapeHTML(item.title)}</figcaption>
      </figure>
    </button>
  `).join("");

  grid.addEventListener("click", event => {
    const button = event.target.closest("[data-artwork-index]");
    if (!button) return;
    openLightbox(artwork[Number(button.dataset.artworkIndex)]);
  });
}

function setupLightbox() {
  const lightbox = document.querySelector("[data-lightbox]");
  const closeButton = document.querySelector("[data-lightbox-close]");

  if (!lightbox || !closeButton) return;

  closeButton.addEventListener("click", () => lightbox.close());

  lightbox.addEventListener("click", event => {
    const dialogBox = lightbox.querySelector(".lightbox-inner");
    if (!dialogBox) return;

    const clickedOutside = !dialogBox.contains(event.target) && !event.target.closest("[data-lightbox-close]");
    if (clickedOutside) lightbox.close();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && lightbox.open) {
      lightbox.close();
    }
  });
}

function openLightbox(item) {
  const lightbox = document.querySelector("[data-lightbox]");
  if (!lightbox) return;

  const image = lightbox.querySelector("[data-lightbox-image]");
  const category = lightbox.querySelector("[data-lightbox-category]");
  const title = lightbox.querySelector("[data-lightbox-title]");
  const description = lightbox.querySelector("[data-lightbox-description]");
  const meta = lightbox.querySelector("[data-lightbox-meta]");

  image.src = item.src;
  image.alt = item.title;
  category.textContent = item.category;
  title.textContent = item.title;
  description.textContent = item.description;

  const metaParts = [item.year, item.medium].filter(Boolean);
  meta.textContent = metaParts.length ? metaParts.join(" · ") : item.filename;

  lightbox.showModal();
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function localPreviewInstructions() {
  return `
    <strong>Local preview needs a small local server.</strong><br>
    Do not double-click the HTML file. Open the folder in a terminal and run <code>python -m http.server 8000</code>, then visit <code>http://localhost:8000</code>.<br>
    On Windows, you can also double-click <code>start-local-preview.bat</code>.
  `;
}

async function initGalleryPage() {
  const page = document.querySelector("[data-gallery-page]");
  if (!page) return;

  const category = page.dataset.galleryPage;
  const categoryTitle = page.dataset.galleryTitle;
  const folder = CATEGORY_FOLDERS[category];
  const status = document.querySelector("[data-gallery-status]");

  if (!folder) return;

  try {
    const [files, metadata] = await Promise.all([
      fetchArtworkFolder(folder),
      fetchMetadata(),
    ]);

    const artwork = files
      .filter(file => file.type === "file" && IMAGE_EXTENSIONS.test(file.name))
      .sort(sortByFileName)
      .map(file => makeArtworkItem(file, folder, categoryTitle, metadata));

    if (!artwork.length) {
      status.textContent = `No images found in ${folder}. Add image files to this folder, then refresh the page.`;
      return;
    }

    status.textContent = "";
    renderGallery(artwork);
  } catch (error) {
    const message = window.location.protocol === "file:" ? localPreviewInstructions() : escapeHTML(error.message);
    status.innerHTML = `<strong>Gallery not loaded yet.</strong><br>${message}`;
  }
}

initNavigation();
setYear();
setupLightbox();
initGalleryPage();
