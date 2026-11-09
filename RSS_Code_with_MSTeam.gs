// ==========================================
// CONFIGURATION & PROPERTIES KEYS
// ==========================================
const PROP_API_KEY = "GEMINI_API_KEY";
const PROP_SHEET_ID = "SPREADSHEET_ID";
const PROP_SHEET_NAME = "SHEET_NAME"; // ชื่อ Tab ที่ต้องการเก็บ เช่น "RSS"
const PROP_MODEL_NAME = "GEMINI_MODEL_NAME"; // ชื่อโมเดลสำหรับคัดแยกและวิเคราะห์ข่าว
const PROP_EMAIL_RECIPIENT = "NOTIFICATION_EMAIL";
const PROP_TEAMS_WEBHOOK = "TEAMS_WEBHOOK_URL"; // Webhook URL สำหรับ MS Teams
const PROP_SCRAPER_KEY = "SCRAPER_API_KEY"; // API Key สำหรับ ScraperAPI (มติชน / ประชาชาติ)
const PROP_SCRAPER_KEY_BACKUP = "SCRAPER_API_KEY_BACKUP"; // API Key สำรองสำหรับ ScraperAPI (กรณีคีย์หลักเครดิตเต็ม)
const PROP_DRIVE_FOLDER = "DRIVE_FOLDER_ID"; // Folder ID ของ Google Drive ที่จะเก็บเล่มรายงาน Google Doc

// ==========================================================================
// CUSTOMIZABLE PARAMETERS (ส่วนสำหรับเพิ่มคำค้นหา/หัวข้อเป้าหมายข่าวเกษตรกรรม)
// ==========================================================================

// 1. คีย์เวิร์ดสำหรับคัดกรองข่าวขั้นต้นใน Apps Script (เพื่อประหยัดโควตา AI)
const FILTER_KEYWORDS = [
  // สินค้าเกษตร
  "ข้าว",
  "ข้าวเปลือก",
  "ข้าวสาร",
  "ราคาข้าว",
  "ส่งออกข้าว",
  "ผลผลิตข้าว",
  "กรมการข้าว",
  "ข้าวโพด",
  "มันสำปะหลัง",
  "ข้าวสาลี",
  "อาหารสัตว์",
  "รำข้าว",
  "วัตถุดิบอาหารสัตว์",
  "มันเส้น",
  "มันฝาน",
  "มันสำปะหลังเส้น",

  // นโยบายและการเงิน
  "เกษตร",
  "เกษตรกร",
  "ชาวนา",
  "ชาวสวน",
  "ธ.ก.ส.",
  "ปุ๋ย",
  "เพาะปลูก",
  "พืชผล",
  "พยุงราคา",
  "เงินชดเชย",
  "เงินสนับสนุน",
  "ชะลอสินเชื่อ",
  "กีดกันการค้า",
  "ภาษีนำเข้า",
  "ภาษีส่งออก",
  "มาตรการทางการค้า",
  "สต็อกสินค้า",
  "นำเข้า",
  "ส่งออก",

  // ภัยพิบัติและสถานการณ์โลก
  "ภัยแล้ง",
  "น้ำท่วม",
  "เอลนีโญ",
  "ลานีญา",
  "สงคราม",
  "โลจิสติกส์",
  "ขนส่ง",
  "ค่าระวาง",
];

// 2. รายชื่อสินค้าเกษตรที่ให้ AI สกัด (ใช้ประกอบใน System Prompt อัตโนมัติ)
const TARGET_PRODUCTS = [
  "ข้าว (Rice / Paddy / Brown Rice / White Rice / Parboiled Rice) - เฉพาะข้าวเปลือก ข้าวสาร และห่วงโซ่อุปทานข้าวทางการเกษตร",
  "ข้าวโพด (Corn / Maize)",
  "มันสำปะหลัง หรือผลิตภัณฑ์มันสำปะหลัง (Cassava / Tapioca / Cassava Chips)",
  "ข้าวสาลี (Wheat)",
  "อาหารสัตว์ และ รำข้าว (Animal Feed / Rice Bran / Raw Materials for Feed)",
];

// 3. หัวข้อข่าวเชิงลึกที่ให้ AI สกัด (ใช้ประกอบใน System Prompt อัตโนมัติ)
const TARGET_THEMES = [
  "นโยบายการค้า (มาตรการทางการค้า, อัตราภาษีนำเข้า-ส่งออก, การกีดกันการค้า)",
  "ระดับสต็อกสินค้าเกษตรประเภทต่างๆ ทั้งภายในประเทศและตลาดโลก",
  "สถิติและแนวโน้มการนำเข้า-ส่งออกสินค้าเกษตร",
  "การขนส่ง โลจิสติกส์ และอัตราค่าระวางเรือสินค้าเกษตร",
  "นโยบายรัฐบาล (เช่น โครงการพยุงราคา, การจ่ายเงินชดเชย, เงินสนับสนุนช่วยเหลือ, มาตรการชะลอสินเชื่อ)",
  "ผลกระทบของสงครามและสถานการณ์การเมืองระหว่างประเทศที่มีต่อสินค้าเกษตรและวัตถุดิบอาหารสัตว์",
];

