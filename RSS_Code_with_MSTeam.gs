// ==========================================
// CONFIGURATION & PROPERTIES KEYS
// ==========================================
const PROP_API_KEY = "GEMINI_API_KEY";
const PROP_SHEET_ID = "SPREADSHEET_ID";
const PROP_SHEET_NAME = "SHEET_NAME"; // ชื่อ Tab ที่ต้องการเก็บ เช่น "RSS"
const PROP_MODEL_NAME = "GEMINI_MODEL_NAME"; // ชื่อโมเดลสำหรับคัดแยกและวิเคราะห์ข่าว
const PROP_EMAIL_RECIPIENT = "NOTIFICATION_EMAIL";
const PROP_TEAMS_WEBHOOK = "TEAMS_WEBHOOK_URL"; // Webhook URL สำหรับ MS Teams
const PROP_SCRAPER_KEY = "SCRAPER_API_KEY";     // API Key สำหรับ ScraperAPI (มติชน / ประชาชาติ)
const PROP_DRIVE_FOLDER = "DRIVE_FOLDER_ID";    // Folder ID ของ Google Drive ที่จะเก็บเล่มรายงาน Google Doc

// ==========================================================================
// CUSTOMIZABLE PARAMETERS (ส่วนสำหรับเพิ่มคำค้นหา/หัวข้อเป้าหมายข่าวเกษตรกรรม)
// ==========================================================================

// 1. คีย์เวิร์ดสำหรับคัดกรองข่าวขั้นต้นใน Apps Script (เพื่อประหยัดโควตา AI)
const FILTER_KEYWORDS = [
  // สินค้าเกษตร
  "ข้าว", "ข้าวเปลือก", "ข้าวสาร", "ราคาข้าว", "ส่งออกข้าว", "ผลผลิตข้าว", "กรมการข้าว",
  "ข้าวโพด", "มันสำปะหลัง", "ข้าวสาลี", "อาหารสัตว์", "รำข้าว", "วัตถุดิบอาหารสัตว์", "มันเส้น", "มันฝาน", "มันสำปะหลังเส้น",
  
  // นโยบายและการเงิน
  "เกษตร", "เกษตรกร", "ชาวนา", "ชาวสวน", "ธ.ก.ส.", "ปุ๋ย", "เพาะปลูก", "พืชผล",
  "พยุงราคา", "เงินชดเชย", "เงินสนับสนุน", "ชะลอสินเชื่อ", "กีดกันการค้า", "ภาษีนำเข้า", 
  "ภาษีส่งออก", "มาตรการทางการค้า", "สต็อกสินค้า", "นำเข้า", "ส่งออก",
  
  // ภัยพิบัติและสถานการณ์โลก
  "ภัยแล้ง", "น้ำท่วม", "เอลนีโญ", "ลานีญา", "สงคราม", "โลจิสติกส์", "ขนส่ง", "ค่าระวาง"
];

// 2. รายชื่อสินค้าเกษตรที่ให้ AI สกัด (ใช้ประกอบใน System Prompt อัตโนมัติ)
const TARGET_PRODUCTS = [
  "ข้าว (Rice / Paddy / Brown Rice)",
  "ข้าวโพด (Corn / Maize)",
  "มันสำปะหลัง หรือผลิตภัณฑ์มันสำปะหลัง (Cassava / Tapioca / Cassava Chips)",
  "ข้าวสาลี (Wheat)",
  "อาหารสัตว์ และ รำข้าว (Animal Feed / Rice Bran / Raw Materials)"
];

// 3. หัวข้อข่าวเชิงลึกที่ให้ AI สกัด (ใช้ประกอบใน System Prompt อัตโนมัติ)
const TARGET_THEMES = [
  "นโยบายการค้า (มาตรการทางการค้า, อัตราภาษีนำเข้า-ส่งออก, การกีดกันการค้า)",
  "ระดับสต็อกสินค้าเกษตรประเภทต่างๆ ทั้งภายในประเทศและตลาดโลก",
  "สถิติและแนวโน้มการนำเข้า-ส่งออกสินค้าเกษตร",
  "การขนส่ง โลจิสติกส์ และอัตราค่าระวางเรือสินค้าเกษตร",
  "นโยบายรัฐบาล (เช่น โครงการพยุงราคา, การจ่ายเงินชดเชย, เงินสนับสนุนช่วยเหลือ, มาตรการชะลอสินเชื่อ)",
  "ผลกระทบของสงครามและสถานการณ์การเมืองระหว่างประเทศที่มีต่อสินค้าเกษตรและวัตถุดิบอาหารสัตว์"
];

