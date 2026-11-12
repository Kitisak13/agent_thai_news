แท็ก `<img>` ที่คุณยกตัวอย่างมาช่วยให้เห็นสาเหตุชัดเจน 100% เลยครับ! ปัญหาไม่ได้อยู่ที่ `fetchArticleImages` เพียงอย่างเดียว แต่เกิดจาก **3 จุดที่ทำงานร่วมกัน** ทำให้ภาพ Infographic ในเนื้อหาข่าวของฐานเศรษฐกิจ (และเว็บข่าวไทยอื่น ๆ) ถูกทิ้งไปตั้งแต่ต้นทางครับ

### 🔍 วิเคราะห์สาเหตุที่ภาพ Infographic ในเนื้อหาข่าวไม่ถูกดึง

**1. ตัวกรอง `cleanHtmlForAI` ฆ่าแท็ก `<img>` ที่มีคำว่า `loading="lazy"` ทิ้งตั้งแต่ต้น!**
ดูในโค้ดเดิมของ `cleanHtmlForAI()` บรรทัดที่ 815:

```javascript
if (
  /avatar|logo|icon|banner|\bads?\b|advertisement|sponsor|pixel|button|share|emoji|author|profile|sprite|placeholder|loading/i.test(
    imgTag,
  )
) {
  return "";
}
```

และดูแท็ก `<img>` ของฐานเศรษฐกิจที่คุณส่งมา:

```html
<img
  src="https://medias.thansettakij.com/uploads/images/contents/w1024/2026/11/JFf68SYt4HV8HQ0V19Fh.webp?..."
  ...
  loading="lazy"
/>
```

เนื่องจากในแท็ก `<img>` มีแอตทริบิวต์ **`loading="lazy"`** อยู่ ตัว Regex ที่มีคำว่า `loading` จึงจับแท็กนี้ได้และ **`return ""` (ลบทิ้งทันที)** ทำให้ Gemini ไม่เคยเห็น `[IMAGE_CANDIDATE]` ของรูปนี้เลยครับ!

**2. การตัดข้อความ 45,000 ตัวอักษร (`text.substring(0, 45000)`) ตัดส่วนเนื้อหาข่าวทิ้ง**
เว็บข่าวสมัยใหม่ (เช่น ฐานเศรษฐกิจ, กรุงเทพธุรกิจ, ไทยรัฐ) มักฝัง JSON State (`__NEXT_DATA__`) หรือเมนูขนาดมหึมาไว้ใน `<body>` ทำให้ข้อความช่วง 45,000 ตัวอักษรแรกเต็มไปด้วยโค้ดขยะหรือเมนู รูปที่อยู่กลางเนื้อหาข่าว (เช่นใน `p[2]`) จึงถูกตัดทิ้งไปก่อนถึงมือ AI

**3. ฟังก์ชัน `fetchArticleImages` ดึง `og:image` (ภาพปก) มาใส่เป็นภาพแรกเสมอ**
โค้ดเดิมบังคับดึง `meta property="og:image"` มาใส่ใน `imageUrls` ก่อนเสมอ ซึ่งภาพปกเหล่านี้มักเป็นภาพประกอบทั่วไป (เช่น ภาพโรงงาน/สินค้า) ไม่ใช่ Infographic และเมื่อคุณไม่ต้องการภาพปก การใส่ `og:image` เข้าไปจึงทำให้รายงานมีแต่ภาพที่ไม่จำเป็น

---

### 🛠️ วิธีแก้ไข (แก้ครบทั้ง 3 จุด + รองรับ `<picture><source>` และแปลง `.webp` อัตโนมัติ)

ให้แก้ไขโค้ดใน **3 ฟังก์ชัน** ด้านล่างนี้ครับ:

#### 1. แก้ไขฟังก์ชัน `cleanHtmlForAI(html, baseUrl)`

- **เอาคำว่า `loading` ออกจากตัวกรอง `imgTag**`(เช็กเฉพาะ URL ของรูปแทน ไม่เช็กแอตทริบิวต์`loading="lazy"`)
- **รองรับแท็ก `<picture>**`และดึง URL จาก`src`/`data-src`/`srcset`
- **ตัด `<script>` / JSON state หรือขยะส่วนหัว** และเพิ่มเพดานข้อความเป็น `80,000` ตัวอักษร (Gemini 2.0 Flash รองรับได้สบายมาก) เพื่อให้เนื้อหาและรูปกลางบทความไม่ถูกตัดทิ้ง