// ==========================================
// 1. ฟังก์ชันหลักสำหรับเริ่มทำงานดึงข่าวผ่าน RSS & Sitemap
// ==========================================
function startRssNewsAgent(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    Logger.log(
      "WARNING: ข้ามการทำงานรอบนี้ เนื่องจากมีอินสแตนซ์ของ startRssNewsAgent กำลังทำงานอยู่",
    );
    return;
  }

  try {
    const p = PropertiesService.getScriptProperties();
    const apiKey = p.getProperty(PROP_API_KEY);

    if (!apiKey) {
      Logger.log(
        "ERROR: กรุณาตั้งค่า GEMINI_API_KEY ใน Script Properties ก่อน",
      );
      return;
    }

    // ตรวจเช็คเวลารัน (Allowed Hours Guard Clause) เฉพาะเมื่อรันผ่านทริกเกอร์อัตโนมัติเท่านั้น
    // เพื่อเปิดทางให้ยังสามารถกดปุ่ม Run เพื่อทดสอบแมนนวลด้วยตนเองได้ทุกเมื่อ
    if (e) {
      const now = new Date();
      const currentHour = parseInt(
        Utilities.formatDate(now, "Asia/Bangkok", "H"),
        10,
      );
      const allowedHours = [6, 9, 12, 15, 18];

      if (!allowedHours.includes(currentHour)) {
        Logger.log(
          `Skipping execution: Current hour (${currentHour}) is not in the allowed schedule [6, 9, 12, 15, 18].`,
        );
        return;
      }
    }

    // เตรียม Google Sheet และ Folder ID สำหรับบันทึกข้อมูลและรายงาน
    let sheet;
    const sheetId = p.getProperty(PROP_SHEET_ID);
    const sheetName = p.getProperty(PROP_SHEET_NAME) || "RSS";
    const folderId = p.getProperty(PROP_DRIVE_FOLDER);
    try {
      if (sheetId) {
        sheet = SpreadsheetApp.openById(sheetId).getSheetByName(sheetName);
      } else {
        sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
      }
    } catch (sheetErr) {
      Logger.log(
        "WARNING: ไม่สามารถเปิด Google Sheet ได้: " + sheetErr.toString(),
      );
    }

    // รายการสำนักข่าวเป้าหมาย (รวมทั้งสิ้น 8 สำนักข่าวตามเอกสาร README)
    const feeds = [
      {
        name: "ผู้จัดการออนไลน์",
        url: "https://mgronline.com/store/rss/index.xml",
        type: "rss",
      },
      { name: "แนวหน้า", url: "https://www.naewna.com/n/feed/", type: "rss" },
      {
        name: "ไทยรัฐ",
        url: "https://www.thairath.co.th/sitemap-daily.xml",
        type: "thairath_sitemap",
      },
      {
        name: "โพสต์ทูเดย์",
        url: "https://api.posttoday.com/sitemap/latest",
        type: "news_sitemap",
      },
      {
        name: "ฐานเศรษฐกิจ",
        url: "https://api.thansettakij.com/sitemap/latest",
        type: "news_sitemap",
      },
      {
        name: "กรุงเทพธุรกิจ",
        url: "https://api.bangkokbiznews.com/sitemap/latest",
        type: "news_sitemap",
      },
      {
        name: "มติชน",
        url: "https://www.matichon.co.th/sitemap-news.xml",
        type: "news_sitemap",
      },
      {
        name: "ประชาชาติธุรกิจ",
        url: "https://www.prachachat.net/feed",
        type: "rss",
      },
    ];

    let allArticles = [];

    // ดึงข้อมูลและพาร์สทีละ Feed
    feeds.forEach((feed) => {
      try {
        Logger.log(`Fetching feed: ${feed.name} (${feed.url})...`);
        const xmlString = fetchXml(feed.url, true);

        let parsed = [];
        if (feed.type === "rss") {
          parsed = parseRssFeed(xmlString, feed.name);
        } else if (feed.type === "thairath_sitemap") {
          parsed = parseThairathSitemap(xmlString);
        } else if (feed.type === "news_sitemap") {
          parsed = parseNewsSitemap(xmlString, feed.name);
        }

        Logger.log(
          `Successfully parsed ${parsed.length} items from ${feed.name}`,
        );
        allArticles = allArticles.concat(parsed);
      } catch (e) {
        Logger.log(`ERROR fetching/parsing ${feed.name}: ${e.toString()}`);
      }
    });

    if (allArticles.length === 0) {
      Logger.log(
        "No articles retrieved from any feeds. Checking for pending doc queue...",
      );
      if (sheet) processPendingDocQueue(sheet, apiKey, folderId);
      return;
    }

    // 1. กรองเฉพาะข่าวที่เผยแพร่ภายใน 24 ชั่วโมงย้อนหลัง
    const currentArticles = allArticles.filter((item) =>
      isWithinLast24Hours(item.pubDate),
    );
    Logger.log(
      `Articles published in the last 24 hours: ${currentArticles.length} items.`,
    );

    if (currentArticles.length === 0) {
      Logger.log(
        "No articles published in the last 24 hours. Checking for pending doc queue...",
      );
      if (sheet) processPendingDocQueue(sheet, apiKey, folderId);
      return;
    }

    // 2. ดึงประวัติเพื่อทำ Pre-Deduplication (กรองออกล่วงหน้าก่อนประมวลผลคำค้นหาและส่งให้ AI)
    let uniqueArticles = currentArticles;
    let existingKeys = null;
    if (sheet) {
      existingKeys = getExistingNewsKeys(sheet);
      uniqueArticles = currentArticles.filter((item) => {
        const urlKey = (item.link || "").toString().trim().toLowerCase();
        const headlineKey = (item.title || "").toString().trim().toLowerCase();

        if (urlKey && existingKeys.existingUrls.has(urlKey)) return false;
        if (headlineKey && existingKeys.existingHeadlines.has(headlineKey))
          return false;
        return true;
      });
      Logger.log(
        `Articles after Pre-Deduplication (unprocessed news only): ${uniqueArticles.length} items.`,
      );
    }

    if (uniqueArticles.length === 0) {
      Logger.log(
        "All articles in this run are already processed in the history. Checking for pending doc queue...",
      );
      if (sheet) processPendingDocQueue(sheet, apiKey, folderId);
      return;
    }

    // 3. กรองหัวข้อข่าวขั้นต้นด้วย Keywords ที่เกี่ยวข้องกับข้าวและการเกษตร (พร้อม Negative Filtering)
    const candidates = filterByKeywords(uniqueArticles);
    Logger.log(
      `Candidate articles after keyword filtering: ${candidates.length} items.`,
    );

    if (candidates.length === 0) {
      Logger.log(
        "No new agricultural candidate news found after keyword filtering. Checking for pending doc queue...",
      );
      if (sheet) processPendingDocQueue(sheet, apiKey, folderId);
      return;
    }

    // ผูก ref_id เข้าไปกับข่าวแต่ละชิ้น เพื่อให้อ้างอิงกลับคืนได้แม่นยำ 100% ป้องกันวันที่และ URL เพี้ยน
    const candidatesWithId = candidates.map((c, idx) => ({
      ref_id: idx,
      title: c.title,
      description: c.description,
      source: c.source,
      link: c.link,
    }));

    // 4. ส่งข่าวที่ผ่านการกรองขั้นต้นไปให้ Gemini เพื่อวิเคราะห์และแปลงเป็น JSON ภาษาไทย
    // พร้อมส่งรายการพาดหัวข่าวในประวัติล่าสุด (recentHeadlines) เพื่อทำ Cross-Run Semantic Deduplication
    Logger.log(
      "Sending candidates to Gemini for final classification and extraction...",
    );
    try {
      const recentHeadlines = existingKeys
        ? existingKeys.recentHeadlines || []
        : [];
      const jsonArray = parseCandidatesWithGemini(
        candidatesWithId,
        apiKey,
        recentHeadlines,
      );

      // ดึงเวลาเผยแพร่ข่าวและ URL ที่แท้จริงจากสำนักข่าวต้นฉบับ เพื่อความแม่นยำ 100%
      if (jsonArray && jsonArray.length > 0) {
        jsonArray.forEach((newsItem) => {
          let match = null;
          if (
            typeof newsItem.ref_id === "number" &&
            candidates[newsItem.ref_id]
          ) {
            match = candidates[newsItem.ref_id];
          } else {
            const urlKey = (newsItem.url || "").toString().trim().toLowerCase();
            const headlineKey = (newsItem.headline || "")
              .toString()
              .trim()
              .toLowerCase();
            match = candidates.find((c) => {
              const cUrl = (c.link || "").toString().trim().toLowerCase();
              const cTitle = (c.title || "").toString().trim().toLowerCase();
              return (
                (urlKey && cUrl === urlKey) ||
                (headlineKey && cTitle === headlineKey)
              );
            });
          }

          if (match) {
            newsItem.url = match.link;
            newsItem.source = match.source || newsItem.source;
            if (match.pubDate) {
              newsItem.publish_date = Utilities.formatDate(
                match.pubDate,
                "Asia/Bangkok",
                "yyyy-MM-dd HH:mm น.",
              );
            } else {
              newsItem.publish_date = "ไม่ระบุวันเผยแพร่";
            }
          } else {
            newsItem.publish_date = "ไม่ระบุวันเผยแพร่";
          }
        });
      }

      // 5. บันทึกผลลัพธ์ลง Google Sheet แบบ Batch Append (บันทึกสถานะ Pending เพื่อรอลง Doc)
      const newItems = saveJsonToSheet(jsonArray, sheet, existingKeys);

      // 6. ประมวลผลคิวข่าวที่รอลง Google Doc (ดึงทั้งข่าวใหม่และข่าวตกค้างที่ค้างสถานะ Pending)
      let docUrl = "";
      if (sheet) {
        docUrl = processPendingDocQueue(sheet, apiKey, folderId, 15);
      }

      // 7. ส่งการแจ้งเตือนเฉพาะเมื่อมีข่าวใหม่ในรอบนี้ (พร้อมแนบลิงก์ Google Doc)
      if (newItems && newItems.length > 0) {
        sendEmailNotification(newItems, docUrl); // ส่งแจ้งเตือนผ่าน E-mail
        sendTeamsNotification(newItems, docUrl); // ส่งแจ้งเตือนผ่าน MS Teams
      } else {
        Logger.log("No new news items to notify in this cycle.");
      }
    } catch (error) {
      Logger.log(
        "Exception in startRssNewsAgent processing: " + error.toString(),
      );
    }
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// 2. ฟังก์ชันพาร์สและกรองรูปแบบข้อมูลต่างๆ
// ==========================================

// ฟังก์ชันดึง XML/HTML พร้อมจำลอง User-Agent เพื่อป้องกัน Error 403 (โดยล้าง Entity เฉพาะเมื่อเป็นไฟล์ XML)
function fetchXml(url, isXml = true) {
  const p = PropertiesService.getScriptProperties();
  const scraperApiKey = p.getProperty(PROP_SCRAPER_KEY);
  const backupApiKey = p.getProperty(PROP_SCRAPER_KEY_BACKUP);

  // ตรวจจับว่าต้องใช้ Proxy ทันทีหรือไม่ (เฉพาะประชาชาติธุรกิจและมติชนที่ติด Cloudflare / 403)
  const isBlockedSite =
    url.includes("matichon.co.th") || url.includes("prachachat.net");

  // 1. สำหรับเว็บทั่วไปที่ไม่ติดบล็อก Cloudflare ให้ลองดึงตรงๆ ก่อน
  if (!isBlockedSite) {
    try {
      const response = UrlFetchApp.fetch(url, {
        method: "get",
        muteHttpExceptions: true,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: isXml
            ? "text/xml, application/xml, application/xhtml+xml, text/html"
            : "text/html, application/xhtml+xml, */*",
        },
      });
      if (response.getResponseCode() === 200) {
        const text = response.getContentText();
        return isXml ? sanitizeXmlEntities(text) : text;
      }
      Logger.log(
        `Direct fetch for ${url} returned status ${response.getResponseCode()}. Trying ScraperAPI proxy...`,
      );
    } catch (e) {
      Logger.log(
        `Direct fetch failed for ${url}: ${e.toString()}. Trying ScraperAPI proxy...`,
      );
    }
  }

  // 2. สำหรับเว็บที่ติด Cloudflare (เช่น ประชาชาติธุรกิจ, มติชน) หรือกรณีดึงตรงล้มเหลว
  // ให้วิ่งตรงเข้า ScraperAPI ทันที (รวดเร็ว ปลอดภัย และ Bypass Cloudflare ได้อย่างแน่นอน)
  if (scraperApiKey) {
    try {
      const scraperUrl =
        "https://api.scraperapi.com?api_key=" +
        scraperApiKey +
        "&url=" +
        encodeURIComponent(url);
      Logger.log("Fetching via Primary ScraperAPI Proxy for: " + url);

      const response = UrlFetchApp.fetch(scraperUrl, {
        method: "get",
        muteHttpExceptions: true,
      });
      const code = response.getResponseCode();
      if (code === 200) {
        const text = response.getContentText();
        return isXml ? sanitizeXmlEntities(text) : text;
      }
      Logger.log(
        `Primary ScraperAPI returned HTTP code ${code} for ${url}. Trying backup key...`,
      );
    } catch (e) {
      Logger.log(
        `Primary ScraperAPI request failed: ${e.toString()}. Trying backup key...`,
      );
    }
  }

  // 3. ลองใช้ ScraperAPI คีย์สำรอง (Backup Key) หากคีย์หลักล้มเหลว
  if (backupApiKey) {
    try {
      const scraperUrl =
        "https://api.scraperapi.com?api_key=" +
        backupApiKey +
        "&url=" +
        encodeURIComponent(url);
      Logger.log("Fetching via Backup ScraperAPI Proxy for: " + url);

      const response = UrlFetchApp.fetch(scraperUrl, {
        method: "get",
        muteHttpExceptions: true,
      });
      const code = response.getResponseCode();
      if (code === 200) {
        const text = response.getContentText();
        return isXml ? sanitizeXmlEntities(text) : text;
      }
      throw new Error(`Backup ScraperAPI returned HTTP code ${code}`);
    } catch (e) {
      throw new Error(
        `Both Primary and Backup ScraperAPI failed for ${url}. Last error: ${e.toString()}`,
      );
    }
  }

  throw new Error(
    "Failed to fetch content for " +
      url +
      " (No working scraper API key available)",
  );
}

