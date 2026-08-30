import { renderWritingLine } from "/shared/render.js";

const gallery = document.getElementById("gallery");

async function loadGallery() {
  const response = await fetch("/api/words");
  const data = await response.json();
  if (!response.ok || !data.ok) return;

  const cards = [];
  for (const word of data.words) {
    const card = document.createElement("article");
    card.className = "gallery-card";
    card.append(renderWritingLine(word));
    const caption = document.createElement("p");
    caption.className = "gallery-explanation";
    caption.textContent = word.explanation;
    card.append(caption);
    cards.push(card);
  }
  gallery.replaceChildren(...cards);
}

loadGallery();