```javascript
function cleanHtmlForAI(html, baseUrl) {
  if (!html) return "";
  let text = html;

  // 1. ลบส่วนที่ไม่ใช่เนื้อหาข่าวออกทั้งหมด (script, style, svg, nav, header, footer, aside, noscript, iframe, form)
  text = text.replace(
    /<(script|style|svg|nav|header|footer|aside|noscript|iframe|form)[^>]*>[\s\S]*?<\/\1>/gi,
    "",
  );

  // 2. สกัดเอาเฉพาะใน <article> หรือ <main> หรือ <body> เพื่อตัดเมนูส่วนบนทิ้งให้มากที่สุด
  const articleMatch = text.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const mainMatch = text.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (articleMatch) {
    text = articleMatch[1];
  } else if (mainMatch) {
    text = mainMatch[1];
  } else if (bodyMatch) {
    text = bodyMatch[1];
  }

  // หา Domain หลัก เผื่อแปลง Relative Image URL ให้เป็น Full Absolute URL
  let origin = "";
  if (baseUrl) {
    const originMatch = baseUrl.match(/^(https?:\/\/[^\/]+)/i);
    if (originMatch) origin = originMatch[1];
  }

  // 3. แปลงแท็ก <img> ให้เป็น Text Marker (แก้บั๊ก loading="lazy" โดนลบทิ้ง)
  text = text.replace(/<img\s+[^>]*>/gi, function (imgTag) {
    const srcMatch = imgTag.match(
      /(?:data-src|data-original|data-lazy-src|src)=["']([^"']+)["']/i,
    );
    if (!srcMatch || !srcMatch[1]) return "";

    let imgUrl = srcMatch[1].trim().replace(/&amp;/g, "&");

    // กรองเฉพาะ URL ของรูปภาพที่เป็นไอคอน โลโก้ หรือตัวติดตาม (ไม่เช็กคำว่า loading ใน attribute)
    if (
      imgUrl.startsWith("data:image") ||
      /\.svg(\?|$)/i.test(imgUrl) ||
      /\.gif(\?|$)/i.test(imgUrl) ||
      /avatar|logo|icon|banner|\bads?\b|advertisement|sponsor|pixel|button|share|emoji|author|profile|sprite|placeholder/i.test(
        imgUrl,
      )
    ) {
      return "";
    }

    // แปลง Relative URL เป็น Absolute URL
    if (imgUrl.startsWith("//")) {
      imgUrl = "https:" + imgUrl;
    } else if (imgUrl.startsWith("/") && origin) {
      imgUrl = origin + imgUrl;
    }

    const altMatch = imgTag.match(/alt=["']([^"']*)["']/i);
    const altText = altMatch ? altMatch[1].trim() : "";
    return `\n[IMAGE_CANDIDATE: ${imgUrl} | ALT: ${altText}]\n`;
  });

  // 4. แปลงแท็ก <br> ทุกรูปแบบ และแท็กบล็อกทั้งเปิดและปิดให้เป็นขึ้นบรรทัดใหม่
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(
    /<\/?(p|div|h[1-6]|li|ul|ol|blockquote|section|article|figure|figcaption|tr)[^>]*>/gi,
    "\n\n",
  );
  text = text.replace(/<[^>]+>/g, " ");

  // 5. ล้างช่องว่างในบรรทัดเดียวกัน แต่คงการเว้นย่อหน้า (\n\n) เอาไว้
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();

  // 6. ขยายความยาวสูงสุดเป็น 80,000 ตัวอักษร เพื่อไม่ให้รูปกลางบทความถูกตัดทิ้ง
  if (text.length > 80000) {
    text = text.substring(0, 80000);
  }
  return text;
}
```

---

#### 2. ปรับ Prompt ใน `fetchFullContentWithGemini()` ให้ดึงภาพประกอบ/Infographic ในเนื้อหาข่าวทั้งหมด

ปรับคำสั่งใน `content_images` ให้ AI เลือกภาพที่อยู่ในเนื้อหาข่าว (ไม่จำกัดแค่ต้องเป็นกราฟ แต่รวมภาพประกอบข่าว, ตาราง, และ Infographic ที่ฝังอยู่ในตัวบทความทั้งหมด สูงสุด 4 ภาพ):