// ฟังก์ชันดึงหน้า HTML ของบทความหลายข่าวพร้อมกันแบบคู่ขนาน (Parallel Fetch) ด้วย UrlFetchApp.fetchAll
function fetchArticlesParallel(urls) {
  if (!urls || urls.length === 0) return [];

  const p = PropertiesService.getScriptProperties();
  const scraperApiKey = p.getProperty(PROP_SCRAPER_KEY);

  const reqs = urls.map((u) => {
    // หากเป็นเว็บที่ติดบล็อก Cloudflare แน่นอน (มติชน/ประชาชาติ) ให้เข้า ScraperAPI ตั้งแต่แรกในโหมด Parallel เลย
    const isBlocked =
      u.includes("matichon.co.th") || u.includes("prachachat.net");
    const targetUrl =
      isBlocked && scraperApiKey
        ? "https://api.scraperapi.com?api_key=" +
          scraperApiKey +
          "&url=" +
          encodeURIComponent(u)
        : u;

    return {
      url: targetUrl,
      method: "get",
      muteHttpExceptions: true,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    };
  });

  try {
    const responses = UrlFetchApp.fetchAll(reqs);
    return responses.map((resp, i) => {
      if (resp && resp.getResponseCode() === 200) {
        return resp.getContentText();
      }
      // หากดึงตรงแบบขนานไม่สำเร็จในบางเว็บ ให้ลองดึงเดี่ยวผ่าน fetchXml(..., false)
      try {
        return fetchXml(urls[i], false);
      } catch (err) {
        Logger.log(`Failed individual fallback fetch for: ${urls[i]}`);
        return null;
      }
    });
  } catch (e) {
    Logger.log(
      "Parallel fetch encountered error: " +
        e.toString() +
        ". Falling back to individual fetching...",
    );
    return urls.map((u) => {
      try {
        return fetchXml(u, false);
      } catch (err) {
        return null;
      }
    });
  }
}

// ฟังก์ชันสำหรับแทนที่ HTML Entity ที่ไม่ใช่ XML Entity มาตรฐาน และแปลง Unescaped & ป้องกัน XmlService พัง
function sanitizeXmlEntities(xmlString) {
  if (!xmlString) return "";

  const entityMap = {
    nbsp: " ",
    hellip: "...",
    copy: "(c)",
    reg: "(r)",
    trade: "(tm)",
    ldquo: '"',
    rdquo: '"',
    lsquo: "'",
    rsquo: "'",
    ndash: "-",
    mdash: "--",
    middot: "·",
    bull: "•",
    cent: "¢",
    pound: "£",
    yen: "¥",
    euro: "€",
    para: "¶",
    sect: "§",
  };

  let cleaned = xmlString.replace(/&([a-zA-Z0-9]+);/g, function (match, name) {
    const lowerName = name.toLowerCase();
    // ถ้าเป็น XML Entity มาตรฐาน 5 ตัว ให้คงไว้
    if (["amp", "lt", "gt", "quot", "apos"].includes(lowerName)) {
      return match;
    }
    // ถ้ามีในแผนผังตัวแทนที่กำหนด ให้เลือกใช้ค่าใน Map
    if (entityMap[lowerName] !== undefined) {
      return entityMap[lowerName];
    }
    // ถ้าไม่มี ให้แทนที่ด้วยช่องว่างเพื่อป้องกันการพาร์สพัง
    return " ";
  });

  // แปลงเครื่องหมาย & โดดเดี่ยวที่ไม่ได้เป็นส่วนหนึ่งของ XML entity หรือ numeric entity ให้เป็น &amp;
  cleaned = cleaned.replace(/&(?!(?:apos|quot|[gl]t|amp);|#)/gi, "&amp;");

  return cleaned;
}

// พาร์สข้อมูล RSS Feed
function parseRssFeed(xmlString, sourceName) {
  if (!xmlString || !xmlString.trim()) {
    Logger.log(`WARNING: Empty XML string received for ${sourceName}`);
    return [];
  }
  try {
    const document = XmlService.parse(xmlString);
    const root = document.getRootElement();
    const channel = root.getChild("channel");

    if (!channel) return [];

    const items = channel.getChildren("item");
    const parsedItems = [];

    items.forEach((item) => {
      const title = item.getChildText("title") || "";
      const link = item.getChildText("link") || "";
      const description = item.getChildText("description") || "";
      const pubDateStr = item.getChildText("pubDate") || "";

      // ลบ HTML tag ใน description
      const cleanDesc = description.replace(/<[^>]*>/g, "").trim();
      const pubDate = parseFeedDate(pubDateStr);

      parsedItems.push({
        title: title.trim(),
        link: link.trim(),
        description: cleanDesc,
        pubDate: pubDate,
        source: sourceName,
      });
    });

    return parsedItems;
  } catch (err) {
    Logger.log(`ERROR parsing RSS XML for ${sourceName}: ${err.toString()}`);
    return [];
  }
}

// พาร์สข้อมูล Sitemap ของไทยรัฐ (สกัดข่าวจากแท็ก image และดึง pubDate จาก lastmod)
function parseThairathSitemap(xmlString) {
  if (!xmlString || !xmlString.trim()) {
    Logger.log("WARNING: Empty XML string received for ไทยรัฐ");
    return [];
  }
  try {
    const document = XmlService.parse(xmlString);
    const root = document.getRootElement();
    const ns = XmlService.getNamespace(
      "http://www.sitemaps.org/schemas/sitemap/0.9",
    );
    const nsImage = XmlService.getNamespace(
      "image",
      "http://www.google.com/schemas/sitemap-image/1.1",
    );

    const urls = root.getChildren("url", ns);
    const items = [];

    urls.forEach((urlElement) => {
      const loc = urlElement.getChildText("loc", ns);
      const lastmodStr = urlElement.getChildText("lastmod", ns);
      const imageElement = urlElement.getChild("image", nsImage);
      let title = "";
      let description = "";
      if (imageElement) {
        title = imageElement.getChildText("title", nsImage) || "";
        description = imageElement.getChildText("caption", nsImage) || "";
      }

      if (title) {
        let pubDate = new Date();
        if (lastmodStr) {
          try {
            const parsed = new Date(lastmodStr);
            if (!isNaN(parsed.getTime())) {
              pubDate = parsed;
            }
          } catch (e) {
            Logger.log(`Error parsing Thairath lastmod: ${lastmodStr}`);
          }
        }

        items.push({
          title: title.trim(),
          link: (loc || "").trim(),
          description: description.trim(),
          pubDate: pubDate,
          source: "ไทยรัฐ",
        });
      }
    });
    return items;
  } catch (err) {
    Logger.log(`ERROR parsing Thairath Sitemap XML: ${err.toString()}`);
    return [];
  }
}

// พาร์สข้อมูล Google News Sitemap (โพสต์ทูเดย์, ฐานเศรษฐกิจ, กรุงเทพธุรกิจ, มติชน, ประชาชาติธุรกิจ)
function parseNewsSitemap(xmlString, sourceName) {
  if (!xmlString || !xmlString.trim()) {
    Logger.log(`WARNING: Empty XML string received for ${sourceName}`);
    return [];
  }
  try {
    const document = XmlService.parse(xmlString);
    const root = document.getRootElement();
    const ns = XmlService.getNamespace(
      "http://www.sitemaps.org/schemas/sitemap/0.9",
    );
    const nsNews = XmlService.getNamespace(
      "news",
      "http://www.google.com/schemas/sitemap-news/0.9",
    );
    const nsImage = XmlService.getNamespace(
      "image",
      "http://www.google.com/schemas/sitemap-image/1.1",
    );

    const urls = root.getChildren("url", ns);
    const items = [];

    urls.forEach((urlElement) => {
      const loc = urlElement.getChildText("loc", ns);
      const newsElement = urlElement.getChild("news", nsNews);

      let title = "";
      let pubDateStr = "";

      if (newsElement) {
        title = newsElement.getChildText("title", nsNews) || "";
        pubDateStr = newsElement.getChildText("publication_date", nsNews) || "";
      }

      // พยายามดึงภาพ / คำอธิบายภาพมาเป็น description เผื่อใช้สแกน Keyword กรองเบื้องต้น
      let description = "";
      const imageElement = urlElement.getChild("image", nsImage);
      if (imageElement) {
        description = imageElement.getChildText("caption", nsImage) || "";
      }

      if (title) {
        let pubDate = new Date();
        if (pubDateStr) {
          try {
            pubDate = new Date(pubDateStr);
          } catch (e) {
            Logger.log(`Error parsing news publication date: ${pubDateStr}`);
          }
        }

        items.push({
          title: title.trim(),
          link: (loc || "").trim(),
          description: description.trim(),
          pubDate: pubDate,
          source: sourceName,
        });
      }
    });
    return items;
  } catch (err) {
    Logger.log(
      `ERROR parsing News Sitemap XML for ${sourceName}: ${err.toString()}`,
    );
    return [];
  }
}

// พาร์สฟอร์แมตวันที่จากข้อความของ RSS Feed
function parseFeedDate(dateStr) {
  if (!dateStr) return null;

  // ทดลองแปลงตรงๆ
  let date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date;
  }

  // แปลงเฉพาะรูปแบบ YYYY-MM-DD HH:mm:ss ของแนวหน้า
  const regexYMDHMS = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/;
  const match = dateStr.trim().match(regexYMDHMS);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    const hour = parseInt(match[4], 10);
    const minute = parseInt(match[5], 10);
    const second = parseInt(match[6], 10);

    // ข้อมูลของแนวหน้าเป็นเวลาประเทศไทย (GMT+7)
    const utcTime = Date.UTC(year, month, day, hour, minute, second);
    return new Date(utcTime - 7 * 60 * 60 * 1000);
  }

  return null;
}

