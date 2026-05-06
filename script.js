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

function imageSources(url) {
  const encodedUrl = encodeURIComponent(url);
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const imageCdnUrl = `/.netlify/images?url=${encodedUrl}&w=160&h=160&fit=cover&fm=jpg&q=72`;
  const functionUrl = `/.netlify/functions/image-proxy?url=${encodedUrl}`;
  return isLocal ? [functionUrl, imageCdnUrl, url] : [imageCdnUrl, functionUrl, url];
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load."));
    img.src = url;
  });
}

function posterize(value) {
  return Math.round(value / 85) * 85;
}

async function degradeImage(url, imgEl) {
  let img;
  for (const source of imageSources(url)) {
    try {
      img = await loadImage(source);
      break;
    } catch (error) {
      img = null;
    }
  }

  if (!img) {
    throw new Error("No image source could be loaded.");
  }

  const size = 288;
  const tinySize = 96;
  const tiny = document.createElement("canvas");
  const canvas = document.createElement("canvas");
  const tinyCtx = tiny.getContext("2d");
  const ctx = canvas.getContext("2d");

  tiny.width = tinySize;
  tiny.height = tinySize;
  canvas.width = size;
  canvas.height = size;
  tinyCtx.imageSmoothingEnabled = false;
  ctx.imageSmoothingEnabled = false;

  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;
  tinyCtx.drawImage(img, sx, sy, side, side, 0, 0, tinySize, tinySize);

  const imageData = tinyCtx.getImageData(0, 0, tinySize, tinySize);
  for (let i = 0; i < imageData.data.length; i += 4) {
    imageData.data[i] = posterize(imageData.data[i]);
    imageData.data[i + 1] = posterize(imageData.data[i + 1]);
    imageData.data[i + 2] = posterize(imageData.data[i + 2]);
  }
  tinyCtx.putImageData(imageData, 0, 0);

  ctx.drawImage(tiny, 0, 0, size, size);
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  for (let y = 0; y < size; y += 4) {
    ctx.fillRect(0, y, size, 1);
  }

  imgEl.src = canvas.toDataURL("image/png");
  imgEl.classList.add("loaded");
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
        degradeImage(imageUrl, episodeImage).catch(() => {
          episodeImage.src = imageUrl;
          episodeImage.classList.add("loaded");
        });
      } else {
        episodeImage.remove();
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
