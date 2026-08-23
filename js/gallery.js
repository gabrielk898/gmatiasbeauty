// =========================================================
// Galeria de resultados (antes/depois) — home
// Para adicionar um novo par de fotos, é só adicionar um objeto
// nessa lista com o título e os caminhos das imagens.
// =========================================================

const GALLERY_ITEMS = [
  {
    title: "Limpeza de Pele",
    before: "img/resultados/limpeza-pele-1-antes.jpg",
    after: "img/resultados/limpeza-pele-1-depois.jpg",
  },
  {
    title: "Limpeza de Pele",
    before: "img/resultados/limpeza-pele-2-antes.jpg",
    after: "img/resultados/limpeza-pele-2-depois.jpg",
  },
  {
    title: "Laser Remoção de Micose",
    before: "img/resultados/laser-micose-antes.jpg",
    after: "img/resultados/laser-micose-depois.jpg",
  },
  {
    title: "Laser Faixa de Barba",
    before: "img/resultados/laser-barba-antes.jpg",
    after: "img/resultados/laser-barba-depois.jpg",
  },
  {
    title: "Laser Faixa de Barba",
    before: "img/resultados/laser-barba-2-antes.jpg",
    after: "img/resultados/laser-barba-2-depois.jpg",
  },
  {
    title: "Tratamento para Melasma",
    before: "img/resultados/melasma-antes.jpg",
    after: "img/resultados/melasma-depois.jpg",
  },
];

function renderGallery() {
  const grid = document.getElementById("gallery-grid");
  if (!grid) return;

  grid.innerHTML = GALLERY_ITEMS.map(
    (item) => `
    <div class="gallery-card">
      <div class="gallery-images">
        <figure>
          <img src="${item.before}" alt="${item.title} — antes" loading="lazy" class="zoomable" />
          <figcaption>Antes</figcaption>
        </figure>
        <figure>
          <img src="${item.after}" alt="${item.title} — depois" loading="lazy" class="zoomable" />
          <figcaption>Depois</figcaption>
        </figure>
      </div>
      <div class="gallery-card-title">${item.title}</div>
    </div>`
  ).join("");

  grid.querySelectorAll(".zoomable").forEach((img) => {
    img.addEventListener("click", () => openLightbox(img.src, img.alt));
  });
}

// ---------------------------------------------------------
// Lightbox — amplia a foto em tela cheia ao clicar
// ---------------------------------------------------------
function openLightbox(src, alt) {
  const overlay = document.createElement("div");
  overlay.className = "lightbox-overlay";
  overlay.innerHTML = `
    <button class="lightbox-close" aria-label="Fechar">✕</button>
    <img src="${src}" alt="${alt}" />
    <span class="lightbox-caption">${alt}</span>
  `;
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  function close() {
    overlay.remove();
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onKeyDown);
  }

  function onKeyDown(e) {
    if (e.key === "Escape") close();
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.classList.contains("lightbox-close")) close();
  });
  document.addEventListener("keydown", onKeyDown);
}

renderGallery();