// กรองเฉพาะข่าวที่เผยแพร่ภายใน 24 ชั่วโมงย้อนหลังจากเวลาปัจจุบัน (เผื่อเวลานาฬิกาคลาดเคลื่อนล่วงหน้าได้ไม่เกิน 1 ชม.)
function isWithinLast24Hours(date) {
  if (!date) return false;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours >= -1 && diffHours <= 24;
}

// ตัวกรองคำค้นหา (Keyword Filter) เบื้องต้นเพื่อประหยัดโควตา AI พร้อมระบบคัดกรองคำเชิงลบ (Negative Filter)
function filterByKeywords(items) {
  // คำค้นหาเชิงลบที่บ่งบอกว่าไม่เกี่ยวกับสินค้าเกษตรเป้าหมายแน่นอน
  const NEGATIVE_KEYWORDS = [
    "ข้าวแกง",
    "อาหารตามสั่ง",
    "ร้านอาหาร",
    "กุ้งก้ามกราม",
    "บ่อกุ้ง",
    "เลี้ยงกุ้ง",
    "ฟาร์มกุ้ง",
    "ก๋วยเตี๋ยว",
    "อาหารจานด่วน",
    "ข้าวกล่อง",
  ];

  // คำที่ยืนยันว่าเป็นสินค้าเกษตรหลักจริง (หากมีคำเหล่านี้ ให้ส่งต่อให้ AI ตรวจสอบ)
  const STRONG_POSITIVE_KEYWORDS = [
    "ข้าวเปลือก",
    "ข้าวสาร",
    "ส่งออกข้าว",
    "ราคาข้าว",
    "โรงสี",
    "ชาวนา",
    "กรมการข้าว",
    "ข้าวโพด",
    "มันสำปะหลัง",
    "ข้าวสาลี",
    "อาหารสัตว์",
    "รำข้าว",
    "มันเส้น",
    "ปุ๋ย",
    "ธ.ก.ส.",
    "สต็อกข้าว",
  ];

  return items.filter((item) => {
    const textToSearch = (item.title + " " + item.description).toLowerCase();

    // ตรวจสอบว่ามี Negative Keyword หรือไม่
    const hasNegative = NEGATIVE_KEYWORDS.some((neg) =>
      textToSearch.includes(neg.toLowerCase()),
    );
    if (hasNegative) {
      const hasStrongPositive = STRONG_POSITIVE_KEYWORDS.some((pos) =>
        textToSearch.includes(pos.toLowerCase()),
      );
      if (!hasStrongPositive) {
        Logger.log(`Filtered out by negative keyword: ${item.title}`);
        return false;
      }
    }

    return FILTER_KEYWORDS.some((keyword) =>
      textToSearch.includes(keyword.toLowerCase()),
    );
  });
}

// ฟังก์ชันสร้าง System Prompt แบบไดนามิก พร้อมรองรับ Cross-Run Semantic Deduplication
function getSystemPrompt(recentHeadlines = []) {
  let crossRunDeduplicationSection = "";
  if (recentHeadlines && recentHeadlines.length > 0) {
    crossRunDeduplicationSection = `
# PREVIOUSLY REPORTED NEWS (CROSS-RUN DEDUPLICATION):
The following news stories have ALREADY been reported in previous runs within the last 24-48 hours:
${recentHeadlines
  .slice(-60)
  .map((h) => `- ${h}`)
  .join("\n")}

CRITICAL CROSS-RUN RULE:
- Do NOT extract any candidate news that covers the exact same event, policy announcement, press release, or situation as any of the previously reported news stories above. Even if reported by a different publisher or with different wording, if the underlying event is the same, DISCARD IT.
`;
  }

  return `
You are a professional agricultural data extraction assistant.
Your job is to analyze the provided list of Thai news articles and extract news related to specific agricultural products and themes.

# Target Agricultural Products:
${TARGET_PRODUCTS.map((p) => `- ${p}`).join("\n")}

# Target Themes:
${TARGET_THEMES.map((t) => `- ${t}`).join("\n")}

# Rules for Selection:
1. ONLY extract news that matches at least one of the Target Agricultural Products AND covers at least one of the Target Themes.
2. STRICT EXCLUSIONS:
   - EXCLUDE any news about "ข้าวแกง" (curry and rice), cooked meals, street food, restaurant food prices, meal subsidies, fast food, or buffets. The keyword "ข้าว" ONLY refers to agricultural commodities (paddy, milled rice, brown rice, planting, harvesting, agricultural trade, and supply chain).
   - EXCLUDE aquaculture, fishery, shrimp (กุ้ง), fish, crabs, or livestock farming UNLESS the article specifically and directly focuses on "Animal Feed Ingredients" (วัตถุดิบอาหารสัตว์ / รำข้าว / ข้าวโพดเลี้ยงสัตว์). Flooding of shrimp ponds or fishery complaints are strictly excluded.
   - EXCLUDE local charity, merit-making (ทำบุญ/ทำทาน), Buddhist ceremony sponsorships (เช่น วางศิลาฤกษ์, ทอดกฐิน, งานบวช), local community donations, private foundation handouts, or politician CSR/local public relations events where rice/agricultural products are given out as small-scale gifts or alms.
   - EXCLUDE general politics, crime news, traffic accidents in farming areas, or unrelated economic gossip.
3. ALLOWED EXCEPTIONS:
   - ALLOW government-to-government (G2G) trade/grants, bilateral/multilateral official humanitarian aid (เช่น รัฐบาลไทยส่งข้าวสารช่วยเหลือผู้ประสบภัยระดับประเทศหรือประเทศเพื่อนบ้าน เช่น สปป.ลาว), or official national-level agricultural emergency relief programs.
4. SEMANTIC DEDUPLICATION (WITHIN CURRENT BATCH):
   - If multiple candidate articles discuss the exact same event, announcement, policy, or press release (even if they are from different news sources or have slightly different headlines), you MUST choose only ONE representative article (preferably the one from the most reputable or detailed source, or the primary official announcer) and completely discard the other duplicate articles.
${crossRunDeduplicationSection}
5. If no articles match the criteria, return an empty array [].

# Extraction Fields Schema:
For each relevant news article, extract and return:
1. ref_id: (integer) The exact "ref_id" value provided in the candidate input item. MUST match the input item.
2. category: Choose one of "ราคาและการค้า", "นโยบายรัฐ", "คู่แข่งและตลาดโลก", "สภาพภูมิอากาศและผลผลิต"
3. source: The news source name in Thai (e.g. ผู้จัดการออนไลน์, ไทยรัฐ, แนวหน้า, โพสต์ทูเดย์, ฐานเศรษฐกิจ, กรุงเทพธุรกิจ, มติชน, ประชาชาติธุรกิจ)
4. headline: Headline of the news story translated or polished in Thai
5. summary: A concise summary of the story in Thai (3-4 lines) containing key facts
6. metrics: Key numbers/metrics mentioned in the story (e.g., price per ton, export quantities, budget amount) or "ไม่มี" if none
7. impact: Choose one of "High", "Medium", "Low" based on the impact on Thai agricultural exporters
8. url: The URL link associated with the story.

You must output ONLY a valid JSON array matching the schema:
[
  {
    "ref_id": 0,
    "category": "string",
    "source": "string",
    "headline": "string",
    "summary": "string",
    "metrics": "string",
    "impact": "string",
    "url": "string"
  }
]
`;
}

