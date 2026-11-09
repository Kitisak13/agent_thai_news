โปรเจกต์ **AI-Powered Thai Agricultural News Aggregator** เป็นระบบอัตโนมัติบน Google Apps Script (GAS) ที่ออกแบบสถาปัตยกรรมมาได้ครบวงจรและคุ้มค่ามาก โดยภาพรวมของโปรเจกต์ทั้งจุดแข็ง จุดอ่อน แนวทางพัฒนาต่อยอด และวิธีแก้ปัญหาเรื่องการดึงภาพกราฟ/อินโฟกราฟิกในเนื้อหาข่าว มีดังนี้ครับ

**จุดแข็งของโปรเจกต์ (Pros)**

- **สถาปัตยกรรมประหยัดงบและดูแลรักษาง่าย (Zero-Server Cost):** รันบน Google Apps Script ทั้งหมด ไม่ต้องเช่าเซิร์ฟเวอร์ มีการจัดเก็บข้อมูลลง Google Sheets สร้างเล่มรายงานลง Google Docs และแจ้งเตือนผ่าน Email และ MS Teams ครบจบในที่เดียว

- **ระบบกรองข้อมูลหลายชั้น (Multi-Stage Filtering):** มีการกรองข่าวซ้ำล่วงหน้า (Pre-Deduplication) และกรองด้วย Keyword ในระดับโค้ดก่อนส่งให้ Gemini API ช่วยประหยัด Token และเวลาประมวลผลได้มหาศาล

- **ระบบดึงข้อมูลมีความทนทานสูง (Resilient Fetching):** มีการจัดการเว็บไซต์ข่าวไทยที่โครงสร้างต่างกัน (ทั้ง RSS, Daily Sitemap, News Sitemap) พร้อมระบบ Fallback 3 ชั้น (ยิงตรง -> Free Proxy -> ScraperAPI หลักและสำรอง) เพื่อทะลุบล็อก Cloudflare ของเว็บอย่างมติชนและประชาชาติธุรกิจ

- **การสกัดข้อมูลเชิงธุรกิจที่นำไปใช้ต่อได้ทันที:** Prompt สั่งให้ Gemini สกัดทั้งหมวดหมู่ สรุปย่อ ตัวเลขสำคัญ (Metrics) และประเมินระดับผลกระทบต่อผู้ส่งออกไทย (High/Medium/Low) ในรูปแบบ JSON Schema ที่ชัดเจน

**จุดอ่อนและข้อจำกัดในปัจจุบัน (Cons)**

- **ข้อจำกัดการดึงรูปภาพ:** ปัจจุบันฟังก์ชันดึงภาพ (`fetchFeaturedImage`) ดึงเฉพาะภาพหน้าปกจากแท็ก `og:image` เพียงภาพเดียว และข้ามไฟล์ตระกูล `.webp` ทิ้งทั้งหมด ทำให้พลาดภาพกราฟหรือตารางข้อมูลสำคัญที่แทรกอยู่ในเนื้อหาข่าว รวมถึงข่าวจากเว็บสมัยใหม่ที่ใช้ `.webp` เป็นหลักจะไม่มีรูปแสดงเลย

- **การสกัดเนื้อหาเว็บสมัยใหม่ (SPA/Next.js) และรูปภาพในบทความ:** ฟังก์ชัน `cleanHtmlForAI` ลบแท็กหรือตัดข้อความที่ 50,000 ตัวอักษรแรก ซึ่งในเว็บยุคใหม่ส่วนหัวมักเต็มไปด้วยโค้ดโครงสร้างเว็บ ทำให้เนื้อหาข่าวจริงหรือแท็กรูปภาพ (`<img>`) ที่อยู่ลึกๆ ถูกตัดทิ้งหรือถูกลบออกไปก่อนส่งถึง AI

- **ข้อจำกัดด้านเวลาของ Google Apps Script (6-Minute Limit):** การวนลูปดึงหน้าเว็บ สกัดเนื้อหาด้วย AI และดาวน์โหลดรูปภาพทีละข่าวแบบเรียงคิว (Synchronous) มีความเสี่ยงที่จะเกิด Timeout หากในรอบนั้นมีข่าวใหม่พร้อมกันจำนวนมาก (และยิ่งเสี่ยงขึ้นหากต้องโหลดหลายรูปต่อ 1 ข่าว)