// ==========================================
// 1. ฟังก์ชันหลักสำหรับเริ่มทำงานดึงข่าวผ่าน RSS & Sitemap
// ==========================================
function startRssNewsAgent() {
  const p = PropertiesService.getScriptProperties();
  const apiKey = p.getProperty(PROP_API_KEY);
  
  if (!apiKey) {
    Logger.log("ERROR: กรุณาตั้งค่า GEMINI_API_KEY ใน Script Properties ก่อน");
    return;
  }
  
  const feeds = [
    { name: "ผู้จัดการออนไลน์", url: "https://mgronline.com/store/rss/index.xml", type: "rss" },
    { name: "แนวหน้า", url: "https://www.naewna.com/rss.php", type: "rss" },
    { name: "ไทยรัฐ", url: "https://www.thairath.co.th/sitemap-daily.xml", type: "thairath_sitemap" },
    { name: "โพสต์ทูเดย์", url: "https://api.posttoday.com/sitemap/latest", type: "news_sitemap" },
    { name: "ฐานเศรษฐกิจ", url: "https://api.thansettakij.com/sitemap/latest", type: "news_sitemap" },
    { name: "กรุงเทพธุรกิจ", url: "https://api.bangkokbiznews.com/sitemap/latest", type: "news_sitemap" },
    { name: "มติชน", url: "https://www.matichon.co.th/sitemap-news.xml", type: "news_sitemap" },
    { name: "ประชาชาติธุรกิจ", url: "https://www.prachachat.net/feed", type: "rss" }
  ];
  
  let allArticles = [];
  
  // ดึงข้อมูลและพาร์สทีละ Feed
  feeds.forEach(feed => {
    try {
      Logger.log(`Fetching feed: ${feed.name} (${feed.url})...`);
      const xmlString = fetchXml(feed.url);
      
      let parsed = [];
      if (feed.type === "rss") {
        parsed = parseRssFeed(xmlString, feed.name);
      } else if (feed.type === "thairath_sitemap") {
        parsed = parseThairathSitemap(xmlString);
      } else if (feed.type === "news_sitemap") {
        parsed = parseNewsSitemap(xmlString, feed.name);
      }
      
      Logger.log(`Successfully parsed ${parsed.length} items from ${feed.name}`);
      allArticles = allArticles.concat(parsed);
      
    } catch (e) {
      Logger.log(`ERROR fetching/parsing ${feed.name}: ${e.toString()}`);
    }
  });
  
  if (allArticles.length === 0) {
    Logger.log("No articles retrieved from any feeds.");
    return;
  }
  
  // 1. กรองเฉพาะข่าวที่เผยแพร่ภายใน 24 ชั่วโมงย้อนหลัง
  const currentArticles = allArticles.filter(item => isWithinLast24Hours(item.pubDate));
  Logger.log(`Articles published in the last 24 hours: ${currentArticles.length} items.`);
  
  if (currentArticles.length === 0) {
    Logger.log("No articles published in the last 24 hours.");
    return;
  }
  
  // 2. ดึงประวัติเพื่อทำ Pre-Deduplication (กรองออกล่วงหน้าก่อนประมวลผลคำค้นหาและส่งให้ AI)
  let sheet;
  const sheetId = p.getProperty(PROP_SHEET_ID);
  const sheetName = p.getProperty(PROP_SHEET_NAME) || "RSS";
  try {
    if (sheetId) {
      sheet = SpreadsheetApp.openById(sheetId).getSheetByName(sheetName);
    } else {
      sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    }
  } catch (sheetErr) {
    Logger.log("WARNING: ไม่สามารถเปิด Google Sheet ได้สำหรับ Pre-Deduplication: " + sheetErr.toString());
  }

  let uniqueArticles = currentArticles;
  let existingKeys = null;
  if (sheet) {
    existingKeys = getExistingNewsKeys(sheet);
    uniqueArticles = currentArticles.filter(item => {
      const urlKey = (item.link || "").toString().trim().toLowerCase();
      const headlineKey = (item.title || "").toString().trim().toLowerCase();
      
      if (urlKey && existingKeys.existingUrls.has(urlKey)) return false;
      if (headlineKey && existingKeys.existingHeadlines.has(headlineKey)) return false;
      return true;
    });
    Logger.log(`Articles after Pre-Deduplication (unprocessed news only): ${uniqueArticles.length} items.`);
  }

  if (uniqueArticles.length === 0) {
    Logger.log("All articles in this run are already processed in the history.");
    return;
  }
  
  // 3. กรองหัวข้อข่าวขั้นต้นด้วย Keywords ที่เกี่ยวข้องกับข้าวและการเกษตร
  const candidates = filterByKeywords(uniqueArticles);
  Logger.log(`Candidate articles after keyword filtering: ${candidates.length} items.`);
  
  if (candidates.length === 0) {
    Logger.log("No new agricultural or rice crop candidate news found after keyword filtering.");
    return;
  }
  
  // 4. ส่งข่าวที่ผ่านการกรองขั้นต้นไปให้ Gemini เพื่อวิเคราะห์และแปลงเป็น JSON ภาษาไทย
  Logger.log("Sending candidates to Gemini for final classification and extraction...");
  try {
    const jsonArray = parseCandidatesWithGemini(candidates, apiKey);
    
    // ดึงเวลาเผยแพร่ข่าวที่แท้จริงจากสำนักข่าวมาแทนที่วันที่ดิบของ Gemini เพื่อความแม่นยำสูง
    if (jsonArray && jsonArray.length > 0) {
      jsonArray.forEach(newsItem => {
        const urlKey = (newsItem.url || "").toString().trim().toLowerCase();
        const headlineKey = (newsItem.headline || "").toString().trim().toLowerCase();
        
        const match = candidates.find(c => {
          const cUrl = (c.link || "").toString().trim().toLowerCase();
          const cTitle = (c.title || "").toString().trim().toLowerCase();
          return (urlKey && cUrl === urlKey) || (headlineKey && cTitle === headlineKey);
        });
        
        if (match && match.pubDate) {
          // ฟอร์แมตวันเวลาในเขตนครหลวงกรุงเทพฯ เช่น 2026-07-23 09:42 น.
          newsItem.publish_date = Utilities.formatDate(match.pubDate, "Asia/Bangkok", "yyyy-MM-dd HH:mm น.");
        }
      });
    }
    
    // 5. บันทึกผลลัพธ์ลง Google Sheet (ส่งผ่าน sheet และ keys เพื่อลด Overhead)
    const newItems = saveJsonToSheet(jsonArray, sheet, existingKeys);
    
    // 6. หากมีข่าวใหม่ ให้ทำเอกสารรายงานและส่งการแจ้งเตือน
    if (newItems && newItems.length > 0) {
      let docUrl = "";
      try {
        const folderId = p.getProperty(PROP_DRIVE_FOLDER);
        const doc = getOrCreateDailyDoc(folderId);
        
        // วนลูปสกัดเนื้อหาและภาพเพื่อบันทึกลง Doc (โหลด HTML เพียงรอบเดียวต่อข่าว)
        newItems.forEach(item => {
          if (item.url) {
            Logger.log(`Processing Google Doc content for: ${item.headline}`);
            let htmlContent = null;
            try {
              htmlContent = fetchXml(item.url);
            } catch (fetchErr) {
              Logger.log(`WARNING: ไม่สามารถโหลด HTML ข่าวต้นฉบับได้สำหรับ: ${item.headline}. Error: ${fetchErr.toString()}`);
            }
            const fullText = fetchFullContentWithGemini(htmlContent || item.url, apiKey, item.url);
            const imageBlob = fetchFeaturedImage(htmlContent, item.url);
            appendNewsToDoc(doc, item, fullText, imageBlob);
          }
        });
        
        // ดึงแชร์ลิงก์ของ Google Doc และปิดประมวลผลเซฟไฟล์
        docUrl = doc.getUrl();
        doc.saveAndClose();
        Logger.log(`Successfully updated Daily Google Doc: ${docUrl}`);
      } catch (docError) {
        Logger.log("ERROR managing Google Doc daily report: " + docError.toString());
      }
      
      // ส่งการแจ้งเตือนพร้อมส่งแชร์ลิงก์ Google Doc เข้าไปด้วย
      sendEmailNotification(newItems, docUrl);      // ส่งแจ้งเตือนผ่าน E-mail
      sendTeamsNotification(newItems, docUrl);     // ส่งแจ้งเตือนผ่าน MS Teams
    } else {
      Logger.log("No new news items to notify.");
    }
    
  } catch (error) {
    Logger.log("Exception in startRssNewsAgent processing: " + error.toString());
  }
}