// ==========================================
// 3. ส่วนเชื่อมโยงไปยังโมเดลการวิเคราะห์ Gemini API
// ==========================================
function parseCandidatesWithGemini(candidates, apiKey, recentHeadlines = []) {
  const p = PropertiesService.getScriptProperties();
  const modelName = p.getProperty(PROP_MODEL_NAME) || "gemini-2.0-flash"; // gemini-2.0-flash (Free Tier: 1,500 RPD) หรือ gemini-1.5-flash
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;

  const systemPrompt = getSystemPrompt(recentHeadlines);

  const payload = {
    contents: [
      {
        parts: [
          { text: systemPrompt },
          {
            text:
              "Here is the list of news articles to analyze:\n" +
              JSON.stringify(candidates, null, 2),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: {
        type: "ARRAY",
        description: "List of relevant agricultural news items",
        items: {
          type: "OBJECT",
          properties: {
            ref_id: { type: "INTEGER" },
            category: {
              type: "STRING",
              enum: [
                "ราคาและการค้า",
                "นโยบายรัฐ",
                "คู่แข่งและตลาดโลก",
                "สภาพภูมิอากาศและผลผลิต",
              ],
            },
            source: { type: "STRING" },
            headline: { type: "STRING" },
            summary: { type: "STRING" },
            metrics: { type: "STRING" },
            impact: {
              type: "STRING",
              enum: ["High", "Medium", "Low"],
            },
            url: { type: "STRING" },
          },
          required: [
            "ref_id",
            "category",
            "source",
            "headline",
            "summary",
            "metrics",
            "impact",
            "url",
          ],
        },
      },
    },
  };

  const options = {
    method: "post",
    contentType: "application/json; charset=utf-8",
    headers: {
      "x-goog-api-key": apiKey,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseJson = JSON.parse(response.getContentText());

  if (
    responseJson.candidates &&
    responseJson.candidates[0].content.parts[0].text
  ) {
    const jsonText = responseJson.candidates[0].content.parts[0].text;
    return JSON.parse(jsonText);
  } else {
    throw new Error(
      "Failed to parse report with Gemini: " + response.getContentText(),
    );
  }
}

// ==========================================
// 4. บันทึกผลลัพธ์ลงในชีตชื่อ "RSS" และตรวจสอบข่าวซ้ำ (Batch Write)
// ==========================================
function saveJsonToSheet(jsonArray, sheetObj, existingKeys) {
  const p = PropertiesService.getScriptProperties();
  const sheetId = p.getProperty(PROP_SHEET_ID);
  const sheetName = p.getProperty(PROP_SHEET_NAME) || "RSS";

  let sheet = sheetObj;
  if (!sheet) {
    if (sheetId) {
      sheet = SpreadsheetApp.openById(sheetId).getSheetByName(sheetName);
    } else {
      sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    }
  }

  if (!sheet) {
    Logger.log(`ERROR: ไม่พบหน้าชีตชื่อ "${sheetName}"`);
    return [];
  }

  // หากเป็นหน้าชีตสร้างใหม่และไม่มีแถวข้อมูลเลย ให้พิมพ์หัวข้อคอลัมน์ (Headers) ก่อน (รวมคอลัมน์ที่ 10: Doc Status)
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Timestamp",
      "Date",
      "Category",
      "Source",
      "Headline",
      "Summary",
      "Key Data & Metrics",
      "Impact Level",
      "URL",
      "Doc Status",
    ]);
  } else if (sheet.getLastColumn() === 9) {
    // อัปเกรดชีตเดิมที่ยังไม่มีคอลัมน์ที่ 10 โดยเพิ่ม Header "Doc Status"
    try {
      sheet.getRange(1, 10).setValue("Doc Status");
    } catch (colErr) {
      Logger.log("Warning setting Doc Status header: " + colErr.toString());
    }
  }

  if (!jsonArray || jsonArray.length === 0) {
    Logger.log("No news data extracted from the feeds (empty array).");
    return [];
  }

  // 1. ดึงข้อมูลประวัติในชีตมาตรวจสอบการบันทึกซ้ำ
  let existingUrls = existingKeys ? existingKeys.existingUrls : null;
  let existingHeadlines = existingKeys ? existingKeys.existingHeadlines : null;

  if (!existingUrls || !existingHeadlines) {
    const keys = getExistingNewsKeys(sheet);
    existingUrls = keys.existingUrls;
    existingHeadlines = keys.existingHeadlines;
  }

  const timestamp = new Date();
  const newItems = [];
  const rowsToAdd = [];

  // 2. เปรียบเทียบข้อมูลและรวบรวมแถวข่าวใหม่
  jsonArray.forEach((news) => {
    const urlKey = (news.url || "").toString().trim().toLowerCase();
    const headlineKey = (news.headline || "").toString().trim().toLowerCase();

    let isDuplicate = false;
    if (urlKey) {
      if (existingUrls.has(urlKey)) {
        isDuplicate = true;
      }
    } else if (headlineKey) {
      if (existingHeadlines.has(headlineKey)) {
        isDuplicate = true;
      }
    }

    if (!isDuplicate) {
      rowsToAdd.push([
        timestamp,
        news.publish_date || "ไม่ระบุวันเผยแพร่",
        news.category || "ราคาและการค้า",
        news.source || "ไม่ระบุแหล่งข่าว",
        news.headline || "ไม่มีหัวข้อข่าว",
        news.summary || "ไม่มีสรุปเนื้อหา",
        news.metrics || "ไม่มี",
        news.impact || "Low",
        news.url || "",
        "Pending", // สถานะเริ่มต้นสำหรับคิวทำ Google Doc (ป้องกันข่าวหลุด)
      ]);
      newItems.push(news);

      if (urlKey) existingUrls.add(urlKey);
      if (headlineKey) existingHeadlines.add(headlineKey);
    } else {
      Logger.log(`Skipped duplicate news: ${news.headline}`);
    }
  });

  // 3. เขียนข้อมูลลง Google Sheet แบบชุดเดียว (Batch Write) ประหยัด I/O และทำงานเร็วขึ้น
  if (rowsToAdd.length > 0) {
    sheet
      .getRange(sheet.getLastRow() + 1, 1, rowsToAdd.length, 10)
      .setValues(rowsToAdd);
    Logger.log(
      `Batch saved ${rowsToAdd.length} new news items to Google Sheet with 'Pending' Doc status.`,
    );
  }

  return newItems;
}

// ค้นหาข่าวที่มีสถานะ "Pending" ในชีต เพื่อนำมาใส่ลงใน Google Doc (ดึงทั้งข่าวใหม่และข่าวตกค้างจากรอบก่อน)
function getPendingDocItems(sheet, limit = 15) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  // อ่านเฉพาะ 200 แถวล่าสุดเพื่อประสิทธิภาพสูงสุด
  const startRow = Math.max(2, lastRow - 199);
  const numRows = lastRow - startRow + 1;
  const numCols = Math.max(sheet.getLastColumn(), 10);
  const data = sheet.getRange(startRow, 1, numRows, numCols).getValues();

  const pendingItems = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNumber = startRow + i;
    const docStatus = (row[9] || "").toString().trim(); // คอลัมน์ J (Doc Status)

    if (docStatus === "Pending") {
      pendingItems.push({
        rowNumber: rowNumber,
        timestamp: row[0],
        publish_date: row[1],
        category: row[2],
        source: row[3],
        headline: row[4],
        summary: row[5],
        metrics: row[6],
        impact: row[7],
        url: row[8],
      });
      if (pendingItems.length >= limit) break;
    }
  }
  return pendingItems;
}

// อัปเดตสถานะการนำข่าวลง Google Doc (Completed / Error) ในแถวที่ระบุ
function updateDocStatus(sheet, rowNumber, status) {
  try {
    sheet.getRange(rowNumber, 10).setValue(status);
  } catch (e) {
    Logger.log(
      `ERROR updating Doc Status for row ${rowNumber}: ${e.toString()}`,
    );
  }
}

// ฟังก์ชันสำหรับประมวลผลคิวข่าวสถานะ "Pending" ลง Google Doc (พร้อมสกัดเนื้อหา ภาพกราฟิก และแปลง WebP)
function processPendingDocQueue(sheet, apiKey, folderId, maxItems = 15) {
  if (!sheet) return "";

  const pendingDocItems = getPendingDocItems(sheet, maxItems);
  if (!pendingDocItems || pendingDocItems.length === 0) {
    Logger.log("No pending news items waiting for Google Doc synthesis.");
    return "";
  }

  let docUrl = "";
  try {
    const doc = getOrCreateDailyDoc(folderId);
    const startTime = new Date().getTime();
    const MAX_PROCESSING_TIME_MS = 4.5 * 60 * 1000;

    Logger.log(
      `Processing ${pendingDocItems.length} pending items into Google Doc...`,
    );

    // ดึง HTML ของทุกข่าวพร้อมกันแบบคู่ขนาน (Parallel Fetch)
    const targetUrls = pendingDocItems.map((it) => it.url);
    const htmlContents = fetchArticlesParallel(targetUrls);

    for (let i = 0; i < pendingDocItems.length; i++) {
      const item = pendingDocItems[i];
      if (new Date().getTime() - startTime > MAX_PROCESSING_TIME_MS) {
        Logger.log(
          `WARNING: เวลาประมวลผลใกล้ถึงขีดจำกัด (4.5 นาที) ระบบจะปิดบันทึก Google Doc ทันที (ข่าวที่เหลือ ${pendingDocItems.length - i} ข่าวจะคงสถานะ Pending ไว้รอรอบถัดไป)`,
        );
        break;
      }

      if (item.url) {
        Logger.log(
          `Processing Google Doc content (${i + 1}/${pendingDocItems.length}) for: ${item.headline}`,
        );
        try {
          const htmlContent = htmlContents[i];
          const aiResult = fetchFullContentWithGemini(
            htmlContent || item.url,
            apiKey,
            item.url,
          );
          const fullText =
            typeof aiResult === "object" && aiResult.fullText
              ? aiResult.fullText
              : aiResult;
          const imageUrls =
            typeof aiResult === "object" && Array.isArray(aiResult.imageUrls)
              ? aiResult.imageUrls
              : [];

          // ดาวน์โหลดภาพประกอบ/อินโฟกราฟิก และแปลง WebP เป็น JPG ผ่าน wsrv.nl
          const imageBlobs = fetchArticleImages(
            htmlContent,
            item.url,
            imageUrls,
          );

          // แทรกลงใน Google Doc
          appendNewsToDoc(doc, item, fullText, imageBlobs);

          if (item.rowNumber) {
            const isFallback = fullText.includes("ไม่สามารถถอดรายละเอียดข่าวฉบับเต็ม");
            const finalStatus = isFallback ? "Completed (Summary Only)" : "Completed";
            updateDocStatus(sheet, item.rowNumber, finalStatus);
          }
        } catch (itemErr) {
          Logger.log(
            `ERROR processing article for Doc (${item.headline}): ${itemErr.toString()}`,
          );
          if (item.rowNumber) {
            updateDocStatus(sheet, item.rowNumber, "Error");
          }
        }
      }
    }

    docUrl = doc.getUrl();
    doc.saveAndClose();
    Logger.log(`Successfully updated Daily Google Doc: ${docUrl}`);
  } catch (docError) {
    Logger.log(
      "ERROR managing Google Doc daily report: " + docError.toString(),
    );
  }
  return docUrl;
}

