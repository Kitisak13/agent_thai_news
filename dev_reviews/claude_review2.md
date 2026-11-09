I went through the updated code. The developer fixed several things properly, but **the most important bug (news being lost) is still there**, and **the images feature hasn't been started**. The details are below.

## 1. What's fixed and what isn't

| Item                                         | Status               | Notes                                                                                                                                                                                                                          |
| -------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Publish date taken from the feed, not Gemini | ✅ Fixed             | `date` is gone from the schema and `publish_date` comes from `match.pubDate`. Good.                                                                                                                                            |
| LockService                                  | ✅ Fixed             | `tryLock(30000)` with `finally`. Correct.                                                                                                                                                                                      |
| ScraperAPI over https                        | ✅ Fixed             |                                                                                                                                                                                                                                |
| API key in a header and `temperature: 0`     | ✅ Fixed             | Both Gemini calls use `x-goog-api-key`.                                                                                                                                                                                        |
| Model name                                   | ⚠️ **Wrong default** | The fallback is `gemini-2.0-flash`, which [Google shut down on June 1, 2026](https://www.aiweekly.co/alerts/google-retires-gemini-20-flash-001-replace-with-25-flash). If the Script Property is ever empty, every call fails. |
| **News lost after the first 8 items**        | ❌ **Not fixed**     | Still saves to the Sheet first, then puts only 8 items in the Doc. The rest are marked as done and skipped forever.                                                                                                            |
| Queue / staged processing                    | ❌ Not done          |                                                                                                                                                                                                                                |
| Retry/backoff for 429/5xx errors             | ❌ Not done          |                                                                                                                                                                                                                                |
| Parallel fetching (`fetchAll`)               | ❌ Not done          | 8 feeds and up to 8 articles are still fetched one at a time.                                                                                                                                                                  |
| AllOrigins proxy                             | ❌ Still used        | Third-party and unreliable.                                                                                                                                                                                                    |
| Hour check inside the code                   | ❌ Still there       |                                                                                                                                                                                                                                |
| Placeholder text "ไม่มี" in empty fields     | ❌ Still there       |                                                                                                                                                                                                                                |
| **Images in the Doc**                        | ❌ **Not started**   | Worse, `cleanHtmlForAI` strips every `<img>` tag before anything could use them.                                                                                                                                               |

On the model: sources disagree on the official replacement (some say 2.5 Flash, others a 3.x Flash), and Google is also retiring 2.5 Flash later in 2026. Check [Google's deprecations page](https://ai.google.dev/gemini-api/docs/deprecations?hl=en), pin the current Flash model in the Script Property, and **have the code throw an error if the property is empty** instead of falling back to a hardcoded name.

## 2. New problems I found in this version

**1. Headline deduplication doesn't work.** The Sheet stores Gemini's _rewritten_ headline, but the pre-dedup step compares it against the _original feed title_. These rarely match, so only the URL check is actually doing anything.

- **Fix:** store the original feed title, or add a column for it, and dedupe on that.

**2. Gemini can invent URLs.** If the `ref_id` doesn't match, the code tries to match on Gemini's `url` or `headline`. If that also fails, the item is **still saved** with whatever URL Gemini returned.

- **Fix:** drop any item whose `ref_id` doesn't match. Also remove `source`, `url` and `headline` from the classification schema, because you already have them. This saves tokens too.

**3. One large batch can lose a whole run.** All candidates go into a single classification call. If there are 50+ items, the JSON response can get cut off (`MAX_TOKENS`), `JSON.parse` fails, and the whole run is lost.

- **Fix:** send candidates in chunks of about 20–25, and check `finishReason` and the HTTP status before parsing.

**4. Failed articles are treated as done.** `fetchFullContentWithGemini` returns the text "ไม่สามารถถอด..." instead of throwing an error. That text goes into the Doc and the item counts as finished, so it's never retried.

- **Fix:** throw an error so the queue can retry the item.

**5. One article error can stop the whole Doc loop.** `appendNewsToDoc` has no try/catch around each item, so a single failure ends the loop for every article after it.

**6. Notifications list news that isn't in the Doc.** `sendEmailNotification(newItems, ...)` lists every new item, even ones that were never written to the Doc.

**7. Articles with slightly future timestamps are dropped.** `isWithinLast24Hours` requires `diffHours >= 0`. If a feed's clock is a little ahead, or its time zone is parsed wrong, the article is thrown away.

- **Fix:** allow about 1 hour into the future, and set `"timeZone": "Asia/Bangkok"` in `appsscript.json`. Without that, `new Date("2026-07-16 10:00:00")` is read in the script's time zone.

**8. The dedup step reads the whole Sheet every run.** It loads all rows × 9 columns each time and gets slower as the Sheet grows.

- **Fix:** read only the last ~2,000 rows.

## 3. Next step: the smallest change that fixes the lost-news bug

You don't need a separate Queue sheet. **Add 4 columns to the existing Sheet** and split the work into two triggers:

- **J:** `DocStatus` (`PENDING` / `IN_DOC` / `ERROR`)
- **K:** `Attempts`
- **L:** `LastError`
- **M:** `ImageCount`

**Changes to `startRssNewsAgent`:**

- `saveJsonToSheet` writes `PENDING` in column J.
- **Remove the whole Doc and notification section** from this function. It should only fetch, classify and save.

**Add a new worker function:**

```javascript
const COL = { URL: 9, STATUS: 10, ATTEMPTS: 11, ERR: 12, IMGS: 13 };
const BUDGET_MS = 4.5 * 60 * 1000;
const RESERVE_MS = 60 * 1000; // don't start a new article with less than 60s left

function processDocQueue() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  const t0 = Date.now();
  const left = () => BUDGET_MS - (Date.now() - t0);
  try {
    const sheet = getNewsSheet_();
    const last = sheet.getLastRow();
    if (last < 2) return;
    const start = Math.max(2, last - 299); // read only the last 300 rows
    const rows = sheet.getRange(start, 1, last - start + 1, 13).getValues();
    const jobs = rows
      .map((r, i) => ({ row: start + i, r }))
      .filter((j) => j.r[COL.STATUS - 1] === "PENDING")
      .slice(0, 10);
    if (!jobs.length) {
      maybeNotify_();
      return;
    }

    const apiKey = getRequiredProp_("GEMINI_API_KEY");
    const doc = getOrCreateDailyDoc(getRequiredProp_("DRIVE_FOLDER_ID"));
    const htmls = fetchArticlesParallel_(jobs.map((j) => j.r[COL.URL - 1])); // fetchAll

    for (let k = 0; k < jobs.length; k++) {
      if (left() < RESERVE_MS) break; // the rest waits for the next run
      const j = jobs[k],
        item = rowToItem_(j.r);
      try {
        const html = htmls[k] || fetchXml(item.url);
        const res = processArticle_(doc, item, html, apiKey); // text + images
        sheet
          .getRange(j.row, COL.STATUS, 1, 4)
          .setValues([
            ["IN_DOC", j.r[COL.ATTEMPTS - 1] || 0, "", res.imageCount],
          ]);
      } catch (e) {
        const a = (Number(j.r[COL.ATTEMPTS - 1]) || 0) + 1;
        sheet
          .getRange(j.row, COL.STATUS, 1, 3)
          .setValues([
            [a >= 3 ? "ERROR" : "PENDING", a, String(e).slice(0, 300)],
          ]);
      }
    }
    doc.saveAndClose();
    maybeNotify_();
  } finally {
    lock.releaseLock();
  }
}
```

**When to notify:** `startRssNewsAgent` saves the new item URLs to a Script Property called `PENDING_NOTIFY`. `maybeNotify_()` checks whether all of them are now `IN_DOC` or `ERROR`. If they are, it sends one Email/Teams message and clears the property. That way the notification only includes news that's actually in the Doc.

**Use real triggers instead of the hour check:**

```javascript
function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  [6, 9, 12, 15, 18].forEach((h) =>
    ScriptApp.newTrigger("startRssNewsAgent")
      .timeBased()
      .atHour(h)
      .everyDays(1)
      .inTimezone("Asia/Bangkok")
      .create(),
  );
  ScriptApp.newTrigger("processDocQueue").timeBased().everyMinutes(10).create();
}
```

`atHour` fires within about ±15 minutes of the hour, which is fine for news. Once these triggers are set, the `allowedHours` check can be removed.

## 4. Adding images

The image functions from my previous answer still apply as they are: `extractImageCandidates`, `fetchImages`, `extractArticleWithImages` and `appendImagesToDoc`. What's missing is the glue function that `processDocQueue` calls:

```javascript
function processArticle_(doc, item, rawHtml, apiKey) {
  const cfg = SOURCE_CFG[item.source] || {}; // bodyStart / bodyEnd per source
  const cands = extractImageCandidates(rawHtml, item.url, cfg); // must run BEFORE cleanHtmlForAI
  const imgs = cands.length ? fetchImages(cands, item.url) : [];
  const text = cleanHtmlForAI(rawHtml);
  if (!text) throw new Error("Empty article body");

  const ai = extractArticleWithImages(text, imgs, item, apiKey); // one Gemini call for text and image selection
  if (!ai || !ai.fullText) throw new Error("Gemini returned no text"); // throw, don't return a placeholder

  const kept = (ai.images || [])
    .filter(
      (x) =>
        x.keep &&
        ["chart", "infographic", "table", "map"].includes(x.kind) &&
        imgs[x.index],
    )
    .map((x) => Object.assign({}, imgs[x.index], x));

  appendNewsToDoc(doc, item, ai.fullText, kept); // order: headline → summary box → images → full text → source
  return { imageCount: kept.length };
}
```

Three things to remember:

- **Extract image candidates from the raw HTML before calling `cleanHtmlForAI`**, because that function removes every tag.
- **Google Docs can't insert WebP images**, so add the fallback from my previous answer: ask for JPEG in the `Accept` header, or put a link in place of the image.
- **Roll out to 2–3 sources first** (e.g. Thansettakij and Bangkokbiznews, which use a lot of infographics) and set their `bodyStart`/`bodyEnd` markers before turning images on for every source.

## 5. Order of work for the developer

1. **Queue columns, `processDocQueue` and real triggers.** This fixes the lost-news bug, the most urgent item.
2. Make `fetchFullContentWithGemini` and `appendNewsToDoc` throw errors so the queue can retry, and add a per-article try/catch.
3. Use the original feed title for dedup, drop items with an unmatched `ref_id`, and classify in chunks of about 20.
4. Pin the current model name and throw an error if the property is empty. Add `fetchWithRetry` around every Gemini call.
5. Switch to `fetchAll` for feeds and articles, remove AllOrigins, and set the time zone in `appsscript.json`.
6. Add the image pipeline, starting with 2–3 sources.
7. Add a Config sheet, a RunLog sheet and alerts.

Steps 1–3 are the ones that affect data correctness, so do them first. If you send me 2–3 article HTML files (Ctrl+S from Thansettakij, Bangkokbiznews or Thairath), I can write accurate `bodyStart`/`bodyEnd` settings for each source and finish the `appendNewsToDoc` version with images.
