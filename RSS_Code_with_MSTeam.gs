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
  
  // 1. กรองเฉพาะข่าวของ วันนี้ และ เมื่อวานนี้
  const currentArticles = allArticles.filter(item => isTodayOrYesterday(item.pubDate));
  Logger.log(`Articles published today/yesterday: ${currentArticles.length} items.`);
  
  if (currentArticles.length === 0) {
    Logger.log("No articles published in the timeframe (today/yesterday).");
    return;
  }
  
  // 2. กรองหัวข้อข่าวขั้นต้นด้วย Keywords ที่เกี่ยวข้องกับข้าวและการเกษตร
  const candidates = filterByKeywords(currentArticles);
  Logger.log(`Candidate articles after keyword filtering: ${candidates.length} items.`);
  
  if (candidates.length === 0) {
    Logger.log("No agricultural or rice crop candidate news found.");
    return;
  }
  
  // 3. ส่งข่าวที่ผ่านการกรองขั้นต้นไปให้ Gemini เพื่อวิเคราะห์และแปลงเป็น JSON ภาษาไทย
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
    
    // 4. บันทึกผลลัพธ์ลง Google Sheet
    const newItems = saveJsonToSheet(jsonArray);
    
    // 5. ส่งการแจ้งเตือนหากมีข่าวใหม่เข้ามา
    if (newItems && newItems.length > 0) {
      sendEmailNotification(newItems);      // ส่งแจ้งเตือนผ่าน E-mail
      sendTeamsNotification(newItems);     // ส่งแจ้งเตือนผ่าน MS Teams
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
  if (!dateStr) return new Date();
  
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
  
  return new Date();
}

// กรองเฉพาะข่าวที่เผยแพร่วันนี้และเมื่อวานนี้
function isTodayOrYesterday(date) {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  
  const formattedToday = Utilities.formatDate(today, "Asia/Bangkok", "yyyy-MM-dd");
  const formattedYesterday = Utilities.formatDate(yesterday, "Asia/Bangkok", "yyyy-MM-dd");
  
  const itemDate = Utilities.formatDate(date, "Asia/Bangkok", "yyyy-MM-dd");
  
  return itemDate === formattedToday || itemDate === formattedYesterday;
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
2. EXCLUDE general restaurant food prices, cooking recipes, general politics, or unrelated economic gossip.
3. If no articles match the criteria, return an empty array [].

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
function saveJsonToSheet(jsonArray) {
  const p = PropertiesService.getScriptProperties();
  const sheetId = p.getProperty(PROP_SHEET_ID);
  // ตั้งค่าให้ชีตเริ่มต้นเป็นชื่อ "RSS" ตามต้องการ
  const sheetName = p.getProperty(PROP_SHEET_NAME) || "RSS";
  
  let sheet;
  if (sheetId) {
    sheet = SpreadsheetApp.openById(sheetId).getSheetByName(sheetName);
  } else {
    sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
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
  const lastRow = sheet.getLastRow();
  const existingUrls = new Set();
  const existingHeadlines = new Set();
  
  if (lastRow > 1) { // มากกว่า 1 เพราะแถวที่ 1 เป็น Header
    const data = sheet.getRange(1, 1, lastRow, 9).getValues();
    for (let i = 1; i < data.length; i++) { // เริ่มวนแถวที่ 2 (i=1)
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

// ==========================================
// 5. ส่งอีเมลแจ้งเตือนข่าวใหม่ล่าสุด (Email Notification)
// ==========================================
function sendEmailNotification(newItems) {
  const p = PropertiesService.getScriptProperties();
  const recipient = p.getProperty(PROP_EMAIL_RECIPIENT) || "Kitisak.jun@cpintertrade.com";
  
  if (!recipient) {
    Logger.log("WARNING: ไม่พบอีเมลผู้รับการแจ้งเตือน");
    return;
  }
  
  let subject = `[ข่าวข้าวใหม่ - RSS] มีข่าวใหม่จำนวน ${newItems.length} รายการ`;
  
  let htmlBody = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #fcfcfc;">
      <h2 style="color: #2e7d32; border-bottom: 2px solid #2e7d32; padding-bottom: 10px; margin-top: 0;">📢 รายงานข่าวข้าวจาก RSS & Sitemap</h2>
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
// 6. ส่งอีเมลแจ้งเตือนข่าวใหม่ล่าสุดไปยัง Microsoft Teams
// ==========================================
function sendTeamsNotification(newItems) {
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
      "text": "📢 รายงานข่าวข้าวใหม่ล่าสุด (RSS & Sitemap)",
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