// ดึงข้อมูลข่าวในชีตที่เคยบันทึกไว้ เพื่อใช้ทำ Pre-Deduplication และ Cross-Run Semantic Deduplication
function getExistingNewsKeys(sheet) {
  const lastRow = sheet.getLastRow();
  const existingUrls = new Set();
  const existingHeadlines = new Set();
  const recentHeadlines = [];

  if (lastRow > 1) {
    // แถวแรกเป็น Header
    const startRow = Math.max(2, lastRow - 999); // อ่านเฉพาะ 1,000 แถวล่าสุด เพื่อลด Overhead เมื่อตารางมีขนาดใหญ่
    const numRows = lastRow - startRow + 1;
    const numCols = Math.min(sheet.getLastColumn(), 10);
    const data = sheet.getRange(startRow, 1, numRows, numCols).getValues();
    const now = new Date().getTime();
    const msIn48Hours = 48 * 60 * 60 * 1000;

    for (let i = 0; i < data.length; i++) {
      const timestampVal = data[i][0]; // คอลัมน์ A (Timestamp)
      const headline = data[i][4]; // คอลัมน์ E (Headline)
      const url = data[i][8]; // คอลัมน์ I (URL)

      if (url) {
        existingUrls.add(url.toString().trim().toLowerCase());
      }
      if (headline) {
        const headlineStr = headline.toString().trim();
        existingHeadlines.add(headlineStr.toLowerCase());

        // รวบรวมรายการพาดหัวข่าวในรอบ 48 ชม. ล่าสุด เพื่อส่งให้ AI ทำ Cross-run Deduplication
        let isRecent = false;
        if (timestampVal instanceof Date && !isNaN(timestampVal.getTime())) {
          if (now - timestampVal.getTime() <= msIn48Hours) {
            isRecent = true;
          }
        } else if (i >= data.length - 50) {
          // Fallback กรณี timestamp ไม่ใช่ Date ให้เก็บ 50 ข่าวล่าสุด
          isRecent = true;
        }

        if (isRecent && headlineStr) {
          recentHeadlines.push(headlineStr);
        }
      }
    }
  }
  return { existingUrls, existingHeadlines, recentHeadlines };
}

