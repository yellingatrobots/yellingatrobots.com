function text(node, selector) {
  return node.querySelector(selector)?.textContent?.trim() || "";
}

function safeDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function stripHtml(input) {
  const div = document.createElement("div");
  div.innerHTML = input;
  return (div.textContent || "").trim();
}

function firstAttr(node, tagName, attrName) {
  return node.getElementsByTagName(tagName)[0]?.getAttribute(attrName) || "";
}

function firstText(node, tagName) {
  return node.getElementsByTagName(tagName)[0]?.textContent?.trim() || "";
}

function imageFromDescription(description) {
  const div = document.createElement("div");
  div.innerHTML = description;
  return div.querySelector("img")?.src || "";
}

function futzImageUrl(url) {
  return `/.netlify/functions/futz-image?url=${encodeURIComponent(url)}`;
}

function placeholderBitmap() {
  const size = 288;
  const block = 24;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = size;
  canvas.height = size;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#000055";
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += block) {
    for (let x = 0; x < size; x += block) {
      ctx.fillStyle = (x + y) / block % 2 === 0 ? "#ff00aa" : "#00ccff";
      ctx.fillRect(x, y, block, block);
    }
  }

  ctx.fillStyle = "#ffff00";
  ctx.font = "bold 34px monospace";
  ctx.fillText("NO IMG", 78, 154);
  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  for (let y = 0; y < size; y += 4) {
    ctx.fillRect(0, y, size, 1);
  }

  return canvas.toDataURL("image/png");
}

async function loadFeed() {
  const status = document.getElementById("status");
  const list = document.getElementById("feed-list");

  try {
    const response = await fetch("/.netlify/functions/feed");
    if (!response.ok) {
      throw new Error(`Feed request failed with status ${response.status}`);
    }

    const xml = await response.text();
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const parserError = doc.querySelector("parsererror");

    if (parserError) {
      throw new Error("The RSS response could not be parsed.");
    }

    const items = Array.from(doc.querySelectorAll("item"));
    if (!items.length) {
      status.textContent = "No episodes found in feed.";
      return;
    }

    const fragment = document.createDocumentFragment();
    const channel = doc.getElementsByTagName("channel")[0] || doc;
    const channelImage = firstAttr(channel, "itunes:image", "href") || firstText(channel, "url");

    items.slice(0, 25).forEach((item) => {
      const li = document.createElement("li");
      const title = text(item, "title") || "Untitled episode";
      const link = text(item, "link");
      const pubDate = safeDate(text(item, "pubDate"));
      const rawDescription = text(item, "description");
      const description = stripHtml(rawDescription).slice(0, 260);
      const imageUrl = firstAttr(item, "itunes:image", "href") || imageFromDescription(rawDescription) || channelImage;

      const episodeImage = document.createElement("img");
      episodeImage.className = "episode-image";
      episodeImage.alt = "";
      episodeImage.width = 288;
      episodeImage.height = 288;

      const episodeBody = document.createElement("div");
      episodeBody.className = "episode-body";

      const titleLink = document.createElement("a");
      titleLink.className = "feed-title";
      titleLink.href = link || "#";
      titleLink.target = "_blank";
      titleLink.rel = "noopener noreferrer";
      titleLink.textContent = title;

      const date = document.createElement("span");
      date.className = "feed-date";
      date.textContent = pubDate;

      const desc = document.createElement("p");
      desc.className = "feed-desc";
      desc.textContent = `${description}${description.length >= 260 ? "..." : ""}`;

      episodeBody.append(titleLink, date, desc);
      li.append(episodeImage, episodeBody);

      if (imageUrl) {
        episodeImage.onload = () => {
          episodeImage.classList.add("loaded");
        };
        episodeImage.onerror = () => {
          episodeImage.src = placeholderBitmap();
          episodeImage.classList.add("loaded");
        };
        episodeImage.src = futzImageUrl(imageUrl);
      } else {
        episodeImage.src = placeholderBitmap();
        episodeImage.classList.add("loaded");
      }

      fragment.appendChild(li);
    });

    list.appendChild(fragment);
    status.textContent = `Loaded ${Math.min(items.length, 25)} episodes from the feed.`;
  } catch (error) {
    status.textContent = "Could not load feed. Try reloading in a minute.";
    console.error(error);
  }
}

document.getElementById("year").textContent = new Date().getFullYear();
loadFeed();
