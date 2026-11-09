I went through your code, the README, and the sample sheet. The pipeline is well built: proxy fallbacks, structured JSON output from Gemini, deduplication and batched sheet writes are all good choices. There are two real bugs to fix before adding images, though, and images will only fit inside the 6-minute limit if the project is reorganised first.

## 1. Two bugs to fix first

### Bug A: News after the first 8 is lost for good

Here's the current order:

1. All new items are saved to the Sheet (step 5).
2. Only the first 8 go into the Doc (`MAX_DOC_ITEMS_PER_RUN = 8`), or fewer if the 4.5-minute limit is hit.
3. On the next run, the deduplication check sees the rest in the Sheet as "already done" and skips them.

So any item after the first 8 never reaches the Doc. Adding images makes this worse, because each article takes longer and fewer get processed per run.

### Bug B: Gemini is making up publish dates

Your sheet has four rows dated **2024-05-20** that were scraped on 7/16/2026. Their URL IDs (e.g. thansettakij `664123`) are _newer_ than the rows dated 2026-07-15 (`664085`). Gemini is guessing the date. **Always take the date from the RSS `pubDate` or sitemap `<news:publication_date>`**, and remove `date` from the Gemini schema.

## 2. Target design: a queue that runs in stages

Split the work into small steps. Each run handles as much as it can, saves where it stopped, and the next run picks up from there.

| Trigger      | Schedule                                                                         | Job                                                                                                                     |
| ------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `discover()` | 06, 09, 12, 15, 18 (real time-based triggers, not an hour check inside the code) | Fetch feeds, filter by keyword, dedupe, classify with Gemini, then add rows to the Queue sheet with status `CLASSIFIED` |
| `worker()`   | Every 10 min                                                                     | Take `CLASSIFIED` rows, fetch the HTML, pick images, extract the text, write to the Doc, mark `IN_DOC`                  |
| `notifier()` | Inside `worker()`                                                                | Once every item from that round is `IN_DOC` or `ERROR`, send one Email/Teams message                                    |

**Queue sheet columns:** `id (URL hash) | url | source | pubDate | headline | category | impact | status | attempts | lastError | cycleId | docId | imageCount | updatedAt`

- Status flow: `CLASSIFIED → IN_DOC`, or `ERROR` after 3 failed attempts.
- Keep `NewsDatabase` as the final, clean table. Write a row there only once the item is `IN_DOC`.

### The core pieces

```javascript
const RUN_BUDGET_MS = 4.5 * 60 * 1000;
const PER_ARTICLE_RESERVE_MS = 60 * 1000; // don't start an article without 60s left

function worker() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return; // stop overlapping runs
  const t0 = Date.now();
  const timeLeft = () => RUN_BUDGET_MS - (Date.now() - t0);
  try {
    const q = Queue.open();
    const jobs = q.byStatus("CLASSIFIED").slice(0, 12);
    if (!jobs.length) return;
    const htmls = fetchAllSafe(jobs.map((j) => j.url)); // parallel HTML fetch
    const doc = getOrCreateDailyDoc();
    for (let i = 0; i < jobs.length; i++) {
      if (timeLeft() < PER_ARTICLE_RESERVE_MS) break; // the rest waits for the next run
      try {
        processArticle(doc, jobs[i], htmls[i]);
        q.update(jobs[i].id, { status: "IN_DOC", updatedAt: new Date() });
      } catch (e) {
        const a = (jobs[i].attempts || 0) + 1;
        q.update(jobs[i].id, {
          status: a >= 3 ? "ERROR" : "CLASSIFIED",
          attempts: a,
          lastError: String(e).slice(0, 500),
        });
      }
    }
    doc.saveAndClose();
    maybeNotify(q);
  } finally {
    lock.releaseLock();
  }
}

function fetchWithRetry(url, opts, tries) {
  tries = tries || 3;
  for (let i = 0; i < tries; i++) {
    const r = UrlFetchApp.fetch(
      url,
      Object.assign({ muteHttpExceptions: true }, opts),
    );
    const c = r.getResponseCode();
    if (c < 400) return r;
    if (c === 429 || c >= 500) {
      Utilities.sleep(Math.min(2000 * Math.pow(2, i), 8000));
      continue;
    }
    return r;
  }
  throw new Error("Retry exhausted: " + url);
}
```