- **ปัญหา Logic ในโค้ดรุ่นแรก (หากยังไม่ได้อัปเดตเป็น V2):** เช่น การเช็คข่าวซ้ำข้ามรอบรันที่เช็คเฉพาะข้อความตรงเป๊ะทำให้ข่าวเรื่องเดียวกันจากคนละสำนักหลุดรอด, การจับคู่ วันที่เผยแพร่ (`pubDate`) กลับคืนที่อาจหลุดหาก AI เกลาพาดหัวข่าวใหม่จนได้วันที่มโน (เช่นปี 2024), และเครื่องหมาย `\` (Escaped String) ที่ติดอยู่ใน HTML ของฟังก์ชันส่งอีเมล

**สิ่งที่ควรพัฒนาเพิ่มเติมในภาพรวม (Future Improvements)**

- **เปลี่ยนการยิง Request เป็นแบบคู่ขนาน (Parallel Fetching):** นำ `UrlFetchApp.fetchAll()` มาใช้ในขั้นตอนการดึง HTML ของหน้าเว็บข่าว การเรียก Gemini API และการดาวน์โหลดไฟล์รูปภาพ (Blob) พร้อมกันทุกข่าวในครั้งเดียว เพื่อลดเวลาการทำงานจากหลักนาทีเหลือไม่กี่วินาที

- **อัปเกรดระบบแปลงไฟล์ภาพ `.webp` อัตโนมัติ:** แทนที่จะข้ามไฟล์ `.webp` ให้ส่ง URL ของภาพผ่านบริการ Image Proxy ฟรีอย่าง `[https://wsrv.nl/?url=...&output=jpg](https://wsrv.nl/?url=...&output=jpg)` เพื่อแปลงเป็น `.jpg` ก่อนนำเข้า Google Docs

- **ทำระบบคลีนและส่งข้อมูลแบบผูก `ref_id` และ Cross-Run Deduplication:** ผูก ID กำกับข่าวก่อนส่งให้ AI เพื่อความแม่นยำของวันที่และลิงก์ 100% รวมถึงส่งพาดหัวข่าวย้อนหลัง 24–48 ชม. แนบไปใน Prompt เพื่อกันข่าวซ้ำข้ามสำนักข่าว

---

**แนวทางแก้ไขและออกแบบระบบดึง "ภาพกราฟ / Infographic ในเนื้อหาข่าว" ลง Google Docs**

ปัญหาหลักของการดึงรูปในเนื้อหาข่าว (`<body>`) คือ ในหน้าเว็บ 1 หน้าจะมีรูปขยะปะปนอยู่มากมาย (เช่น โลโก้เว็บ, แบนเนอร์โฆษณา, ไอคอนโซเชียล, รูปข่าวที่เกี่ยวข้อง) หากใช้แค่ Regex ดึง `<img>` ทั้งหมดมาใส่ Google Docs เอกสารจะเต็มไปด้วยรูปขยะทันที

วิธีที่ดีและฉลาดที่สุดคือการใช้ **"HTML Pre-filtering + Gemini Semantic Image Selection"** (รักษาแท็ก `<img>` เฉพาะที่มีความหมายไว้ แล้วให้ Gemini เป็นคนเลือกเฉพาะรูปที่เป็นเนื้อหาข่าว กราฟ หรืออินโฟกราฟิก) โดยมีขั้นตอนการปรับปรุงโค้ดดังนี้ครับ:

**1. ปรับปรุงฟังก์ชัน `cleanHtmlForAI` ให้เก็บแท็ก `<img>` และแปลงลิงก์รูปให้สมบูรณ์**
เว็บข่าวไทยหลายแห่งใช้ Lazy Loading (เก็บลิงก์รูปจริงไว้ใน `data-src` หรือ `data-original`) และบางแห่งใช้ Relative URL (เช่น `/uploads/chart1.jpg`) เราจึงต้องแปลงให้เป็นแท็ก `[IMAGE: https://... | alt="..."]` ก่อนลบ HTML แท็กอื่นๆ ทิ้ง เพื่อให้ Gemini มองเห็นตำแหน่งและคำอธิบายรูปภาพควบคู่ไปกับเนื้อหาข่าว:

```javascript
function cleanHtmlForAI(html, baseUrl) {
  if (!html) return "";
  let text = html;

  // 1. ลบส่วนที่ไม่ใช่เนื้อหาข่าว (แบนเนอร์ เมนู ฟุตเตอร์ ข่าวแนะนำ) ออกก่อนเพื่อกรองรูปขยะรอบนอกทิ้ง
  text = text.replace(
    /<(script|style|svg|nav|header|footer|aside|noscript|iframe|form)[^>]*>[\s\S]*?<\/\1>/gi,
    "",
  );

  // 2. สกัดเฉพาะใน <body>
  const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) text = bodyMatch[1];

  // หา Domain หลักเผื่อแปลง Relative Image URL ให้เป็น Full URL
  let origin = "";
  if (baseUrl) {
    const originMatch = baseUrl.match(/^(https?:\/\/[^\/]+)/i);
    if (originMatch) origin = originMatch[1];
  }

  // 3. แปลงแท็ก <img> ให้เป็น Text Marker ที่ AI อ่านเข้าใจ พร้อมดึงลิงก์จาก data-src (กรณี Lazy Load)
  text = text.replace(/<img\s+[^>]*>/gi, function (imgTag) {
    // ข้ามรูปไอคอนจิ๋ว โลโก้ หรือตัวติดตามพิกเซล
    if (/avatar|logo|icon|banner|ads|pixel|button|share|emoji/i.test(imgTag))
      return "";

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
      )
        return "";

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

  // 4. ลบ HTML Tags อื่นๆ ให้เหลือแต่ข้อความข่าวและ Marker รูปภาพ
  text = text.replace(/<\/(p|div|h[1-6]|li|br|figure|figcaption)>/gi, "\n");
  text = text.replace(/<[^>]+>/g, " ");
  text = text
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();

  if (text.length > 45000) text = text.substring(0, 45000);
  return text;
}
```

**2. ปรับฟังก์ชัน `fetchFullContentWithGemini` ให้คืนค่าทั้ง "เนื้อหาข่าว" และ "ลิงก์รูปภาพสำคัญ/กราฟ"**
เปลี่ยนจากการให้ Gemini ตอบกลับเป็นข้อความธรรมดา มาเป็น JSON ที่แยก `full_text` และอาร์เรย์ `content_images` โดยสั่งใน Prompt ให้ AI คัดเลือกเฉพาะรูปภาพที่อยู่ในลำดับเนื้อหาข่าว โดยเฉพาะรูปที่มีคำบรรยายหรือบริบทแวดล้อมเกี่ยวกับกราฟ ตาราง หรืออินโฟกราฟิก:

```javascript
function fetchFullContentAndImagesWithGemini(htmlOrUrl, apiKey, urlForLog) {
  try {
    let rawHtml = htmlOrUrl;
    if (htmlOrUrl && htmlOrUrl.toString().trim().indexOf("http") === 0) {
      rawHtml = fetchXml(htmlOrUrl);
    }
    const cleanedText = cleanHtmlForAI(rawHtml, urlForLog);
    if (!cleanedText) {
      return {
        fullText: "ไม่สามารถดึงข้อมูลเนื้อหาหลักของข่าวได้",
        imageUrls: [],
      };
    }

    const p = PropertiesService.getScriptProperties();
    const modelName = p.getProperty(PROP_MODEL_NAME) || "gemini-1.5-flash";
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;

    const prompt = `
You are a news transcription and visual content extraction assistant.
Read the raw webpage text of a Thai news article (which includes [IMAGE_CANDIDATE: url | ALT: description] markers) and extract:
1. "full_text": The complete, detailed Thai news article body text (exclude ads, menus, related news, and remove the [IMAGE_CANDIDATE] markers from the text).
2. "content_images": An array of image URLs (maximum 4 images) selected ONLY from the [IMAGE_CANDIDATE] markers that appear INSIDE the main article body and represent important news photos, charts, graphs, tables, or infographics summarizing the news.
   - STRICTLY EXCLUDE site logos, author avatars, social media icons, advertisements, or thumbnails of other unrelated news articles.

Output ONLY valid JSON matching this schema:
{
  "full_text": "string",
  "content_images": ["string"]
}`;

    const payload = {
      contents: [
        {
          parts: [
            { text: prompt },
            { text: "Webpage content:\n" + cleanedText },
          ],
        },
      ],
      generationConfig: { responseMimeType: "application/json" },
    };

    const options = {
      method: "post",
      contentType: "application/json; charset=utf-8",
      headers: { "x-goog-api-key": apiKey },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(geminiUrl, options);
    const responseJson = JSON.parse(response.getContentText());

    if (
      responseJson.candidates &&
      responseJson.candidates[0].content.parts[0].text
    ) {
      const result = JSON.parse(
        responseJson.candidates[0].content.parts[0].text,
      );
      return {
        fullText: (result.full_text || "").trim(),
        imageUrls: Array.isArray(result.content_images)
          ? result.content_images
          : [],
      };
    }
  } catch (e) {
    Logger.log(
      "ERROR extracting full content & images for " +
        urlForLog +
        ": " +
        e.toString(),
    );
  }
  return {
    fullText: "ไม่สามารถถอดรายละเอียดข่าวฉบับเต็มโดย AI ได้",
    imageUrls: [],
  };
}
```

**3. สร้างฟังก์ชันดึงภาพทั้งหมด (รวมภาพปก + ภาพกราฟในข่าว) พร้อมกรองขนาดไฟล์และรองรับ `.webp**`
เพื่อป้องกันไม่ให้มีรูปไอคอนเล็กๆ หลุดรอดมาได้อีกชั้น เราสามารถเช็คขนาดไฟล์ (`blob.getBytes().length`) ว่าต้องใหญ่กว่า 10 KB และใช้ `wsrv.nl`แปลงไฟล์`.webp`เป็น`.jpg` อัตโนมัติ ताकिวางใน Google Docs ได้ทุกภาพ:

```javascript
function fetchAllArticleImages(html, articleUrl, aiSelectedUrls) {
  const imageUrls = new Set();

  // 1. ดึงภาพปกจาก og:image เป็นภาพแรก (ถ้ามี)
  if (html) {
    const match1 = html.match(
      /meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
    );
    const match2 = html.match(
      /meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i,
    );
    const ogUrl =
      match1 && match1[1] ? match1[1] : match2 && match2[1] ? match2[1] : null;
    if (ogUrl) imageUrls.add(ogUrl.trim().replace(/&amp;/g, "&"));
  }

  // 2. รวมภาพกราฟ/อินโฟกราฟิกในเนื้อหาที่ AI คัดเลือกมา (จำกัดรวมกันไม่เกิน 4 ภาพต่อข่าว)
  if (Array.isArray(aiSelectedUrls)) {
    aiSelectedUrls.forEach((u) => {
      if (u && imageUrls.size < 4)
        imageUrls.add(u.trim().replace(/&amp;/g, "&"));
    });
  }

  const blobs = [];
  imageUrls.forEach((rawUrl) => {
    try {
      // แปลงผ่าน wsrv.nl เสมอ यदिเป็น .webp หรือเพื่อให้ได้ไฟล์ .jpg มาตรฐานที่ Google Docs รองรับชัวร์ๆ
      let fetchUrl = rawUrl;
      if (
        rawUrl.toLowerCase().includes(".webp") ||
        rawUrl.toLowerCase().includes("format=webp")
      ) {
        fetchUrl =
          "https://wsrv.nl/?url=" + encodeURIComponent(rawUrl) + "&output=jpg";
      }

      const response = UrlFetchApp.fetch(fetchUrl, {
        muteHttpExceptions: true,
      });
      if (response.getResponseCode() === 200) {
        let blob = response.getBlob();
        const contentType = (blob.getContentType() || "").toLowerCase();

        // หากเซิร์ฟเวอร์ต้นทางส่ง Content-Type เป็น webp โดยไม่มีนามสกุลใน URL ให้ยิงผ่าน Proxy ซ้ำ
        if (contentType.includes("webp")) {
          const proxyResp = UrlFetchApp.fetch(
            "https://wsrv.nl/?url=" +
              encodeURIComponent(rawUrl) +
              "&output=jpg",
            { muteHttpExceptions: true },
          );
          if (proxyResp.getResponseCode() === 200) blob = proxyResp.getBlob();
          else return;
        }

        // กรองขนาดไฟล์: ข้ามรูปที่มีขนาดเล็กกว่า 10 KB (เช่น ไอคอน หรือปุ่มแชร์ที่อาจหลุดรอดมา)
        if (blob.getBytes().length > 10240) {
          blobs.push(blob);
        }
      }
    } catch (err) {
      Logger.log(
        "WARNING: โหลดรูปไม่สำเร็จ (" + rawUrl + "): " + err.toString(),
      );
    }
  });

  return blobs; // คืนค่าเป็น Array ของ Image Blobs
}
```

**4. ปรับส่วนการวางรูปใน `appendNewsToDoc` ให้รองรับหลายรูปภาพ**
เปลี่ยนพารามิเตอร์ตัวสุดท้ายจาก `imageBlob` เดี่ยวๆ เป็นอาร์เรย์ `imageBlobs` แล้ววนลูปวางเรียงกันลงมาใน Google Docs:

```javascript
// ใน appendNewsToDoc(doc, item, fullText, imageBlobs)
if (imageBlobs && imageBlobs.length > 0) {
  let headingAdded = false;
  imageBlobs.forEach((blob) => {
    try {
      const image = body.appendImage(blob);
      if (!headingAdded) {
        // แทรกหัวข้อก่อนภาพแรกเมื่อวางภาพสำเร็จแล้วเท่านั้น (ป้องกันหัวข้อค้างกรณีภาพเสีย)
        const imgIndex = body.getChildIndex(image.getParent());
        const imgHeading = body.insertParagraph(
          imgIndex,
          `📸 ภาพประกอบและอินโฟกราฟิก (${imageBlobs.length} ภาพ):`,
        );
        styleParagraph(imgHeading, "Cordia New", 14, "#000000", true, false);
        headingAdded = true;
      }

      const originalWidth = image.getWidth();
      const originalHeight = image.getHeight();
      const maxWidth = 450;
      if (originalWidth > maxWidth) {
        const ratio = maxWidth / originalWidth;
        image.setWidth(maxWidth);
        image.setHeight(originalHeight * ratio);
      }
    } catch (e) {
      Logger.log(
        "WARNING: ไม่สามารถแทรกรูปลงใน Google Doc ได้: " + e.toString(),
      );
    }
  });
}
```