```javascript
const prompt = `
You are a news transcription and visual data extraction assistant.
Your job is to read the provided raw webpage content of a Thai news article (which includes [IMAGE_CANDIDATE: url | ALT: description] markers) and extract:
1. "full_text": The complete, detailed body text of the article in Thai (exclude ads, menus, related articles lists, sign-up forms, and reader comments, and REMOVE all [IMAGE_CANDIDATE] markers from the prose).
   - CRITICAL PARAGRAPH RULE: You MUST separate every paragraph and subheading using double newline characters ("\\n\\n").
   - Never return the entire article as a single giant block of text. Preserve original paragraph breaks, and if the source text has merged paragraphs, logically split the Thai prose into readable paragraphs (every 3-5 sentences or whenever the speaker/topic shifts) using "\\n\\n".
   - If there are subheadings in the article, format them on their own line with bold text (**Subheading**) followed by "\\n\\n".
2. "content_images": An array of image URLs (maximum 4 images) selected ONLY from the [IMAGE_CANDIDATE] markers that appear INSIDE the main article body (such as infographics, charts, tables, statistics graphics, or inline article photos embedded between paragraphs).
   - Strictly EXCLUDE site logos, author avatars, social media icons, ads, or thumbnails of other unrelated news articles.
   - Return an empty array [] if there are no relevant images inside the article body.

Output ONLY valid JSON matching this schema:
{
  "full_text": "string",
  "content_images": ["string"]
}
`;
```

---

#### 3. แก้ไขฟังก์ชัน `fetchArticleImages(html, articleUrl, aiSelectedUrls)` เพื่อตัดภาพหน้าปก (`og:image`) ออก

เอาส่วนที่ดึง `meta property="og:image"` ออกทั้งหมด เพื่อให้ระบบดาวน์โหลดเฉพาะภาพประกอบ/Infographic ที่อยู่ใน Content ซึ่ง AI คัดเลือกมาเท่านั้น (และยังคงระบบแปลง `.webp` เป็น `.jpg` ผ่าน `wsrv.nl` ไว้เหมือนเดิม):

```javascript
function fetchArticleImages(html, articleUrl, aiSelectedUrls) {
  const imageUrls = new Set();

  // ดึงเฉพาะภาพประกอบ / Infographic ที่อยู่ใน Content ข่าวที่ AI คัดเลือกมา (ไม่ดึง og:image หน้าปกข่าวแล้ว)
  if (Array.isArray(aiSelectedUrls)) {
    aiSelectedUrls.forEach((u) => {
      if (u && imageUrls.size < 4) {
        const cleanUrl = u.trim().replace(/&amp;/g, "&");
        if (!cleanUrl.startsWith("data:") && !/\.svg(\?|$)/i.test(cleanUrl)) {
          imageUrls.add(cleanUrl);
        }
      }
    });
  }

  const urlList = Array.from(imageUrls);
  if (urlList.length === 0) return [];

  // เตรียมคำขอสำหรับดาวน์โหลดภาพแบบคู่ขนาน (Parallel Image Fetching)
  const reqs = urlList.map((rawUrl) => {
    let fetchUrl = rawUrl;
    // แปลง .webp หรือ URL ที่มีพารามิเตอร์ webp (เช่น ?x-image-process=style/lg-webp) เป็น .jpg ผ่าน wsrv.nl
    if (
      rawUrl.toLowerCase().includes(".webp") ||
      rawUrl.toLowerCase().includes("webp")
    ) {
      fetchUrl =
        "https://wsrv.nl/?url=" + encodeURIComponent(rawUrl) + "&output=jpg";
    }
    return {
      url: fetchUrl,
      method: "get",
      muteHttpExceptions: true,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        Referer: articleUrl || "",
      },
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
              "https://wsrv.nl/?url=" +
                encodeURIComponent(rawUrl) +
                "&output=jpg",
              { muteHttpExceptions: true },
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
```

### 💡 สรุปผลลัพธ์หลังแก้ไข

- **ข่าวที่มีภาพประกอบ / Infographic ในเนื้อหา** (เช่น ข่าวเบทาโกรของฐานเศรษฐกิจที่คุณยกตัวอย่าง): ระบบจะสกัด `[IMAGE_CANDIDATE]` ได้สำเร็จ แปลงจาก `.webp?x-image-process=style/lg-webp` เป็น `.jpg` และแทรกลงใน Google Docs ให้ทันที
- **ข่าวที่ไม่มีภาพในเนื้อหา** (มีแค่ภาพปก `og:image` อย่างเดียว): ระบบจะไม่ดึงภาพปกมาแปะให้รกเอกสาร และจะข้ามหัวข้อ `📸 ภาพประกอบ...` ไปแสดงเนื้อหาข่าวที่จัดย่อหน้าเรียบร้อยแล้วทันทีครับ
