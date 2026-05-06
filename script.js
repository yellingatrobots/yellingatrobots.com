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

    items.slice(0, 25).forEach((item) => {
      const li = document.createElement("li");
      const title = text(item, "title") || "Untitled episode";
      const link = text(item, "link");
      const pubDate = safeDate(text(item, "pubDate"));
      const description = stripHtml(text(item, "description")).slice(0, 260);

      li.innerHTML = `
        <a class="feed-title" href="${link}" target="_blank" rel="noopener noreferrer">${title}</a>
        <span class="feed-date">${pubDate}</span>
        <p class="feed-desc">${description}${description.length >= 260 ? "..." : ""}</p>
      `;

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