// ==========================================
// 2. ฟังก์ชันพาร์สและกรองรูปแบบข้อมูลต่างๆ
// ==========================================

// ฟังก์ชันดึง XML พร้อมจำลอง User-Agent เพื่อป้องกัน Error 403 และล้าง Entity ที่ไม่ถูกต้องใน XML
function fetchXml(url) {
  const p = PropertiesService.getScriptProperties();
  const scraperApiKey = p.getProperty(PROP_SCRAPER_KEY);
  
  // ตรวจจับว่าต้องใช้ Proxy หรือไม่ (เฉพาะมติชนและประชาชาติธุรกิจที่ติด 403)
  const isBlockedSite = url.includes("matichon.co.th") || url.includes("prachachat.net");
  
  let finalUrl = url;
  if (isBlockedSite && scraperApiKey) {
    finalUrl = "http://api.scraperapi.com?api_key=" + scraperApiKey + "&url=" + encodeURIComponent(url);
    Logger.log("Fetching via ScraperAPI Proxy for: " + url);
  }
  
  const options = {
    method: "get",
    muteHttpExceptions: true,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/xml, application/xml, application/xhtml+xml, text/html"
    }
  };
  
  const response = UrlFetchApp.fetch(finalUrl, options);
  const code = response.getResponseCode();
  if (code !== 200) {
    throw new Error("HTTP Error " + code + " when fetching via " + (finalUrl === url ? "Direct" : "Proxy") + " for " + url);
  }
  return sanitizeXmlEntities(response.getContentText());
}

