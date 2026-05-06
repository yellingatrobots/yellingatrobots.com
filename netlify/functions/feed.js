const FEED_URL = "https://api.riverside.com/hosting/KCX6qbiI.rss";

exports.handler = async function handler() {
  try {
    const response = await fetch(FEED_URL, {
      headers: {
        "User-Agent": "yellingatrobots-geocities-feed-proxy",
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      },
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60",
        },
        body: JSON.stringify({ error: "Unable to fetch upstream RSS feed." }),
      };
    }

    const xml = await response.text();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
      body: xml,
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: "Unexpected server error while loading feed." }),
    };
  }
};
