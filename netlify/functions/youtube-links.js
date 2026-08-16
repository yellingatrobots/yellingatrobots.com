const { fetchYoutubeVideos } = require("../../lib/youtube-links");

exports.handler = async function handler() {
  try {
    const videos = await fetchYoutubeVideos();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
      body: JSON.stringify({ videos }),
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Unable to load YouTube episode links." }),
    };
  }
};