// ฟังก์ชันสำหรับแทนที่ HTML Entity ที่ไม่ใช่ XML Entity มาตรฐาน เพื่อไม่ให้โครงสร้าง XML พังระหว่างการพาร์ส
function sanitizeXmlEntities(xmlString) {
  if (!xmlString) return "";
  
  const entityMap = {
    "nbsp": " ",
    "hellip": "...",
    "copy": "(c)",
    "reg": "(r)",
    "trade": "(tm)",
    "ldquo": '"',
    "rdquo": '"',
    "lsquo": "'",
    "rsquo": "'",
    "ndash": "-",
    "mdash": "--",
    "middot": "·",
    "bull": "•",
    "cent": "¢",
    "pound": "£",
    "yen": "¥",
    "euro": "€",
    "para": "¶",
    "sect": "§"
  };
  
  return xmlString.replace(/&([a-zA-Z0-9]+);/g, function(match, name) {
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
}

// พาร์สข้อมูล RSS Feed
function parseRssFeed(xmlString, sourceName) {
  const document = XmlService.parse(xmlString);
  const root = document.getRootElement();
  const channel = root.getChild("channel");
  
  if (!channel) return [];
  
  const items = channel.getChildren("item");
  const parsedItems = [];
  
  items.forEach(item => {
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
      source: sourceName
    });
  });
  
  return parsedItems;
}

// พาร์สข้อมูล Sitemap ของไทยรัฐ (สกัดข่าวจากแท็ก image)
function parseThairathSitemap(xmlString) {
  const document = XmlService.parse(xmlString);
  const root = document.getRootElement();
  const ns = XmlService.getNamespace("http://www.sitemaps.org/schemas/sitemap/0.9");
  const nsImage = XmlService.getNamespace("image", "http://www.google.com/schemas/sitemap-image/1.1");
  
  const urls = root.getChildren("url", ns);
  const items = [];
  
  urls.forEach(urlElement => {
    const loc = urlElement.getChildText("loc", ns);
    const imageElement = urlElement.getChild("image", nsImage);
    let title = "";
    let description = "";
    if (imageElement) {
      title = imageElement.getChildText("title", nsImage) || "";
      description = imageElement.getChildText("caption", nsImage) || "";
    }
    
    if (title) {
      items.push({
        title: title.trim(),
        link: loc.trim(),
        description: description.trim(),
        pubDate: new Date(), // sitemap-daily.xml ถือเป็นข่าวของวันนั้นๆ
        source: "ไทยรัฐ"
      });
    }
  });
  return items;
}

// พาร์สข้อมูล Google News Sitemap (โพสต์ทูเดย์, ฐานเศรษฐกิจ, กรุงเทพธุรกิจ, มติชน, ประชาชาติธุรกิจ)
function parseNewsSitemap(xmlString, sourceName) {
  const document = XmlService.parse(xmlString);
  const root = document.getRootElement();
  const ns = XmlService.getNamespace("http://www.sitemaps.org/schemas/sitemap/0.9");
  const nsNews = XmlService.getNamespace("news", "http://www.google.com/schemas/sitemap-news/0.9");
  const nsImage = XmlService.getNamespace("image", "http://www.google.com/schemas/sitemap-image/1.1");
  
  const urls = root.getChildren("url", ns);
  const items = [];
  
  urls.forEach(urlElement => {
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
        source: sourceName
      });
    }
  });
  return items;
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

// กรองเฉพาะข่าวที่เผยแพร่ภายใน 24 ชั่วโมงย้อนหลังจากเวลาปัจจุบัน
function isWithinLast24Hours(date) {
  if (!date) return false;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  return diffHours >= 0 && diffHours <= 24;
}

// ตัวกรองคำค้นหา (Keyword Filter) เบื้องต้นเพื่อประหยัดโควตาการประมวลผลของ AI โดยใช้คำค้นจากอาเรย์ FILTER_KEYWORDS ด้านบน
function filterByKeywords(items) {
  return items.filter(item => {
    const textToSearch = (item.title + " " + item.description).toLowerCase();
    return FILTER_KEYWORDS.some(keyword => textToSearch.includes(keyword.toLowerCase()));
  });
}