// ==========================================
// 5. ส่งอีเมลแจ้งเตือนข่าวใหม่ล่าสุด (Email Notification)
// ==========================================
function sendEmailNotification(newItems, docUrl) {
  const p = PropertiesService.getScriptProperties();
  const recipient = (p.getProperty(PROP_EMAIL_RECIPIENT) || "").trim();

  if (!recipient) {
    Logger.log(
      "Email notification is disabled (NOTIFICATION_EMAIL is empty or not set).",
    );
    return;
  }

  let subject = `[ข่าวใหม่ - RSS] มีข่าวใหม่จำนวน ${newItems.length} รายการ`;

  let htmlBody = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #fcfcfc;">
      <h2 style="color: #2e7d32; border-bottom: 2px solid #2e7d32; padding-bottom: 10px; margin-top: 0;">📢 รายงานข่าวจาก RSS & Sitemap</h2>
      ${docUrl ? `<p style="margin: 15px 0; text-align: center;"><a href="${docUrl}" target="_blank" style="display: inline-block; background-color: #2e7d32; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 4px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">📄 เปิดอ่านเล่มรายงานประจำวัน (Google Doc)</a></p>` : ""}
      <p style="color: #555;">พบข่าวสารใหม่จากการสแกนเมื่อเวลา ${Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm")} น. รายละเอียดข่าวมีดังนี้:</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
  `;

  newItems.forEach((item, idx) => {
    htmlBody += `
      <div style="margin-bottom: 25px; padding: 15px; border-left: 4px solid #4caf50; background-color: #ffffff; border-radius: 0 4px 4px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <span style="display: inline-block; background-color: #e8f5e9; color: #2e7d32; font-size: 12px; font-weight: bold; padding: 3px 8px; border-radius: 4px; margin-bottom: 8px;">
          ${item.category || "ราคาและการค้า"}
        </span>
        <span style="font-size: 12px; color: #777; margin-left: 10px;">
          แหล่งข่าว: <strong>${item.source || "ไม่ระบุแหล่งข่าว"}</strong> | เผยแพร่: ${item.publish_date || "ไม่ระบุวันเผยแพร่"}
        </span>
        <h3 style="margin: 8px 0; color: #111; font-size: 16px;">${idx + 1}. ${item.headline || "ไม่มีหัวข้อข่าว"}</h3>
        <p style="margin: 8px 0; color: #444; font-size: 14px;">${item.summary || "ไม่มีสรุปเนื้อหา"}</p>
        ${item.metrics && item.metrics !== "ไม่มี" ? `<p style="margin: 8px 0; color: #e65100; font-size: 13px;">📊 <strong>ตัวเลขสำคัญ:</strong> ${item.metrics}</p>` : ""}
        <p style="margin: 8px 0; font-size: 13px;">🎯 <strong>ผลกระทบต่อผู้ส่งออกไทย:</strong> <span style="font-weight: bold; color: ${item.impact === "High" ? "#d32f2f" : item.impact === "Medium" ? "#f57c00" : "#388e3c"}">${item.impact || "Low"}</span></p>
        ${item.url ? `<p style="margin: 10px 0 0 0; font-size: 13px;"><a href="${item.url}" target="_blank" style="color: #1976d2; text-decoration: none; font-weight: bold;">🔗 อ่านข่าวต้นฉบับ</a></p>` : ""}
      </div>
    `;
  });

  htmlBody += `
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 11px; color: #888; text-align: center; margin-bottom: 0;">อีเมลฉบับนี้ส่งโดยระบบอัตโนมัติของ AI News Agent (RSS Version)</p>
    </div>
  `;

  try {
    MailApp.sendEmail({
      to: recipient,
      subject: subject,
      htmlBody: htmlBody,
    });
    Logger.log(
      "Email notification sent to " +
        recipient +
        " for " +
        newItems.length +
        " news items.",
    );
  } catch (e) {
    Logger.log("ERROR sending email: " + e.toString());
  }
}

// ==========================================
// 6. ส่งการแจ้งเตือนข่าวใหม่ล่าสุดไปยัง Microsoft Teams
// ==========================================
function sendTeamsNotification(newItems, docUrl) {
  const p = PropertiesService.getScriptProperties();
  const webhookUrl = p.getProperty(PROP_TEAMS_WEBHOOK);

  if (!webhookUrl) {
    Logger.log(
      "WARNING: ไม่พบค่า TEAMS_WEBHOOK_URL ใน Script Properties การข้ามการส่งแจ้งเตือน MS Teams",
    );
    return;
  }

  // สร้างโครงร่าง Adaptive Card
  const cardBody = [
    {
      type: "TextBlock",
      text: "📢 รายงานข่าวประจำวันล่าสุด (RSS & Sitemap)",
      weight: "Bolder",
      size: "Medium",
      color: "Good",
    },
    {
      type: "TextBlock",
      text: `พบข่าวสารใหม่ในระบบจำนวน ${newItems.length} รายการ ดังนี้:`,
      isSubtle: true,
      wrap: true,
    },
  ];

  const cardActions = [];

  // เพิ่มปุ่มเปิดเล่มรายงาน Google Doc เป็นอันดับแรก
  if (docUrl) {
    cardActions.push({
      type: "Action.OpenUrl",
      title: "📄 เปิดเล่มรายงานข่าวประจำวัน",
      url: docUrl,
    });
  }

  newItems.forEach((item, index) => {
    // เพิ่มข้อมูลข่าวแต่ละข่าวลงใน body
    cardBody.push({
      type: "TextBlock",
      text: `**${index + 1}. ${item.headline || "ไม่มีหัวข้อข่าว"}**`,
      wrap: true,
      weight: "Bolder",
      spacing: "Medium",
    });

    cardBody.push({
      type: "FactSet",
      facts: [
        { title: "แหล่งข่าว", value: item.source || "ไม่ระบุ" },
        { title: "วันที่", value: item.publish_date || "ไม่ระบุ" },
        { title: "หมวดหมู่", value: item.category || "ราคาและการค้า" },
        { title: "ผลกระทบ", value: item.impact || "Low" },
      ],
      spacing: "None",
    });

    // ถ้ามี URL ให้ทำปุ่มลิงก์เปิดข่าว (รองรับปุ่มได้สูงสุด 6 ปุ่มใน Teams)
    if (item.url && cardActions.length < 6) {
      cardActions.push({
        type: "Action.OpenUrl",
        title: `🔗 อ่านข่าวที่ ${index + 1}`,
        url: item.url,
      });
    }
  });

  const payload = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          type: "AdaptiveCard",
          body: cardBody,
          actions: cardActions,
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          version: "1.4",
        },
      },
    ],
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(webhookUrl, options);
    Logger.log(
      "MS Teams Notification sent. Response: " + response.getContentText(),
    );
  } catch (e) {
    Logger.log("ERROR sending MS Teams notification: " + e.toString());
  }
}

// ==========================================
// 7. ระบบจัดทำเล่มรายงานข่าวสรุปรายวันบน Google Doc (Clean Layout ตามตัวอย่าง R_261015.doc)
// ==========================================

// ค้นหาหรือสร้างโฟลเดอร์เก็บรายงาน และสร้างหรือเปิดไฟล์ Google Doc ประจำวันสำหรับ Append ข้อมูลข่าว
function getOrCreateDailyDoc(folderId) {
  const today = new Date();
  const dateString = Utilities.formatDate(today, "Asia/Bangkok", "yyyy-MM-dd");
  const fileName = "รายงานข่าวประจำวัน " + dateString;

  // 1. ค้นหาโฟลเดอร์สำหรับเก็บรายงานประจำวัน
  let folder;
  if (folderId) {
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (e) {
      Logger.log(
        "WARNING: ไม่สามารถเข้าถึง DRIVE_FOLDER_ID ได้ ระบบจะใช้ Root โฟลเดอร์แทน. Error: " +
          e.toString(),
      );
      folder = DriveApp.getRootFolder();
    }
  } else {
    // หาโฟลเดอร์ "รายงานข่าวประจำวัน" ถ้าไม่มีให้สร้างใหม่ใน Root
    const folders = DriveApp.getFoldersByName("รายงานข่าวประจำวัน");
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder("รายงานข่าวประจำวัน");
    }
  }

  // 2. ค้นหาไฟล์รายงานของวันปัจจุบันในโฟลเดอร์
  const files = folder.getFilesByName(fileName);
  if (files.hasNext()) {
    const file = files.next();
    Logger.log("Opened existing Daily Doc: " + fileName);
    return DocumentApp.openById(file.getId());
  } else {
    // หากไม่พบ ให้สร้างเอกสารรายงานใหม่ของวันนี้
    Logger.log("Creating new Daily Doc: " + fileName);
    const doc = DocumentApp.create(fileName);
    const docFile = DriveApp.getFileById(doc.getId());

    // ย้ายตำแหน่งไฟล์ไปวางในโฟลเดอร์เป้าหมาย
    docFile.moveTo(folder);

    // จัดรูปแบบหน้าเอกสาร
    const body = doc.getBody();
    body.clear();

    // หน้าปกรวมหัวเรื่องตัวโต
    const titleParagraph = body.appendParagraph(
      "รายงานข่าวประจำวัน " + dateString,
    );
    titleParagraph.setHeading(DocumentApp.ParagraphHeading.TITLE);
    titleParagraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    styleParagraph(titleParagraph, "Cordia New", 24, "#000000", true, false);

    body.appendHorizontalRule();

    doc.saveAndClose();
    return DocumentApp.openById(doc.getId());
  }
}

// ทำความสะอาด HTML ดิบ และแปลงแท็ก <img> ที่มีประโยชน์ให้เป็น Marker [IMAGE_CANDIDATE] สำหรับส่งให้ AI คัดเลือก
function cleanHtmlForAI(html, baseUrl) {
  if (!html) return "";
  let text = html;

  // 1. ลบส่วนที่ไม่ใช่เนื้อหาข่าวออกทั้งหมด (script, style, svg, nav, header, footer, aside, noscript, iframe, form)
  text = text.replace(
    /<(script|style|svg|nav|header|footer|aside|noscript|iframe|form)[^>]*>[\s\S]*?<\/\1>/gi,
    "",
  );

  // 2. สกัดเอาเฉพาะใน body (ถ้ามี)
  const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    text = bodyMatch[1];
  }

  // หา Domain หลัก เผื่อแปลง Relative Image URL ให้เป็น Full Absolute URL
  let origin = "";
  if (baseUrl) {
    const originMatch = baseUrl.match(/^(https?:\/\/[^\/]+)/i);
    if (originMatch) origin = originMatch[1];
  }

  // 3. แปลงแท็ก <img> ให้เป็น Text Marker พร้อมดึงลิงก์จาก src, data-src, หรือ data-original (รองรับ Lazy Load)
  text = text.replace(/<img\s+[^>]*>/gi, function (imgTag) {
    // ข้ามรูปไอคอน โลโก้ แบนเนอร์ หรือตัวติดตามพิกเซล (ใช้ \bads?\b เพื่อไม่ให้ตัดคำว่า upload / uploads / lazyload ทิ้ง)
    if (
      /avatar|logo|icon|banner|\bads?\b|advertisement|sponsor|pixel|button|share|emoji|author|profile|sprite|placeholder|loading/i.test(
        imgTag,
      )
    ) {
      return "";
    }

    const srcMatch = imgTag.match(
      /(?:data-src|data-original|data-lazy-src|src)=["']([^"']+)["']/i,
    );
    const altMatch = imgTag.match(/alt=["']([^"']*)["']/i);

    if (srcMatch && srcMatch[1]) {
      let imgUrl = srcMatch[1].trim().replace(/&amp;/g, "&");
      if (
        imgUrl.startsWith("data:image") ||
        imgUrl.endsWith(".svg") ||
        imgUrl.endsWith(".gif")
      ) {
        return "";
      }

      // แปลง Relative URL เป็น Absolute URL
      if (imgUrl.startsWith("//")) {
        imgUrl = "https:" + imgUrl;
      } else if (imgUrl.startsWith("/") && origin) {
        imgUrl = origin + imgUrl;
      }

      const altText = altMatch ? altMatch[1].trim() : "";
      return `\n[IMAGE_CANDIDATE: ${imgUrl} | ALT: ${altText}]\n`;
    }
    return "";
  });

  // 4. แปลง closing tag ของย่อหน้า/บล็อก ให้เป็นขึ้นบรรทัดใหม่ แล้วลบ HTML Tags อื่นๆ ทั้งหมด
  text = text.replace(/<\/(p|div|h[1-6]|li|br|figure|figcaption)>/gi, "\n");
  text = text.replace(/<[^>]+>/g, " ");

  // 5. ล้างช่องว่างและบรรทัดว่างที่ซ้ำซ้อน
  text = text
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();

  // 6. ตัดความยาวสูงสุดที่ 45,000 ตัวอักษร
  if (text.length > 45000) {
    text = text.substring(0, 45000);
  }
  return text;
}

// ส่งเนื้อหาหน้าเว็บเต็มให้ Gemini สกัดเป็นบทความยาวภาษาไทยฉบับสมบูรณ์ พร้อมคัดเลือกภาพประกอบ/กราฟิก/ตาราง
function fetchFullContentWithGemini(htmlOrUrl, apiKey, urlForLog) {
  try {
    let rawHtml = htmlOrUrl;
    if (htmlOrUrl && htmlOrUrl.toString().trim().indexOf("http") === 0) {
      rawHtml = fetchXml(htmlOrUrl, false);
    }
    const cleanedText = cleanHtmlForAI(rawHtml, urlForLog);

    if (!cleanedText) {
      return {
        fullText: "ไม่สามารถดึงข้อมูลเนื้อหาหลักของข่าวได้",
        imageUrls: [],
      };
    }

    const p = PropertiesService.getScriptProperties();
    const modelName = p.getProperty(PROP_MODEL_NAME) || "gemini-2.0-flash";
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;

    const prompt = `
You are a news transcription and visual data extraction assistant.
Your job is to read the provided raw webpage content of a Thai news article (which includes [IMAGE_CANDIDATE: url | ALT: description] markers) and extract:
1. "full_text": The complete, detailed body text of the article in Thai (exclude ads, menus, related articles lists, sign-up forms, and reader comments, and REMOVE all [IMAGE_CANDIDATE] markers from the prose). Keep detailed reporting prose with clean Thai paragraph breaks. If there are subheadings in the article, format them with bold text (**Subheading**).
2. "content_images": An array of image URLs (maximum 3 images) selected ONLY from the [IMAGE_CANDIDATE] markers that appear inside the main article body and represent important news charts, graphs, data tables, or infographics summarizing key figures/statistics.
   - Strictly EXCLUDE site logos, author avatars, social media icons, ads, or thumbnails of other unrelated news articles.

Output ONLY valid JSON matching this schema:
{
  "full_text": "string",
  "content_images": ["string"]
}
`;

    const payload = {
      contents: [
        {
          parts: [
            { text: prompt },
            { text: "Here is the raw webpage text:\n" + cleanedText },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            full_text: { type: "STRING" },
            content_images: {
              type: "ARRAY",
              items: { type: "STRING" }
            }
          },
          required: ["full_text", "content_images"]
        }
      },
    };

    const options = {
      method: "post",
      contentType: "application/json; charset=utf-8",
      headers: {
        "x-goog-api-key": apiKey,
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(geminiUrl, options);
    const responseJson = JSON.parse(response.getContentText());

    if (
      responseJson.candidates &&
      responseJson.candidates[0].content.parts[0].text
    ) {
      const parsedResult = JSON.parse(
        responseJson.candidates[0].content.parts[0].text,
      );
      return {
        fullText: (parsedResult.full_text || "").trim(),
        imageUrls: Array.isArray(parsedResult.content_images)
          ? parsedResult.content_images
          : [],
      };
    }
  } catch (e) {
    Logger.log(
      "ERROR extracting full content with Gemini for " +
        (urlForLog || "unknown URL") +
        ": " +
        e.toString(),
    );
  }
  return {
    fullText: "ไม่สามารถถอดรายละเอียดข่าวฉบับเต็มโดย AI ได้",
    imageUrls: [],
  };
}

// ฟังก์ชันดาวน์โหลดและแปลงรูปภาพ (แปลง .webp เป็น .jpg ผ่าน wsrv.nl เพื่อให้ Google Docs รองรับ 100%)
function fetchArticleImages(html, articleUrl, aiSelectedUrls) {
  const imageUrls = new Set();

  // 1. ดึงภาพปกจาก og:image ก่อนเป็นภาพแรก (ถ้ามี)
  if (html) {
    const match1 = html.match(
      /meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
    );
    const match2 = html.match(
      /meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i,
    );
    const ogUrl =
      match1 && match1[1] ? match1[1] : match2 && match2[1] ? match2[1] : null;
    if (ogUrl && !ogUrl.startsWith("data:") && !ogUrl.includes(".svg")) {
      imageUrls.add(ogUrl.trim().replace(/&amp;/g, "&"));
    }
  }

  // 2. ผสานภาพกราฟ/อินโฟกราฟิกในเนื้อหาที่ AI คัดเลือกมา (รวมไม่เกิน 4 ภาพต่อข่าว)
  if (Array.isArray(aiSelectedUrls)) {
    aiSelectedUrls.forEach((u) => {
      if (u && imageUrls.size < 4) {
        imageUrls.add(u.trim().replace(/&amp;/g, "&"));
      }
    });
  }

  const urlList = Array.from(imageUrls);
  if (urlList.length === 0) return [];

  // เตรียมคำขอสำหรับดาวน์โหลดภาพแบบคู่ขนาน (Parallel Image Fetching)
  const reqs = urlList.map(rawUrl => {
    let fetchUrl = rawUrl;
    if (rawUrl.toLowerCase().includes(".webp") || rawUrl.toLowerCase().includes("format=webp")) {
      fetchUrl = "https://wsrv.nl/?url=" + encodeURIComponent(rawUrl) + "&output=jpg";
    }
    return {
      url: fetchUrl,
      method: "get",
      muteHttpExceptions: true,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        Referer: articleUrl || ""
      }
    };
  });

  const blobs = [];
  try {
    const responses = UrlFetchApp.fetchAll(reqs);
    responses.forEach((response, idx) => {
      if (response && response.getResponseCode() === 200) {
        let blob = response.getBlob();
        const contentType = (blob.getContentType() || "").toLowerCase();

        // หากต้นทางยังคืน Content-Type เป็น webp ให้ยิงผ่าน wsrv.nl ซ้ำ
        if (contentType.includes("webp")) {
          try {
            const rawUrl = urlList[idx];
            const proxyResp = UrlFetchApp.fetch(
              "https://wsrv.nl/?url=" + encodeURIComponent(rawUrl) + "&output=jpg",
              { muteHttpExceptions: true }
            );
            if (proxyResp.getResponseCode() === 200) {
              blob = proxyResp.getBlob();
            } else {
              return;
            }
          } catch (pErr) {
            return;
          }
        }

        // กรองขนาดไฟล์: ข้ามรูปที่มีขนาดเล็กกว่า 10 KB (ไอคอน หรือปุ่มแชร์ที่อาจหลุดรอดมา)
        if (blob.getBytes().length > 10240) {
          blobs.push(blob);
        }
      }
    });
  } catch (e) {
    Logger.log(`WARNING: ดาวน์โหลดภาพแบบขนานล้มเหลว: ${e.toString()}`);
  }

  return blobs;
}

// นำข่าว สรุปย่อ รูปภาพประกอบ และข่าวฉบับเต็มไปเขียนบันทึกใน Google Doc (คลีนตามแบบ R_261015.doc)
function appendNewsToDoc(doc, item, fullText, imageBlobs = []) {
  const body = doc.getBody();

  // 1. หัวข้อข่าวหลัก (Font: Cordia New, Size: 16, Bold)
  const heading = body.appendParagraph(item.headline || "ไม่มีหัวข้อข่าว");
  heading.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  styleParagraph(heading, "Cordia New", 16, "#000000", true, false);
  heading.setSpacingBefore(14);
  heading.setSpacingAfter(6);

  // 2. สรุปย่อโดย AI (จัดในกรอบข้อความ Callout Box แยกชัดเจนจากเนื้อหาข่าวจริง)
  if (item.summary && item.summary !== "ไม่มีสรุปเนื้อหา") {
    const table = body.appendTable();
    const row = table.appendTableRow();
    const cell = row.appendTableCell();

    // ตั้งค่าสไตล์กรอบข้อความ (เส้นขอบสีเทาอ่อน และพื้นหลังสีเทาอ่อนสว่างเพื่อความสบายตาและโดดเด่น)
    const tableAttrs = {};
    tableAttrs[DocumentApp.Attribute.BORDER_COLOR] = "#D0D7DE";
    tableAttrs[DocumentApp.Attribute.BORDER_WIDTH] = 1;
    table.setAttributes(tableAttrs);

    cell.setBackgroundColor("#F8F9FA");
    cell.setPaddingTop(8);
    cell.setPaddingBottom(8);
    cell.setPaddingLeft(14);
    cell.setPaddingRight(14);

    // หัวข้อภายในกรอบ Callout
    const summaryHeading = cell.getChild(0).asParagraph();
    summaryHeading.setText("สรุปสาระสำคัญโดย AI:");
    styleParagraph(summaryHeading, "Cordia New", 14, "#000000", true, false);
    summaryHeading.setSpacingAfter(4);

    // เนื้อหาสรุปย่อ
    const summaryParagraph = cell.appendParagraph(item.summary);
    styleParagraph(summaryParagraph, "Cordia New", 14, "#24292F", false, false);

    // ตัวเลขและสถิติสำคัญ (ถ้ามี)
    if (item.metrics && item.metrics !== "ไม่มี") {
      summaryParagraph.setSpacingAfter(4);
      const metricsParagraph = cell.appendParagraph(
        `ตัวเลขและสถิติสำคัญ: ${item.metrics}`,
      );
      styleParagraph(
        metricsParagraph,
        "Cordia New",
        14,
        "#000000",
        true,
        false,
      );
      metricsParagraph.setSpacingAfter(0);
    } else {
      summaryParagraph.setSpacingAfter(0);
    }
  }

  // 3. แทรกรูปภาพประกอบ ข้อมูลกราฟิก หรือตารางสถิติ (ถ้ามี)
  if (imageBlobs && imageBlobs.length > 0) {
    let headingAdded = false;
    imageBlobs.forEach((blob) => {
      try {
        const pImg = body.appendParagraph("");
        pImg.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
        const image = pImg.appendInlineImage(blob);

        if (!headingAdded) {
          const imgIndex = body.getChildIndex(pImg);
          const imgHeading = body.insertParagraph(
            imgIndex,
            `📸 ภาพประกอบและข้อมูลสถิติ/อินโฟกราฟิก (${imageBlobs.length} ภาพ):`,
          );
          styleParagraph(imgHeading, "Cordia New", 14, "#333333", true, false);
          imgHeading.setSpacingBefore(8);
          imgHeading.setSpacingAfter(4);
          headingAdded = true;
        }

        // ปรับขนาดภาพให้พอดีหน้ากระดาษ (สูงสุด 450px) โดยคงอัตราส่วนภาพไว้
        const originalWidth = image.getWidth();
        const originalHeight = image.getHeight();
        const maxWidth = 450;
        if (originalWidth > maxWidth) {
          const ratio = maxWidth / originalWidth;
          image.setWidth(maxWidth);
          image.setHeight(Math.round(originalHeight * ratio));
        }
        pImg.setSpacingBefore(4);
        pImg.setSpacingAfter(8);
      } catch (imgErr) {
        Logger.log(
          `WARNING: ไม่สามารถแทรกภาพลงใน Google Doc ได้: ${imgErr.toString()}`,
        );
      }
    });
  }

  // 4. บทความข่าวฉบับเต็ม จัดแยกเป็นย่อหน้าคลีนๆ (Cordia New, Size: 14)
  if (fullText && fullText !== "ไม่สามารถถอดรายละเอียดข่าวฉบับเต็มโดย AI ได้") {
    const paragraphs = fullText
      .split("\n")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    paragraphs.forEach((para, pIdx) => {
      // ตรวจสอบว่าพารากราฟเป็นหัวข้อย่อยหรือไม่ (เช่นขึ้นต้นด้วย ** หรือสั้นและเป็นหัวข้อ)
      const isSubheading =
        (para.startsWith("**") && para.endsWith("**")) ||
        para.startsWith("###") ||
        para.startsWith("##");
      // ล้างเครื่องหมาย Markdown (** และ #) ที่อาจหลงเหลือในข้อความออกทั้งหมดเพื่อความสะอาดตาของเอกสาร
      const cleanPara = para
        .replace(/^[*#\s]+|[*#\s]+$/g, "")
        .replace(/\*\*/g, "")
        .trim();
      if (cleanPara) {
        const pElem = body.appendParagraph(cleanPara);
        if (isSubheading) {
          styleParagraph(pElem, "Cordia New", 14, "#000000", true, false);
          pElem.setSpacingBefore(pIdx === 0 ? 10 : 6);
          pElem.setSpacingAfter(3);
        } else {
          styleParagraph(pElem, "Cordia New", 14, "#000000", false, false);
          pElem.setSpacingBefore(pIdx === 0 ? 10 : 0);
          pElem.setSpacingAfter(4);
        }
      }
    });
  } else {
    const fallbackPara = body.appendParagraph(
      item.summary || "ไม่สามารถแสดงรายละเอียดข่าวฉบับเต็มได้",
    );
    styleParagraph(fallbackPara, "Cordia New", 14, "#000000", false, false);
    fallbackPara.setSpacingBefore(10);
    fallbackPara.setSpacingAfter(6);
  }

  // 4. Source และ URL ใต้เนื้อหาข่าว คลีนแบบ R_261015.doc (เพิ่ม URL อีกบรรทัดใต้ Source)
  const sourceName = item.source || "ไม่ระบุ";
  const sourcePrefix =
    !sourceName.startsWith("หนังสือพิมพ์") &&
    !sourceName.startsWith("สำนักข่าว") &&
    !sourceName.includes("ออนไลน์")
      ? "หนังสือพิมพ์ "
      : "";
  const sourceText = `Source: ${sourcePrefix}${sourceName} วันที่ ${item.publish_date || "ไม่ระบุ"}`;

  const sourceParagraph = body.appendParagraph(sourceText);
  styleParagraph(sourceParagraph, "Cordia New", 14, "#000000", false, false);
  sourceParagraph.setSpacingBefore(8);
  sourceParagraph.setSpacingAfter(2);

  if (item.url) {
    const urlParagraph = body.appendParagraph(`URL: ${item.url}`);
    styleParagraph(urlParagraph, "Cordia New", 14, "#1976d2", false, false);
    try {
      urlParagraph.setLinkUrl(item.url);
    } catch (linkErr) {
      // Fallback
    }
    urlParagraph.setSpacingAfter(10);
  }

  // 5. เส้นคั่นระหว่างข่าว
  body.appendHorizontalRule();
}

// ฟังก์ชันเสริมสำหรับกำหนดรูปแบบข้อความ (Font, Size, Color, Weight, Style)
function styleParagraph(p, fontFamily, fontSize, color, isBold, isItalic) {
  p.setFontFamily(fontFamily || "Cordia New");
  p.setFontSize(fontSize || 14);
  p.setForegroundColor(color || "#000000");
  p.setBold(isBold === true);
  p.setItalic(isItalic === true);
  return p;
}
