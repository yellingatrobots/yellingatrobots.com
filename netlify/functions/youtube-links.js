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

exports.handler = async function handler() {
  try {
    const response = await fetch(PLAYLIST_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 yellingatrobots-youtube-linker",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Unable to fetch YouTube playlist." }),
      };
    }

    const html = await response.text();
    const match = html.match(/var ytInitialData = (.*?);<\/script>/s);

    if (!match) {
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Unable to parse YouTube playlist." }),
      };
    }

    const data = JSON.parse(match[1]);
    const videos = collectVideos(data);
    const uniqueVideos = Array.from(new Map(videos.map((video) => [video.url, video])).values());

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
      body: JSON.stringify({ videos: uniqueVideos }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Unexpected server error while loading YouTube links." }),
    };
  }
};