// ฟังก์ชันสร้าง System Prompt แบบไดนามิกอ้างอิงตามค่าหัวข้อสินค้าเกษตรและนโยบายที่กำหนดไว้ด้านบน
function getSystemPrompt() {
  return `
You are a professional agricultural data extraction assistant.
Your job is to analyze the provided list of Thai news articles and extract news related to specific agricultural products and themes.

# Target Agricultural Products:
${TARGET_PRODUCTS.map(p => `- ${p}`).join("\n")}

# Target Themes:
${TARGET_THEMES.map(t => `- ${t}`).join("\n")}

# Rules for Selection:
1. ONLY extract news that matches at least one of the Target Agricultural Products AND covers at least one of the Target Themes.
2. STRICT EXCLUSIONS:
   - EXCLUDE local charity, merit-making (ทำบุญ/ทำทาน), Buddhist ceremony sponsorships (เช่น วางศิลาฤกษ์, ทอดกฐิน, งานบวช), local community donations, private foundation handouts, or politician CSR/local public relations events where rice/agricultural products are given out as small-scale gifts or alms.
   - EXCLUDE general restaurant food prices, cooking recipes, general politics, or unrelated economic gossip.
3. ALLOWED EXCEPTIONS:
   - ALLOW government-to-government (G2G) trade/grants, bilateral/multilateral official humanitarian aid (เช่น รัฐบาลไทยส่งข้าวสารช่วยเหลือผู้ประสบภัยระดับประเทศหรือประเทศเพื่อนบ้าน เช่น สปป.ลาว), or official national-level agricultural emergency relief programs.
4. SEMANTIC DEDUPLICATION:
   - If multiple candidate articles discuss the exact same event, announcement, policy, or press release (even if they are from different news sources or have slightly different headlines), you MUST choose only ONE representative article (preferably the one from the most reputable or detailed source, or the primary official announcer) and completely discard the other duplicate articles. Do not output multiple records for the same news event.
5. If no articles match the criteria, return an empty array [].

# Extraction Fields Schema:
For each relevant news article, extract and translate the fields as follows:
1. publish_date: The date the news was published in the format YYYY-MM-DD.
2. category: Choose one of "ราคาและการค้า", "นโยบายรัฐ", "คู่แข่งและตลาดโลก", "สภาพภูมิอากาศและผลผลิต"
3. source: The news source name in Thai (e.g. ผู้จัดการออนไลน์, ไทยรัฐ, แนวหน้า, โพสต์ทูเดย์, ฐานเศรษฐกิจ, กรุงเทพธุรกิจ, มติชน, ประชาชาติธุรกิจ)
4. headline: Headline of the news story translated to Thai
5. summary: A concise summary of the story in Thai (4-5 lines) containing key details
6. metrics: Key numbers/metrics mentioned in the story (e.g., price per ton, export quantities, budget amount) or "ไม่มี" if none
7. impact: Choose one of "High", "Medium", "Low" based on the impact on Thai agricultural exporters
8. url: The URL link associated with the story.

You must output ONLY a valid JSON array matching the schema:
[
  {
    "publish_date": "string",
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
function parseCandidatesWithGemini(candidates, apiKey) {
  const p = PropertiesService.getScriptProperties();
  const modelName = p.getProperty(PROP_MODEL_NAME) || "gemini-1.5-flash"; // gemini-1.5-flash หรือ gemini-2.5-flash
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
  
  const systemPrompt = getSystemPrompt();

  const payload = {
    contents: [
      {
        parts: [
          { text: systemPrompt },
          { text: "Here is the list of news articles to analyze:\n" + JSON.stringify(candidates, null, 2) }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  const options = {
    method: "post",
    contentType: "application/json; charset=utf-8",
    headers: {
      "x-goog-api-key": apiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseJson = JSON.parse(response.getContentText());
  
  if (responseJson.candidates && responseJson.candidates[0].content.parts[0].text) {
    const jsonText = responseJson.candidates[0].content.parts[0].text;
    return JSON.parse(jsonText);
  } else {
    throw new Error("Failed to parse report with Gemini: " + response.getContentText());
  }
}

// ==========================================
// 4. บันทึกผลลัพธ์ลงในชีตชื่อ "RSS" และตรวจสอบข่าวซ้ำ
// ==========================================
function saveJsonToSheet(jsonArray, sheetObj, existingKeys) {
  const p = PropertiesService.getScriptProperties();
  const sheetId = p.getProperty(PROP_SHEET_ID);
  // ตั้งค่าให้ชีตเริ่มต้นเป็นชื่อ "RSS" ตามต้องการ
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
  
  // หากเป็นหน้าชีตสร้างใหม่และไม่มีแถวข้อมูลเลย ให้พิมพ์หัวข้อคอลัมน์ (Headers) ก่อน
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
      "URL"
    ]);
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
  
  // 2. เปรียบเทียบข้อมูลและบันทึกข้อมูลข่าวใหม่
  jsonArray.forEach(news => {
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
      sheet.appendRow([
        timestamp,
        news.publish_date || "ไม่ระบุวันเผยแพร่",
        news.category || "ราคาและการค้า",
        news.source || "ไม่ระบุแหล่งข่าว",
        news.headline || "ไม่มีหัวข้อข่าว",
        news.summary || "ไม่มีสรุปเนื้อหา",
        news.metrics || "ไม่มี",
        news.impact || "Low",
        news.url || ""
      ]);
      newItems.push(news);
      
      if (urlKey) existingUrls.add(urlKey);
      if (headlineKey) existingHeadlines.add(headlineKey);
    } else {
      Logger.log(`Skipped duplicate news: ${news.headline}`);
    }
  });
  
  Logger.log(`Saved ${newItems.length} new news items to Google Sheet.`);
  return newItems;
}

// ดึงข้อมูลข่าวในชีตที่เคยบันทึกไว้ เพื่อใช้ตรวจสอบความซ้ำซ้อนล่วงหน้า (Pre-Deduplication)
function getExistingNewsKeys(sheet) {
  const lastRow = sheet.getLastRow();
  const existingUrls = new Set();
  const existingHeadlines = new Set();
  
  if (lastRow > 1) { // แถวแรกเป็น Header
    const data = sheet.getRange(1, 1, lastRow, 9).getValues();
    for (let i = 1; i < data.length; i++) {
      const headline = data[i][4]; // คอลัมน์ E (Headline)
      const url = data[i][8];      // คอลัมน์ I (URL)
      if (url) {
        existingUrls.add(url.toString().trim().toLowerCase());
      }
      if (headline) {
        existingHeadlines.add(headline.toString().trim().toLowerCase());
      }
    }
  }
  return { existingUrls, existingHeadlines };
}

// ==========================================
// 5. ส่งอีเมลแจ้งเตือนข่าวใหม่ล่าสุด (Email Notification)
// ==========================================
function sendEmailNotification(newItems, docUrl) {
  const p = PropertiesService.getScriptProperties();
  const recipient = p.getProperty(PROP_EMAIL_RECIPIENT) || "Kitisak.jun@cpintertrade.com";
  
  if (!recipient) {
    Logger.log("WARNING: ไม่พบอีเมลผู้รับการแจ้งเตือน");
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
          \${item.category || "ราคาและการค้า"}
        </span>
        <span style="font-size: 12px; color: #777; margin-left: 10px;">
          แหล่งข่าว: <strong>\${item.source || "ไม่ระบุแหล่งข่าว"}</strong> | เผยแพร่: \${item.publish_date || "ไม่ระบุวันเผยแพร่"}
        </span>
        <h3 style="margin: 8px 0; color: #111; font-size: 16px;">\${idx + 1}. \${item.headline || "ไม่มีหัวข้อข่าว"}</h3>
        <p style="margin: 8px 0; color: #444; font-size: 14px;">\${item.summary || "ไม่มีสรุปเนื้อหา"}</p>
        \${item.metrics && item.metrics !== "ไม่มี" ? \`<p style="margin: 8px 0; color: #e65100; font-size: 13px;">📊 <strong>ตัวเลขสำคัญ:</strong> \${item.metrics}</p>\` : ''}
        <p style="margin: 8px 0; font-size: 13px;">🎯 <strong>ผลกระทบต่อผู้ส่งออกไทย:</strong> <span style="font-weight: bold; color: \${item.impact === 'High' ? '#d32f2f' : (item.impact === 'Medium' ? '#f57c00' : '#388e3c')}">\${item.impact || 'Low'}</span></p>
        \${item.url ? \`<p style="margin: 10px 0 0 0; font-size: 13px;"><a href="\${item.url}" target="_blank" style="color: #1976d2; text-decoration: none; font-weight: bold;">🔗 อ่านข่าวต้นฉบับ</a></p>\` : ''}
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
      htmlBody: htmlBody
    });
    Logger.log("Email notification sent to " + recipient + " for " + newItems.length + " news items.");
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
    Logger.log("WARNING: ไม่พบค่า TEAMS_WEBHOOK_URL ใน Script Properties การข้ามการส่งแจ้งเตือน MS Teams");
    return;
  }
  
  // สร้างโครงร่าง Adaptive Card
  const cardBody = [
    {
      "type": "TextBlock",
      "text": "📢 รายงานข่าวประจำวันล่าสุด (RSS & Sitemap)",
      "weight": "Bolder",
      "size": "Medium",
      "color": "Good"
    },
    {
      "type": "TextBlock",
      "text": `พบข่าวสารใหม่ในระบบจำนวน ${newItems.length} รายการ ดังนี้:`,
      "isSubtle": true,
      "wrap": true
    }
  ];
  
  const cardActions = [];
  
  // เพิ่มปุ่มเปิดเล่มรายงาน Google Doc เป็นอันดับแรก
  if (docUrl) {
    cardActions.push({
      "type": "Action.OpenUrl",
      "title": "📄 เปิดเล่มรายงานข่าวประจำวัน",
      "url": docUrl
    });
  }
  
  newItems.forEach((item, index) => {
    // เพิ่มข้อมูลข่าวแต่ละข่าวลงใน body
    cardBody.push({
      "type": "TextBlock",
      "text": `**${index + 1}. ${item.headline || "ไม่มีหัวข้อข่าว"}**`,
      "wrap": true,
      "weight": "Bolder",
      "spacing": "Medium"
    });
    
    cardBody.push({
      "type": "FactSet",
      "facts": [
        { "title": "แหล่งข่าว", "value": item.source || "ไม่ระบุ" },
        { "title": "วันที่", "value": item.publish_date || "ไม่ระบุ" },
        { "title": "หมวดหมู่", "value": item.category || "ราคาและการค้า" },
        { "title": "ผลกระทบ", "value": item.impact || "Low" }
      ],
      "spacing": "None"
    });
    
    // ถ้ามี URL ให้ทำปุ่มลิงก์เปิดข่าว (รองรับปุ่มได้สูงสุด 6 ปุ่มใน Teams)
    if (item.url && cardActions.length < 6) {
      cardActions.push({
        "type": "Action.OpenUrl",
        "title": `🔗 อ่านข่าวที่ ${index + 1}`,
        "url": item.url
      });
    }
  });
  
  const payload = {
    "type": "message",
    "attachments": [
      {
        "contentType": "application/vnd.microsoft.card.adaptive",
        "content": {
          "type": "AdaptiveCard",
          "body": cardBody,
          "actions": cardActions,
          "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
          "version": "1.4"
        }
      }
    ]
  };
  
  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(webhookUrl, options);
    Logger.log("MS Teams Notification sent. Response: " + response.getContentText());
  } catch (e) {
    Logger.log("ERROR sending MS Teams notification: " + e.toString());
  }
}

// ==========================================
// 7. ระบบจัดทำเล่มรายงานข่าวสรุปรายวันบน Google Doc
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
      Logger.log("WARNING: ไม่สามารถเข้าถึง DRIVE_FOLDER_ID ได้ ระบบจะใช้ Root โฟลเดอร์แทน. Error: " + e.toString());
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
    const titleParagraph = body.appendParagraph("รายงานข่าวประจำวัน " + dateString);
    titleParagraph.setHeading(DocumentApp.ParagraphHeading.TITLE);
    titleParagraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    styleParagraph(titleParagraph, "Cordia New", 24, "#000000", true, false);
    
    body.appendHorizontalRule();
    
    doc.saveAndClose();
    return DocumentApp.openById(doc.getId());
  }
}

// สกัดภาพหน้าปก / อินโฟกราฟิกหลักผ่าน og:image tag โดยรับ HTML ดิบโดยตรงเพื่อลด Overhead
function fetchFeaturedImage(html, url) {
  try {
    let htmlContent = html;
    if (!htmlContent && url) {
      htmlContent = fetchXml(url);
    }
    if (!htmlContent) return null;
    
    // ใช้ Regex ที่ยืดหยุ่นเพื่อค้นหาแท็ก og:image ใน HTML ของบทความ (รองรับทั้งแบบ property ขึ้นก่อน หรือ content ขึ้นก่อน)
    let imageUrl = null;
    const match1 = htmlContent.match(/meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    const match2 = htmlContent.match(/meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);
    
    if (match1 && match1[1]) {
      imageUrl = match1[1].trim();
    } else if (match2 && match2[1]) {
      imageUrl = match2[1].trim();
    }
    
    if (imageUrl) {
      const lowerUrl = imageUrl.toLowerCase();
      // เช็คเบื้องต้นจากนามสกุลไฟล์หรือพารามิเตอร์ของ URL
      if (lowerUrl.indexOf(".webp") !== -1 || lowerUrl.indexOf("format=webp") !== -1) {
        Logger.log("Skipping WebP image (unsupported by Google Docs): " + imageUrl);
        return null;
      }
      
      Logger.log("Found og:image URL: " + imageUrl);
      const response = UrlFetchApp.fetch(imageUrl, { muteHttpExceptions: true });
      if (response.getResponseCode() === 200) {
        const blob = response.getBlob();
        const contentType = blob.getContentType() || "";
        // ตรวจสอบ Content-Type จาก HTTP response header เผื่อบางไฟล์ไม่มีนามสกุลใน URL
        if (contentType.toLowerCase().indexOf("webp") !== -1) {
          Logger.log("Skipping WebP image based on Content-Type header: " + imageUrl);
          return null;
        }
        return blob;
      }
    }
  } catch (e) {
    Logger.log("WARNING: ไม่สามารถโหลดรูปภาพประกอบของหน้าเว็บได้ " + url + ". Error: " + e.toString());
  }
  return null;
}

// ทำความสะอาด HTML ดิบโดยตัด script/style ออกเพื่อลดจำนวน Token ก่อนส่งให้ AI
function cleanHtmlForAI(html) {
  if (!html) return "";
  let text = html;
  
  // ลบแท็ก script และ style ทั้งหมด
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  
  // สกัดเอาเฉพาะเนื้อความภายในแท็ก body
  const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    text = bodyMatch[1];
  }
  
  // ล้างช่องว่างที่มากเกินความจำเป็น
  text = text.replace(/\s+/g, " ").trim();
  
  // ตัดเนื้อหาไว้สูงสุดที่ 50,000 อักษรเพื่อเซฟความเร็วและ Token ของโมเดล
  if (text.length > 50000) {
    text = text.substring(0, 50000);
  }
  return text;
}

// ส่งเนื้อหาหน้าเว็บเต็มให้ Gemini ทำการสกัดเป็นบทความยาวภาษาไทยฉบับสมบูรณ์ (รองรับการรับ HTML ดิบโดยตรงเพื่อเลี่ยงโหลดซ้ำ)
function fetchFullContentWithGemini(htmlOrUrl, apiKey, urlForLog) {
  try {
    let rawHtml = htmlOrUrl;
    if (htmlOrUrl && htmlOrUrl.toString().trim().indexOf("http") === 0) {
      rawHtml = fetchXml(htmlOrUrl);
    }
    const cleanedText = cleanHtmlForAI(rawHtml);
    
    if (!cleanedText) return "ไม่สามารถดึงข้อมูลเนื้อหาหลักของข่าวได้";
    
    const p = PropertiesService.getScriptProperties();
    const modelName = p.getProperty(PROP_MODEL_NAME) || "gemini-1.5-flash";
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
    
    const prompt = `
You are a news transcription assistant.
Your job is to read the provided raw webpage content of a Thai news article and extract the full, detailed body text of the article in Thai.

Rules:
1. ONLY extract the main news article content.
2. EXCLUDE all advertisements, navigation menus, footer text, sidebar widgets, related articles lists, sign-up forms, and reader comments.
3. Keep the full detailed reporting prose. Do not summarize it to 3 lines; keep it detailed so the user can read the complete article.
4. Format the output with clean Thai paragraph breaks.
5. If there are subheadings in the article, format them with bold text.
6. Do NOT include any introductory or concluding comments in your output. Just output the extracted news text.
`;

    const payload = {
      contents: [
        {
          parts: [
            { text: prompt },
            { text: "Here is the raw webpage text:\n" + cleanedText }
          ]
        }
      ]
    };

    const options = {
      method: "post",
      contentType: "application/json; charset=utf-8",
      headers: {
        "x-goog-api-key": apiKey
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(geminiUrl, options);
    const responseJson = JSON.parse(response.getContentText());
    
    if (responseJson.candidates && responseJson.candidates[0].content.parts[0].text) {
      return responseJson.candidates[0].content.parts[0].text.trim();
    }
  } catch (e) {
    Logger.log("ERROR extracting full content with Gemini for " + (urlForLog || "unknown URL") + ": " + e.toString());
  }
  return "ไม่สามารถถอดรายละเอียดข่าวฉบับเต็มโดย AI ได้";
}

// นำข่าว สรุปย่อ ภาพประกอบ และข่าวฉบับเต็มไปเขียนบันทึกต่อท้าย (Append) ในเล่ม Google Doc
function appendNewsToDoc(doc, item, fullText, imageBlob) {
  const body = doc.getBody();
  
  // 1. หัวข้อข่าวหลัก (Heading 2)
  const headingText = `${item.source || "ไม่ระบุแหล่งข่าว"} - ${item.headline || "ไม่มีหัวข้อข่าว"}`;
  const heading = body.appendParagraph(headingText);
  heading.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  styleParagraph(heading, "Cordia New", 16, "#000000", true, false);
  heading.setSpacingBefore(12);
  
  // 2. ข้อมูลสถิติของข่าว (Meta data)
  const metaText = `📅 วันที่เผยแพร่: ${item.publish_date || "ไม่ระบุ"} | 📁 หมวดหมู่: ${item.category || "ราคาและการค้า"} | 🎯 ผลกระทบ: ${item.impact || "Low"}\n🔗 ลิงก์ข่าวต้นฉบับ: ${item.url || "ไม่มี"}`;
  const metaParagraph = body.appendParagraph(metaText);
  styleParagraph(metaParagraph, "Cordia New", 14, "#000000", false, false);
  metaParagraph.setSpacingAfter(6);
  
  // 3. บทวิเคราะห์ย่อโดย AI
  const summaryHeading = body.appendParagraph("📝 สรุปย่อโดย AI:");
  styleParagraph(summaryHeading, "Cordia New", 14, "#000000", true, false);
  
  const summaryParagraph = body.appendParagraph(item.summary || "ไม่มีสรุปเนื้อหา");
  styleParagraph(summaryParagraph, "Cordia New", 14, "#000000", false, false);
  summaryParagraph.setSpacingAfter(6);
  
  if (item.metrics && item.metrics !== "ไม่มี") {
    const metricsParagraph = body.appendParagraph(`📊 ตัวเลข/สถิติสำคัญ: ${item.metrics}`);
    styleParagraph(metricsParagraph, "Cordia New", 14, "#000000", true, false);
    metricsParagraph.setSpacingAfter(6);
  }
  
  // 4. บทความข่าวฉบับเต็ม
  const fullTextHeading = body.appendParagraph("📰 เนื้อหาข่าวฉบับเต็ม:");
  styleParagraph(fullTextHeading, "Cordia New", 14, "#000000", true, false);
  
  const fullTextParagraph = body.appendParagraph(fullText);
  styleParagraph(fullTextParagraph, "Cordia New", 14, "#000000", false, false);
  fullTextParagraph.setSpacingAfter(10);
  
  // 5. แทรกรูปภาพประกอบ (หากโหลดภาพสำเร็จ)
  if (imageBlob) {
    try {
      const imgHeading = body.appendParagraph("📸 ภาพประกอบข่าว:");
      styleParagraph(imgHeading, "Cordia New", 14, "#000000", true, false);
      
      const image = body.appendImage(imageBlob);
      // จำกัดความกว้างไม่ให้ล้นหน้าขอบกระดาษ Word/Google Doc
      const originalWidth = image.getWidth();
      const originalHeight = image.getHeight();
      const maxWidth = 450;
      if (originalWidth > maxWidth) {
        const ratio = maxWidth / originalWidth;
        image.setWidth(maxWidth);
        image.setHeight(originalHeight * ratio);
      }
    } catch (e) {
      Logger.log("WARNING: ไม่สามารถเขียนแทรกรูปภาพประกอบลงใน Google Doc ได้. Error: " + e.toString());
    }
  }
  
  // 6. เส้นคั่นระหว่างข่าว
  body.appendHorizontalRule();
}

// ฟังก์ชันเสริมสำหรับกำหนดรูปแบบข้อความ (Font, Size, Color, Weight, Style) ป้องกันบั๊กการสืบทอดสีและรูปแบบอักษร
function styleParagraph(p, fontFamily, fontSize, color, isBold, isItalic) {
  p.setFontFamily(fontFamily || "Cordia New");
  p.setFontSize(fontSize || 14);
  p.setForegroundColor(color || "#000000");
  p.setBold(isBold === true);
  p.setItalic(isItalic === true);
  return p;
}