## 3. Content images (charts and infographics) in the Doc

### How it works for each article

1. **Collect candidates** from the article HTML: `<img>` tags (including `data-src` and `srcset` for lazy-loaded images) plus `og:image`.
2. **Rule-based filter** to drop logos, icons, avatars, ads, SVG/GIF files and tiny images. This is free.
3. **Fetch all candidates in parallel** with `UrlFetchApp.fetchAll`, and skip anything under ~15 KB or over 4 MB.
4. **One Gemini call** with the article text and up to 4 images. It returns the full text plus, for each image, whether to keep it, its type and a Thai caption.
5. **Insert the kept images** into the Doc, scaled to the page width, with a caption and source credit.

Step 4 replaces your current `fetchFullContentWithGemini`, so adding images doesn't add another Gemini call per article.

### Step 1–2: Collect and pre-filter

```javascript
const BAD_IMG =
  /(^|[\/_.-])(logo|icon|avatar|author|profile|banner|ads?|sprite|placeholder|loading|pixel|share|social|emoji)([\/_.-]|$)|doubleclick|googlesyndication|\.svg(\?|$)|\.gif(\?|$)/i;

function extractImageCandidates(html, pageUrl, cfg) {
  // Narrow to the article body using a marker set per source
  let region = html;
  if (cfg && cfg.bodyStart) {
    const s = html.indexOf(cfg.bodyStart);
    if (s > -1) {
      const e = cfg.bodyEnd ? html.indexOf(cfg.bodyEnd, s) : -1;
      region = html.slice(s, e > s ? e : undefined); // cuts out "related news" thumbnails
    }
  }
  const out = [],
    seen = {};
  const og = (html.match(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i,
  ) || [])[1];
  if (og) {
    out.push({ src: absUrl(og, pageUrl), alt: "cover", isCover: true });
    seen[og] = 1;
  }

  const re = /<img\b[^>]*>/gi;
  let m;
  while ((m = re.exec(region)) && out.length < 8) {
    const tag = m[0];
    const attr = (n) =>
      (tag.match(new RegExp("\\s" + n + "\\s*=\\s*[\"']([^\"']+)[\"']", "i")) ||
        [])[1] || "";
    let src = attr("data-src") || attr("data-lazy-src") || attr("src");
    const srcset = attr("data-srcset") || attr("srcset");
    if (srcset) src = largestFromSrcset(srcset) || src;
    if (!src || src.indexOf("data:") === 0) continue;
    src = absUrl(src, pageUrl);
    const alt = attr("alt"),
      w = +attr("width") || 0,
      h = +attr("height") || 0;
    if (seen[src] || BAD_IMG.test(src) || (w && w < 300) || (h && h < 200))
      continue;
    seen[src] = 1;
    out.push({ src, alt, w, h });
  }
  return out;
}

function largestFromSrcset(s) {
  return s
    .split(",")
    .map((x) => x.trim().split(/\s+/))
    .map(([u, d]) => ({ u, n: parseInt(d) || 0 }))
    .sort((a, b) => b.n - a.n)[0].u;
}
function absUrl(u, base) {
  if (/^https?:\/\//i.test(u)) return u;
  if (u.indexOf("//") === 0) return "https:" + u;
  const origin = base.match(/^https?:\/\/[^\/]+/)[0];
  return u[0] === "/" ? origin + u : base.replace(/[^\/]*$/, "") + u;
}
```

**Tip:** add `bodyStart` / `bodyEnd` to each source's config (e.g. the class of the article content div). This one change removes most of the junk images.

### Step 3: Fetch in parallel and handle WebP

Google Docs only accepts **PNG, JPEG and GIF** (under 50 MB and 25 megapixels), but many Thai news sites serve WebP. Gemini can still _read_ WebP, so it's only a problem when inserting into the Doc.

