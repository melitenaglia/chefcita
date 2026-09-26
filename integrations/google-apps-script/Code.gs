const CHEFCITA_ALLOWED_HOSTS = new Set(["instagram.com","www.instagram.com","m.instagram.com"]);

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const expected = PropertiesService.getScriptProperties().getProperty("CHEFCITA_TOKEN") || "";
    if (expected && body.token !== expected) {
      return json_({ok:false,error:"Unauthorized"});
    }

    const url = cleanInstagramUrl_(body.url || "");
    if (!url) return json_({ok:false,error:"Invalid Instagram URL"});

    const result = extractInstagram_(url);
    return json_(result);
  } catch (err) {
    return json_({ok:false,error:String(err && err.message ? err.message : err)});
  }
}

function extractInstagram_(url) {
  const attempts = [
    url,
    url.replace(/\/$/,"") + "/embed/captioned/",
    url.replace(/\/$/,"") + "/embed/"
  ];

  const options = {
    muteHttpExceptions: true,
    followRedirects: true,
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8"
    }
  };

  let bestImage = "";
  let bestAuthor = "";
  const debug = [];

  for (const attempt of attempts) {
    const response = UrlFetchApp.fetch(attempt, options);
    const status = response.getResponseCode();
    const html = response.getContentText() || "";
    const row = {url:attempt,status:status,html_length:html.length};

    if (status < 200 || status >= 400) {
      debug.push(row);
      continue;
    }

    const description =
      getMeta_(html,"og:description") ||
      getMeta_(html,"twitter:description") ||
      getMeta_(html,"description");

    const image =
      getMeta_(html,"og:image") ||
      getMeta_(html,"twitter:image");

    const author = extractUsername_(html, description);

    if (image && !bestImage) bestImage = image;
    if (author && !bestAuthor) bestAuthor = author;

    row.has_description = Boolean(description);
    row.has_image = Boolean(image);
    row.has_author = Boolean(author);

    if (description) {
      const caption = cleanInstagramDescription_(description);
      row.caption_length = caption.length;
      row.boilerplate = isLoginBoilerplate_(caption);

      if (caption && !row.boilerplate) {
        debug.push(row);
        return {
          ok:true,
          caption:caption,
          image_url:bestImage,
          author_handle:bestAuthor,
          debug:debug
        };
      }
    }

    const jsonCaption = extractJsonCaption_(html);
    row.has_json_caption = Boolean(jsonCaption);

    if (jsonCaption && !isLoginBoilerplate_(jsonCaption)) {
      debug.push(row);
      return {
        ok:true,
        caption:jsonCaption,
        image_url:bestImage,
        author_handle:bestAuthor,
        debug:debug
      };
    }

    debug.push(row);
  }

  return {
    ok:false,
    error:"Instagram no devolvió un caption utilizable",
    caption:"",
    image_url:bestImage,
    author_handle:bestAuthor,
    debug:debug
  };
}

function cleanInstagramUrl_(value) {
  const cleaned = String(value || "").replace(/&amp;/g,"&").split("?")[0].trim();
  const match = cleaned.match(/^https:\/\/(?:www\.|m\.)?instagram\.com\/(reel|p|tv)\/[^/?#]+\/?$/i);
  return match ? cleaned : "";
}

function getMeta_(html, key) {
  const safe = key.replace(/[.*+?^$(){}|[\]\\]/g,"\\$&");
  const patterns = [
    new RegExp('<meta[^>]+(?:property|name)=["\\\']' + safe + '["\\\'][^>]+content=["\\\']([\\s\\S]*?)["\\\'][^>]*>','i'),
    new RegExp('<meta[^>]+content=["\\\']([\\s\\S]*?)["\\\'][^>]+(?:property|name)=["\\\']' + safe + '["\\\'][^>]*>','i')
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) return decodeHtml_(match[1]).trim();
  }
  return "";
}

function cleanInstagramDescription_(raw) {
  let text = decodeHtml_(String(raw || "")).replace(/\r/g,"").trim();

  const quoted =
    text.match(/^(?:[\d.,KMBkmb]+\s+)?(?:likes?|me gusta).*?(?:comments?|comentarios?)\s*-\s*[^:]+:\s*["“]([\s\S]*)["”]\s*$/i) ||
    text.match(/^[^:]+:\s*["“]([\s\S]*)["”]\s*$/i);

  if (quoted && quoted[1]) text = quoted[1];

  return text
    .replace(/[ \t]+\n/g,"\n")
    .replace(/\n[ \t]+/g,"\n")
    .trim();
}

function extractUsername_(html, description) {
  const match = html.match(/"username"\s*:\s*"([^"]+)"/i);
  if (match && match[1]) return "@" + decodeJsonString_(match[1]);

  const fromDescription = String(description || "").match(/-\s*@?([A-Za-z0-9._]+)\s+(?:on Instagram|en Instagram)?\s*:/i);
  if (fromDescription && fromDescription[1]) return "@" + fromDescription[1];

  return "";
}

function extractJsonCaption_(html) {
  const patterns = [
    /"caption"\s*:\s*\{[\s\S]{0,12000}?"text"\s*:\s*"((?:\\.|[^"\\])*)"/i,
    /"edge_media_to_caption"\s*:\s*\{[\s\S]{0,12000}?"text"\s*:\s*"((?:\\.|[^"\\])*)"/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) return decodeJsonString_(match[1]).trim();
  }
  return "";
}

function decodeJsonString_(value) {
  try {
    return JSON.parse('"' + String(value).replace(/"/g,'\\\"') + '"');
  } catch (_err) {
    return String(value || "")
      .replace(/\\n/g,"\n")
      .replace(/\\r/g,"")
      .replace(/\\u([0-9a-fA-F]{4})/g,function(_m,hex){return String.fromCharCode(parseInt(hex,16));})
      .replace(/\\\//g,"/")
      .replace(/\\\"/g,'"')
      .replace(/\\\\/g,"\\");
  }
}

function decodeHtml_(value) {
  return String(value || "")
    .replace(/&quot;/g,'"')
    .replace(/&#39;|&apos;/g,"'")
    .replace(/&amp;/g,"&")
    .replace(/&lt;/g,"<")
    .replace(/&gt;/g,">")
    .replace(/&#(\d+);/g,function(_m,n){return String.fromCodePoint(parseInt(n,10));})
    .replace(/&#x([0-9a-fA-F]+);/g,function(_m,n){return String.fromCodePoint(parseInt(n,16));});
}

function isLoginBoilerplate_(value) {
  const lower = String(value || "").toLowerCase();
  return lower.indexOf("crea una cuenta o inicia sesión en instagram") !== -1 ||
    lower.indexOf("log in to instagram") !== -1 ||
    lower.indexOf("sign up to instagram") !== -1 ||
    lower.indexOf("comparte lo que te gusta con las personas que te entienden") !== -1;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
