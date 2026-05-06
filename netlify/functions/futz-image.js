const sharp = require("sharp");

const OUTPUT_SIZE = 288;
const PIXEL_SIZE = 96;
const POSTERIZE_STEP = 17;
const ALLOWED_HOSTS = new Set(["hosting-media.riverside.com"]);

function clamp(value) {
  return Math.max(0, Math.min(255, value));
}

function posterize(value) {
  return clamp(Math.round(value / POSTERIZE_STEP) * POSTERIZE_STEP);
}

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

  if (!/^https?:$/.test(url.protocol) || !ALLOWED_HOSTS.has(url.hostname)) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Image URL is not allowed." }),
    };
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "yellingatrobots-futz-image",
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

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      return {
        statusCode: 415,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Upstream URL did not return an image." }),
      };
    }

    const input = Buffer.from(await response.arrayBuffer());
    const tiny = await sharp(input)
      .rotate()
      .resize(PIXEL_SIZE, PIXEL_SIZE, { fit: "cover", position: "center" })
      .modulate({ saturation: 1.18 })
      .ensureAlpha()
      .raw()
      .toBuffer();

    for (let i = 0; i < tiny.length; i += 4) {
      tiny[i] = posterize(tiny[i]);
      tiny[i + 1] = posterize(tiny[i + 1]);
      tiny[i + 2] = posterize(tiny[i + 2]);
    }

    const expanded = await sharp(tiny, {
      raw: {
        width: PIXEL_SIZE,
        height: PIXEL_SIZE,
        channels: 4,
      },
    })
      .resize(OUTPUT_SIZE, OUTPUT_SIZE, { kernel: "nearest" })
      .raw()
      .toBuffer();

    for (let y = 0; y < OUTPUT_SIZE; y += 4) {
      for (let x = 0; x < OUTPUT_SIZE; x += 1) {
        const i = (y * OUTPUT_SIZE + x) * 4;
        expanded[i] = Math.round(expanded[i] * 0.84);
        expanded[i + 1] = Math.round(expanded[i + 1] * 0.84);
        expanded[i + 2] = Math.round(expanded[i + 2] * 0.84);
      }
    }

    const output = await sharp(expanded, {
      raw: {
        width: OUTPUT_SIZE,
        height: OUTPUT_SIZE,
        channels: 4,
      },
    })
      .png({ compressionLevel: 9, palette: true, colors: 256 })
      .toBuffer();

    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, immutable",
      },
      body: output.toString("base64"),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Unexpected server error while futzing image." }),
    };
  }
};
