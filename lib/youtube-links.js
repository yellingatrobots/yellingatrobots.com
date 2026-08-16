const PLAYLIST_URL = "https://www.youtube.com/playlist?list=PL0Yo_vb29mGt2i-mWd0eJacj0kNnLtIKb";

function getTitle(title) {
  if (title?.simpleText) return title.simpleText;
  if (title?.runs) return title.runs.map((run) => run.text).join("");
  return "";
}

function collectVideos(node, videos = []) {
  if (!node || typeof node !== "object") return videos;

  if (node.playlistVideoRenderer?.videoId) {
    const video = node.playlistVideoRenderer;
    const title = getTitle(video.title).trim();

    if (title) {
      videos.push({
        title,
        url: `https://www.youtube.com/watch?v=${video.videoId}&list=PL0Yo_vb29mGt2i-mWd0eJacj0kNnLtIKb`,
      });
    }
  }

  Object.values(node).forEach((value) => collectVideos(value, videos));
  return videos;
}

async function fetchYoutubeVideos() {
  const response = await fetch(PLAYLIST_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 yellingatrobots-youtube-linker",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) throw new Error(`YouTube playlist request failed with status ${response.status}`);

  const html = await response.text();
  const match = html.match(/var ytInitialData = (.*?);<\/script>/s);
  if (!match) throw new Error("Unable to parse YouTube playlist.");

  const videos = collectVideos(JSON.parse(match[1]));
  return Array.from(new Map(videos.map((video) => [video.url, video])).values());
}

module.exports = { PLAYLIST_URL, fetchYoutubeVideos };