```javascript
function fetchImages(cands, referer) {
  const reqs = cands.map((c) => ({
    url: c.src,
    muteHttpExceptions: true,
    headers: {
      Accept: "image/jpeg,image/png;q=0.9,*/*;q=0.1",
      Referer: referer,
      "User-Agent": UA,
    },
  }));
  return UrlFetchApp.fetchAll(reqs)
    .map((r, i) => {
      if (r.getResponseCode() !== 200) return null;
      const blob = r.getBlob(),
        type = (blob.getContentType() || "").split(";")[0];
      const size = blob.getBytes().length;
      if (
        !/^image\/(jpeg|png|gif|webp)$/.test(type) ||
        size < 15000 ||
        size > 4e6
      )
        return null;
      return Object.assign({}, cands[i], { blob, mime: type });
    })
    .filter(Boolean)
    .slice(0, 4);
}
```

For images that still come back as WebP:

- **Option 1 (often works):** the `Accept` header above asks the server for JPEG/PNG, and many CDNs will send it.
- **Option 2:** upload the WebP to a Drive temp folder, read `thumbnailLink` via the Advanced Drive service, change the size suffix to `=s1600`, and fetch it with `ScriptApp.getOAuthToken()`. You get back a PNG/JPEG.
- **Option 3:** an external converter such as `wsrv.nl/?url=...&output=jpg`. It's convenient, but it's a third-party service, so check your company policy.
- If none of these work, put a link "📊 ดูอินโฟกราฟิก" pointing to the image URL in place of the image.

### Step 4: One Gemini call for text and image selection

