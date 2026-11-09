I have reviewed the developer's latest updates. They made substantial progress by introducing a **Queue/Staged status column** in the sheet, implementing **`UrlFetchApp.fetchAll`** for parallel article fetching, and raising the per-run limit from 8 to 15 items.

The project currently sits at a **7.5 / 10** for production readiness.

---

### Project Score: 7.5 / 10

#### What Was Successfully Fixed (Why it's a 7.5):

1. **The Lost-News Bug is Solved:** By adding a `"Doc Status"` tracking mechanism (`Pending` → `Completed`/`Error`), news items that exceed the time limit are no longer abandoned or skipped forever; they will be picked up in subsequent runs.
2. **Parallel Performance (`fetchAll`):** Replacing sequential article fetching with `UrlFetchApp.fetchAll` drastically cuts down execution time, keeping it comfortably within Google Apps Script's timeout limits.
3. **Core Reliability:** Proper use of `LockService`, secure API key handling via headers (`x-goog-api-key`), and real feed publication dates are locked in.

#### What Still Needs Attention to Reach 10/10:

1. **Content Images & Infographics (Requested Feature):** The image extraction, filtering, WebP/binary handling, and Google Doc embedding pipeline have not been implemented yet (marked as a future phase). Remember to extract image candidates **before** running `cleanHtmlForAI`, which strips out all tags.
2. **AllOrigins Proxy:** The unencrypted third-party proxy is still present in `fetchXml`. It should be removed entirely in favor of direct fetch and ScraperAPI.
3. **Model Deprecation / Fallback:** Ensure your script property for the Gemini model name points to a current active flash model (e.g., `gemini-2.5-flash`), and make the code throw a hard error if the property is missing rather than relying on an outdated fallback.
4. **Timezone Configuration:** Ensure `"timeZone": "Asia/Bangkok"` is explicitly declared in `appsscript.json` to prevent edge-case timing mismatches with 24-hour filters.
