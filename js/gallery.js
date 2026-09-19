// =========================================================
// Galeria de resultados (antes/depois) — home
// Cada item usa UMA imagem só, já com antes (metade esquerda) e
// depois (metade direita) lado a lado. Pra adicionar um novo par,
// é só incluir um objeto novo na lista abaixo.
// =========================================================

const GALLERY_ITEMS = [
  {
    title: "Limpeza de Pele",
    image: "img/resultados/limpeza-pele.jpg",
  },
  {
    title: "Tratamento para Melasma",
    image: "img/resultados/melasma.jpg",
  },
  {
    title: "Laser Faixa de Barba",
    image: "img/resultados/laser-barba.jpg",
  },
  {
    title: "Laser Faixa de Barba",
    image: "img/resultados/laser-barba-2.jpg",
  },
];

function renderGallery() {
  const grid = document.getElementById("gallery-grid");
  if (!grid) return;

  grid.innerHTML = GALLERY_ITEMS.map(
    (item) => `
    <div class="gallery-card">
      <figure class="gallery-compare">
        <img src="${item.image}" alt="${item.title} — antes e depois" loading="lazy" class="zoomable" />
        <span class="compare-label left">Antes</span>
        <span class="compare-label right">Depois</span>
      </figure>
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