```javascript
function extractArticleWithImages(cleanedText, imgs, item) {
  const parts = [
    { text: EXTRACT_PROMPT },
    {
      text:
        "ARTICLE HEADLINE: " +
        item.headline +
        "\n\nRAW PAGE TEXT:\n" +
        cleanedText.slice(0, 60000),
    },
  ];
  imgs.forEach((im, i) => {
    parts.push({
      text: `IMAGE #${i} (alt="${im.alt}", isCover=${!!im.isCover})`,
    });
    parts.push({
      inline_data: {
        mime_type: im.mime,
        data: Utilities.base64Encode(im.blob.getBytes()),
      },
    });
  });
  const payload = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          fullText: { type: "STRING" },
          images: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                index: { type: "INTEGER" },
                keep: { type: "BOOLEAN" },
                kind: {
                  type: "STRING",
                  enum: [
                    "chart",
                    "infographic",
                    "table",
                    "map",
                    "photo",
                    "other",
                  ],
                },
                captionTh: { type: "STRING" },
              },
              required: ["index", "keep", "kind"],
            },
          },
        },
        required: ["fullText", "images"],
      },
    },
  };
  // send with fetchWithRetry + header x-goog-api-key, as you already do
}
```

Prompt rules for picking images (add these to `EXTRACT_PROMPT`):

- KEEP (`keep=true`) only charts, graphs, infographics, data tables or maps that carry numbers or information directly tied to this article: prices, export volumes, output, policy timelines.
- REJECT people photos, press-event photos, stock photos, logos, ads, thumbnails of other stories, and cover images that are just the headline with no data.
- `captionTh`: one short Thai sentence describing what the image shows.
- `fullText`: copy the article body exactly. Don't summarise or add anything.

### Step 5: Insert into the Doc, scaled to the page width

```javascript
function appendImagesToDoc(body, keptImgs, item) {
  const maxW =
    body.getPageWidth() - body.getMarginLeft() - body.getMarginRight();
  keptImgs.forEach((im) => {
    try {
      const p = body.appendParagraph("");
      p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      const img = p.appendInlineImage(im.blob);
      const w = img.getWidth(),
        h = img.getHeight();
      if (w > maxW) img.setWidth(maxW).setHeight(Math.round((h * maxW) / w));
      img.setLinkUrl(im.src);
      const cap = body.appendParagraph(
        `ภาพ: ${im.captionTh || im.kind} (ที่มา: ${item.source})`,
      );
      styleParagraph(cap, "Cordia New", 12, "#666666", false, true);
      cap.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    } catch (e) {
      body.appendParagraph("📊 ดูภาพประกอบ: " + im.src).setLinkUrl(im.src); // if insertion fails
    }
  });
}
```

Order per article in the Doc: **headline → summary box → kept images → full text → source link.** Put the images before the full text so readers see the data first.

**Time per article:** roughly 1–2 s for parallel image fetching, 8–20 s for the Gemini call with images, and 1–3 s for writing to the Doc. That works out to about 6–10 articles per run. With the queue, anything left over is simply handled in the next run.

## 4. Other production-grade fixes

| Area             | Problem now                                                                           | Fix                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Model**        | Defaults to `gemini-1.5-flash`, which Google has retired                              | Set `GEMINI_MODEL_NAME` to a current Flash model, use `temperature: 0`, and alert if the call fails                                                                             |
| **Security**     | ScraperAPI is called over `http://`, so the API key travels unencrypted               | Switch to `https://api.scraperapi.com`                                                                                                                                          |
| **Proxy**        | allorigins.win is unreliable and is a third party that sees every URL                 | Remove it, or move it to last place, and log which method succeeded for each source                                                                                             |
| **Concurrency**  | No `LockService`                                                                      | Two runs can overlap and create duplicate rows or Docs                                                                                                                          |
| **Errors**       | No handling for 429/503                                                               | Use `fetchWithRetry` with exponential backoff                                                                                                                                   |
| **Dedup**        | `getExistingNewsKeys` reads the whole sheet every time, which gets slower as it grows | Read only the last ~2,000 rows or 14 days. Normalise URLs (strip `utm_*`, `#`, trailing `/`) and dedupe on a URL hash                                                           |
| **Parallelism**  | Only single `fetch()` calls                                                           | Use `fetchAll` for feeds, article HTML and images. This alone saves 1–2 minutes per run                                                                                         |
| **Data quality** | Gemini fills in "ไม่มี"                                                               | Use an empty value so you can filter and calculate in Sheets                                                                                                                    |
| **Config**       | Sources and keywords are hardcoded                                                    | Move them to a `Config` sheet (sources, `bodyStart`/`bodyEnd`, enabled flag) so you can change them without redeploying                                                         |
| **Monitoring**   | Only `Logger.log`                                                                     | Add a `RunLog` sheet (run ID, duration, items, errors, fetch method per source). Send a Teams alert if a source returns 0 items 3 times in a row or there are 3 errors in a row |
| **Time zone**    | Hour check inside the code                                                            | Set `"timeZone": "Asia/Bangkok"` in `appsscript.json` and use real triggers                                                                                                     |
| **Deploy**       | Code edited in the online editor                                                      | Use `clasp` with Git, and keep separate DEV and PROD script projects and Sheets                                                                                                 |
| **Tests**        | None                                                                                  | Save one sample XML per source, plus unit tests for each parser, to catch site layout changes                                                                                   |

**GAS quotas to watch:**

- Each run can last at most 6 minutes.
- Total trigger runtime per day is 90 minutes on a personal account (more on Workspace).
- URL fetch calls per day are capped (20,000 on a personal account, more on Workspace).
- Every image fetch counts against that daily cap, so cap candidates at 4–8 per article.

## 5. Recommended order of work

1. **Fix both bugs:** use the feed's pubDate, and add the Queue sheet so news isn't lost.
2. Add LockService, `fetchWithRetry`, https for ScraperAPI, and update the model name.
3. Use `fetchAll` for feeds and HTML.
4. Add the image pipeline, starting with 2–3 sources that use a lot of infographics (Thansettakij and Bangkokbiznews tend to).
5. Add the Config sheet, RunLog sheet, alerts and `clasp`.

**On copyright:** news images belong to the publishers. Keep the Doc for internal use only, and always include the source and a link back.

I can write the full refactored code for you (Queue, worker, image pipeline and a Config sheet layout) as separate `.gs` files. It would help if you send me the article HTML structure for 2–3 sources so I can set accurate `bodyStart`/`bodyEnd` values for each.
