const IMAGE_EXTENSIONS = /\.(avif|gif|jpe?g|png|svg|webp)$/i;
const CACHE_VERSION = "20260528-lightbox-square-instagram";
const PAGE_LOAD_VERSION = `${CACHE_VERSION}-${Date.now()}`;

function addCacheBuster(src, version = PAGE_LOAD_VERSION) {
  if (!src) return src;

  try {
    const url = new URL(src, window.location.href);
    url.searchParams.set("v", version);
    return url.href;
  } catch {
    const separator = src.includes("?") ? "&" : "?";
    return `${src}${separator}v=${encodeURIComponent(version)}`;
  }
}

const CATEGORY_FOLDERS = {
  "illustration": "artwork/illustration",
  "visual-development": "artwork/visual-development",
  "graphic-design": "artwork/graphic-design",
};

let galleryResizeHandler = null;
let lightboxArtwork = [];
let lightboxIndex = 0;
let swipeStartX = 0;
let swipeStartY = 0;
let swipeStartTime = 0;
let pageScrollYBeforeLightbox = 0;

function initNavigation() {
  const toggle = document.querySelector("[data-nav-toggle]");
  const nav = document.querySelector("[data-site-nav]");
  const menu = document.querySelector("[data-site-menu]") || nav;

  if (!toggle || !menu) return;

  toggle.addEventListener("click", () => {
    const isOpen = document.body.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.querySelector(".sr-only").textContent = isOpen ? "Close navigation" : "Open navigation";
  });

  menu.addEventListener("click", event => {
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

  const endpoint = `https://api.github.com/repos/${repository.owner}/${repository.repo}/contents/${folder}?cacheBust=${encodeURIComponent(PAGE_LOAD_VERSION)}`;
  const response = await fetch(endpoint, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Could not read ${folder} from GitHub. Make sure the folder exists, your images are committed, and the repository is public.`);
  }

  const files = await response.json();

  return files.map(file => ({
    name: file.name,
    type: file.type,
    src: addCacheBuster(file.download_url, file.sha || PAGE_LOAD_VERSION),
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
      return { name, type: "file", src: addCacheBuster(url.href) };
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
    const response = await fetch(addCacheBuster("data/artwork-meta.json", PAGE_LOAD_VERSION), { cache: "no-store" });
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

function getGalleryColumnCount() {
  if (window.matchMedia("(max-width: 520px)").matches) return 1;
  if (window.matchMedia("(max-width: 860px)").matches) return 2;
  return 3;
}

function renderArtworkCard(item, index) {
  return `
    <button class="gallery-item" type="button" data-artwork-index="${index}" aria-label="Open ${escapeHTML(item.title)}">
      <figure>
        <img src="${item.src}" alt="${escapeHTML(item.title)}" loading="lazy" />
        <figcaption>${escapeHTML(item.title)}</figcaption>
      </figure>
    </button>
  `;
}

function renderGallery(artwork) {
  const grid = document.querySelector("[data-gallery-grid]");
  if (!grid) return;

  lightboxArtwork = artwork;
  const indexedArtwork = artwork.map((item, index) => ({ ...item, originalIndex: index }));
  let renderedColumnCount = 0;

  function renderColumns(force = false) {
    const columnCount = getGalleryColumnCount();

    // Mobile browsers resize the viewport while the address bar hides/shows during scroll.
    // Only rebuild the gallery when the actual column count changes so the list does not
    // appear to refresh while someone is browsing.
    if (!force && renderedColumnCount === columnCount && grid.children.length) return;

    renderedColumnCount = columnCount;
    grid.style.setProperty("--gallery-columns", String(columnCount));
    grid.innerHTML = Array.from({ length: columnCount }, (_, columnIndex) => {
      const columnItems = indexedArtwork.filter((_, itemIndex) => itemIndex % columnCount === columnIndex);

      return `
        <div class="gallery-column">
          ${columnItems.map(item => renderArtworkCard(item, item.originalIndex)).join("")}
        </div>
      `;
    }).join("");
  }

  renderColumns(true);

  if (galleryResizeHandler) {
    window.removeEventListener("resize", galleryResizeHandler);
  }

  galleryResizeHandler = () => {
    window.clearTimeout(galleryResizeHandler.timeoutId);
    galleryResizeHandler.timeoutId = window.setTimeout(() => renderColumns(false), 160);
  };

  window.addEventListener("resize", galleryResizeHandler);

  grid.addEventListener("click", event => {
    const button = event.target.closest("[data-artwork-index]");
    if (!button) return;
    openLightbox(Number(button.dataset.artworkIndex));
  });
}

function setupLightbox() {
  const lightbox = document.querySelector("[data-lightbox]");
  const closeButton = document.querySelector("[data-lightbox-close]");

  if (!lightbox || !closeButton) return;

  addCarouselControls(lightbox);

  closeButton.addEventListener("click", () => closeLightbox());
  lightbox.addEventListener("close", unlockPageScrollForLightbox);

  lightbox.addEventListener("click", event => {
    const dialogBox = lightbox.querySelector(".lightbox-inner");
    if (!dialogBox) return;

    const clickedOutside = !dialogBox.contains(event.target) && !event.target.closest("[data-lightbox-control]") && !event.target.closest("[data-lightbox-close]");
    if (clickedOutside) closeLightbox();
  });

  lightbox.addEventListener("pointerdown", event => {
    if (!lightbox.open || event.target.closest("button")) return;
    swipeStartX = event.clientX;
    swipeStartY = event.clientY;
    swipeStartTime = Date.now();
  });

  lightbox.addEventListener("pointerup", event => {
    if (!lightbox.open || event.target.closest("button")) return;

    const deltaX = event.clientX - swipeStartX;
    const deltaY = event.clientY - swipeStartY;
    const elapsed = Date.now() - swipeStartTime;
    const isHorizontalSwipe = Math.abs(deltaX) > 55 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4;
    const isIntentional = elapsed < 900;

    if (!isHorizontalSwipe || !isIntentional) return;

    if (deltaX < 0) {
      showNextArtwork();
    } else {
      showPreviousArtwork();
    }
  });

  document.addEventListener("keydown", event => {
    if (!lightbox.open) return;

    if (event.key === "Escape") {
      closeLightbox();
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showPreviousArtwork();
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      showNextArtwork();
    }
  });
}

function addCarouselControls(lightbox) {
  if (lightbox.querySelector("[data-lightbox-prev]")) return;

  const previousButton = document.createElement("button");
  previousButton.type = "button";
  previousButton.className = "lightbox-control lightbox-control-prev";
  previousButton.dataset.lightboxControl = "";
  previousButton.dataset.lightboxPrev = "";
  previousButton.setAttribute("aria-label", "Previous artwork");
  previousButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 6 9 12l6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.className = "lightbox-control lightbox-control-next";
  nextButton.dataset.lightboxControl = "";
  nextButton.dataset.lightboxNext = "";
  nextButton.setAttribute("aria-label", "Next artwork");
  nextButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const hint = document.createElement("p");
  hint.className = "lightbox-carousel-hint";
  hint.dataset.lightboxHint = "";

  previousButton.addEventListener("click", showPreviousArtwork);
  nextButton.addEventListener("click", showNextArtwork);

  lightbox.append(previousButton, nextButton);

  const details = lightbox.querySelector(".lightbox-details");
  if (details) {
    details.append(hint);
  }
}


function lockPageScrollForLightbox() {
  if (document.body.classList.contains("lightbox-open")) return;

  pageScrollYBeforeLightbox = window.scrollY || document.documentElement.scrollTop || 0;
  document.documentElement.classList.add("lightbox-open-root");
  document.body.style.top = `-${pageScrollYBeforeLightbox}px`;
  document.body.classList.add("lightbox-open");
}

function unlockPageScrollForLightbox() {
  if (!document.body.classList.contains("lightbox-open")) return;

  document.body.classList.remove("lightbox-open");
  document.documentElement.classList.remove("lightbox-open-root");
  document.body.style.top = "";
  window.scrollTo({ top: pageScrollYBeforeLightbox, left: 0, behavior: "auto" });
}

function openLightbox(index) {
  const lightbox = document.querySelector("[data-lightbox]");
  if (!lightbox || !lightboxArtwork.length) return;

  lightboxIndex = normalizeIndex(index);
  updateLightboxContent();

  if (!lightbox.open) {
    // Open first, then lock the page. This keeps the dialog centered in the
    // current viewport instead of making mobile users jump back to the top.
    lightbox.showModal();
    lockPageScrollForLightbox();
  }
}

function closeLightbox() {
  const lightbox = document.querySelector("[data-lightbox]");
  if (lightbox?.open) {
    lightbox.close();
  }
}

function normalizeIndex(index) {
  return (index + lightboxArtwork.length) % lightboxArtwork.length;
}

function showPreviousArtwork() {
  if (lightboxArtwork.length <= 1) return;
  lightboxIndex = normalizeIndex(lightboxIndex - 1);
  updateLightboxContent("previous");
}

function showNextArtwork() {
  if (lightboxArtwork.length <= 1) return;
  lightboxIndex = normalizeIndex(lightboxIndex + 1);
  updateLightboxContent("next");
}

function updateLightboxContent(direction = "") {
  const lightbox = document.querySelector("[data-lightbox]");
  if (!lightbox) return;

  const item = lightboxArtwork[lightboxIndex];
  if (!item) return;

  const image = lightbox.querySelector("[data-lightbox-image]");
  const category = lightbox.querySelector("[data-lightbox-category]");
  const title = lightbox.querySelector("[data-lightbox-title]");
  const description = lightbox.querySelector("[data-lightbox-description]");
  const meta = lightbox.querySelector("[data-lightbox-meta]");
  const hint = lightbox.querySelector("[data-lightbox-hint]");
  const previousButton = lightbox.querySelector("[data-lightbox-prev]");
  const nextButton = lightbox.querySelector("[data-lightbox-next]");

  image.classList.remove("is-moving-next", "is-moving-previous");
  if (direction) {
    window.requestAnimationFrame(() => image.classList.add(`is-moving-${direction}`));
  }

  image.src = item.src;
  image.alt = item.title;
  category.textContent = item.category;
  title.textContent = item.title;
  description.textContent = item.description;

  const metaParts = [item.year, item.medium].filter(Boolean);
  meta.textContent = metaParts.length ? metaParts.join(" · ") : item.filename;

  if (hint) {
    hint.textContent = "";
    hint.hidden = true;
  }

  if (previousButton && nextButton) {
    const hideControls = lightboxArtwork.length <= 1;
    previousButton.hidden = hideControls;
    nextButton.hidden = hideControls;
  }
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
