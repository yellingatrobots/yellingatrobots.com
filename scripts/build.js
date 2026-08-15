const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { XMLParser } = require("fast-xml-parser");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const FEED_URL = "https://api.riverside.com/hosting/KCX6qbiI.rss";
const SITE_URL = "https://yellingatrobots.com";
const SHOW_NAME = "Yelling At Robots";
const SHOW_DESCRIPTION =
  "An entertaining, experienced take on AI, software engineering, and technology news—explained plainly so you know what matters, what does not, and how much to care.";
const SHOW_IMAGE = "https://yellingatrobots.com/favicon.svg";

function asArray(value) {
  return value == null ? [] : Array.isArray(value) ? value : [value];
}

function text(value) {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (value && typeof value === "object") return String(value["#text"] || "").trim();
  return "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function decodeEntities(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] || match);
}

function htmlToText(value) {
  return decodeEntities(String(value))
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(?:p|li|div|h[1-6]|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function notesHtml(value) {
  const lines = htmlToText(value).split("\n").filter(Boolean);
  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("\n");
}

function slugify(value) {
  const slug = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "episode";
}

function uniqueSlug(title, guid, used) {
  const base = slugify(title);
  let slug = base;
  if (used.has(slug)) {
    const suffix = createHash("sha1").update(guid || title).digest("hex").slice(0, 8);
    slug = `${base}-${suffix}`;
  }
  used.add(slug);
  return slug;
}

function imageFromDescription(description) {
  return description.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] || "";
}

function imageUrl(value) {
  return value && typeof value === "object" ? String(value["@_href"] || "") : "";
}

function proxyImageUrl(url) {
  return `/.netlify/functions/futz-image?url=${encodeURIComponent(url)}`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { iso: "", label: "" };
  return {
    iso: date.toISOString(),
    label: date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
  };
}

function episodeFromItem(item, channelImage, usedSlugs) {
  const title = text(item.title) || "Untitled episode";
  const description = text(item.description);
  const guid = text(item.guid);
  const image = imageUrl(item["itunes:image"]) || imageFromDescription(description) || channelImage;
  const date = formatDate(text(item.pubDate));
  const slug = uniqueSlug(title, guid, usedSlugs);
  const plainDescription = htmlToText(description);

  return {
    title,
    description,
    plainDescription,
    excerpt: plainDescription.replace(/\s+/g, " ").trim().slice(0, 260),
    guid,
    slug,
    url: `${SITE_URL}/episodes/${slug}/`,
    link: text(item.link),
    enclosureUrl: item.enclosure?.["@_url"] || "",
    image,
    date,
  };
}

function jsonLd(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}

function head({ title, description, canonical, schema }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${canonical}" />
    <link rel="alternate" type="application/rss+xml" title="Yelling At Robots RSS Feed" href="${FEED_URL}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="${SHOW_NAME}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${SHOW_IMAGE}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${SHOW_IMAGE}" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/style.css" />
    <script type="application/ld+json">${jsonLd(schema)}</script>
  </head>`;
}

function banner() {
  return `
      <header class="top-banner">
        <p class="tiny">INDEPENDENT TECH TALK / LIVE RSS MIRROR</p>
        <div class="site-title" role="img" aria-label="Yelling At Robots">
          <span class="title-kicker">Yelling At</span>
          <span class="title-main">Robots</span>
        </div>
        <p class="tagline">Speedrunning the AI Gauntlet with blood shooting out of our eyes so you don't have to!</p>
        <marquee behavior="alternate" scrollamount="6">
          <span class="blink">NEW EPISODES</span> * FRESH FEED * UNDER CONSTRUCTION * HOT AUDIO DROPS *
        </marquee>
      </header>`;
}

function rails() {
  return `
        <aside class="left-rail box chrome">
          <h2>Directory</h2>
          <ul>
            <li><a href="/#feed">Podcast Feed</a></li>
            <li><a href="/#listen">Listen Everywhere</a></li>
            <li><a href="https://api.riverside.com/hosting/KCX6qbiI.rss">Raw RSS</a></li>
          </ul>
          <hr />
          <div class="signal-box">
            <p class="tiny">Signal</p>
            <p class="mood">ONLINE</p>
          </div>
        </aside>
        <aside class="right-rail box chrome">
          <h2 id="listen">Listen Everywhere</h2>
          <ul class="platform-links">
            <li><a href="https://podcasts.apple.com/podcast/id1878433691" target="_blank" rel="noopener noreferrer">Apple Podcasts</a></li>
            <li><a href="https://open.spotify.com/show/56D2fZSNNJiiRLjbDuUctS" target="_blank" rel="noopener noreferrer">Spotify</a></li>
            <li><a href="https://www.youtube.com/playlist?list=PL0Yo_vb29mGt2i-mWd0eJacj0kNnLtIKb" target="_blank" rel="noopener noreferrer">YouTube Playlist</a></li>
            <li><a href="https://www.iheart.com/podcast/330738302/" target="_blank" rel="noopener noreferrer">iHeartRadio</a></li>
            <li><a href="https://www.deezer.com/show/1002906221" target="_blank" rel="noopener noreferrer">Deezer</a></li>
          </ul>
          <p class="tiny copyright">1999-${new Date().getFullYear()} yellingatrobots.com</p>
        </aside>`;
}

function footer() {
  return `
      <footer class="footer box">
        <marquee scrollamount="4">Thanks for surfing! Add this page to your favorites and come back for more robot yelling. Also, We're Fucked™</marquee>
      </footer>`;
}

function renderEpisodeCard(episode) {
  const image = episode.image ? proxyImageUrl(episode.image) : "/favicon.svg";
  const description = episode.excerpt ? `${episode.excerpt}${episode.plainDescription.length > 260 ? "..." : ""}` : "Listen to this Yelling At Robots episode.";
  return `
          <li>
            <img class="episode-image loaded" src="${escapeHtml(image)}" alt="${escapeHtml(episode.title)}" width="288" height="288" loading="lazy" />
            <div class="episode-body">
              <a class="feed-title" href="${episode.url}">${escapeHtml(episode.title)}</a>
              <time class="feed-date" datetime="${episode.date.iso}">${escapeHtml(episode.date.label)}</time>
              <p class="feed-desc">${escapeHtml(description)}</p>
            </div>
          </li>`;
}

function renderEpisodePage(episode) {
  const description = episode.excerpt || `Listen to ${episode.title} from Yelling At Robots.`;
  const image = episode.image ? proxyImageUrl(episode.image) : "/favicon.svg";
  const schema = {
    "@context": "https://schema.org",
    "@type": "PodcastEpisode",
    "@id": `${episode.url}#episode`,
    name: episode.title,
    description,
    url: episode.url,
    mainEntityOfPage: episode.url,
    image: episode.image || SHOW_IMAGE,
    datePublished: episode.date.iso || undefined,
    partOfSeries: {
      "@type": "PodcastSeries",
      name: SHOW_NAME,
      url: `${SITE_URL}/`,
    },
    associatedMedia: episode.enclosureUrl
      ? {
          "@type": "AudioObject",
          contentUrl: episode.enclosureUrl,
        }
      : undefined,
  };

  const notes = notesHtml(episode.description) || "<p>No show notes were provided for this transmission.</p>";
  return `${head({
    title: `${episode.title} | ${SHOW_NAME}`,
    description,
    canonical: episode.url,
    schema,
  })}
  <body>
    <div class="stars" aria-hidden="true"></div>
    <div class="page-wrap">
      ${banner()}
      <main class="layout">
        ${rails()}
        <article class="content box episode-page">
          <div class="section-header">
            <div>
              <p class="tiny">Latest Transmission</p>
              <h1 class="episode-heading">${escapeHtml(episode.title)}</h1>
            </div>
          </div>
          <div class="episode-hero">
            <img class="episode-image loaded" src="${escapeHtml(image)}" alt="${escapeHtml(episode.title)}" width="288" height="288" />
            <div class="episode-body">
              <time class="feed-date" datetime="${episode.date.iso}">${escapeHtml(episode.date.label)}</time>
              <p class="feed-desc">${escapeHtml(episode.excerpt)}</p>
              ${episode.enclosureUrl ? `<p><a href="${escapeHtml(episode.enclosureUrl)}">Listen to the audio transmission</a></p>` : ""}
            </div>
          </div>
          <section class="episode-notes">
            <h2>Show Notes</h2>
            ${notes}
          </section>
          <p class="episode-navigation"><a href="/">← Back to all episodes</a></p>
        </article>
      </main>
      ${footer()}
    </div>
  </body>
</html>`;
}

