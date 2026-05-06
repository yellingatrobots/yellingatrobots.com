exports.handler = async function handler(event) {
  const imageUrl = event.queryStringParameters?.url;

  if (!imageUrl) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing image URL." }),
    };
  }

  let url;
  try {
    url = new URL(imageUrl);
  } catch (error) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid image URL." }),
    };
  }

  if (!/^https?:$/.test(url.protocol)) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Only HTTP(S) image URLs are allowed." }),
    };
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "yellingatrobots-bitmap-image-proxy",
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5",
      },
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Unable to fetch upstream image." }),
      };
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    if (!contentType.startsWith("image/")) {
      return {
        statusCode: 415,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Upstream URL did not return an image." }),
      };
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
      body: buffer.toString("base64"),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Unexpected server error while loading image." }),
    };
  }
};