async function fetchFeed() {
  const response = await fetch(FEED_URL, {
    headers: {
      "User-Agent": "yellingatrobots-static-site-builder",
      Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
    },
  });
  if (!response.ok) throw new Error(`RSS request failed with status ${response.status}`);
  return response.text();
}

async function build() {
  const xml = await fetchFeed();
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const feed = parser.parse(xml);
  const channel = feed.rss?.channel;
  if (!channel) throw new Error("RSS feed has no channel.");

  const channelImage = imageUrl(channel["itunes:image"]);
  const usedSlugs = new Set();
  const episodes = asArray(channel.item).map((item) => episodeFromItem(item, channelImage, usedSlugs));
  if (!episodes.length) throw new Error("RSS feed has no episodes.");

  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(path.join(DIST, "episodes"), { recursive: true });

  const sourceIndex = await fs.readFile(path.join(ROOT, "index.html"), "utf8");
  const homeEpisodes = episodes.slice(0, 25).map(renderEpisodeCard).join("\n");
  const index = sourceIndex.replace("<!-- BUILD_EPISODES -->", homeEpisodes);
  if (index === sourceIndex) throw new Error("Homepage is missing the BUILD_EPISODES marker.");

  await Promise.all([
    fs.writeFile(path.join(DIST, "index.html"), index),
    fs.copyFile(path.join(ROOT, "style.css"), path.join(DIST, "style.css")),
    fs.copyFile(path.join(ROOT, "script.js"), path.join(DIST, "script.js")),
    fs.copyFile(path.join(ROOT, "favicon.svg"), path.join(DIST, "favicon.svg")),
    fs.writeFile(path.join(DIST, "episodes.json"), JSON.stringify(episodes.map(({ title, url }) => ({ title, url })), null, 2)),
    fs.writeFile(
      path.join(DIST, "robots.txt"),
      `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
    ),
    fs.writeFile(
      path.join(DIST, "sitemap.xml"),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[
        `<url><loc>${SITE_URL}/</loc></url>`,
        ...episodes.map((episode) => `<url><loc>${episode.url}</loc>${episode.date.iso ? `<lastmod>${episode.date.iso}</lastmod>` : ""}</url>`),
      ].map((url) => `  ${url}`).join("\n")}\n</urlset>\n`,
    ),
  ]);

  await Promise.all(
    episodes.map(async (episode) => {
      const directory = path.join(DIST, "episodes", episode.slug);
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(path.join(directory, "index.html"), renderEpisodePage(episode));
    }),
  );

  console.log(`Built ${episodes.length} episode pages in ${path.relative(ROOT, DIST)}/`);
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
