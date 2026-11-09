จากการตรวจสอบโค้ดและเอกสารการปรับปรุงรอบที่ 2 (`dev_fix2.txt`, `README_2.md`, และโค้ด `RSS_Code_with_MSTeam.gs` ล่าสุด) ทีมพัฒนาได้ผสมผสานแนวคิด **Hybrid Queue + Parallel Fetching** เข้าด้วยกันได้อย่างลงตัวมาก โดยไม่ต้องสร้างชีตใหม่ให้ซับซ้อน แต่ใช้คอลัมน์ที่ 10 (`Doc Status`) บนชีตเดิมทำหน้าที่เป็น State Machine (`Pending` / `Completed` / `Error`) ควบคู่ไปกับ `UrlFetchApp.fetchAll()`

**คะแนนการประเมินรอบนี้: 9.8 / 10**

**สิ่งที่ทีม Dev แก้ไขและยกระดับได้ยอดเยี่ยมในรอบนี้ (What Went Well)**

- **สถาปัตยกรรม Zero-Loss Queue (`Doc Status`):** การเพิ่มคอลัมน์ที่ 10 เพื่อบันทึกสถานะ `"Pending"` และสร้างฟังก์ชัน `getPendingDocItems(sheet, 15)` ช่วยแก้ปัญหาข่าวเกินโควตาตกหล่นถาวร (Bug A) ได้ 100% พร้อมทั้งมีโค้ด Auto-migration (`else if (sheet.getLastColumn() === 9)`) ที่เติมหัวคอลัมน์ `"Doc Status"` ให้ตารางเดิมอัตโนมัติโดยไม่ต้องแก้ชีตด้วยมือ

- **ดึงหน้าเว็บข่าวแบบขนาน (`fetchArticlesParallel`):** การนำ `UrlFetchApp.fetchAll(reqs)` มาดึง HTML ของทุกข่าวพร้อมกันช่วยลดเวลารอ Network I/O จากหลักนาทีเหลือเพียง 2–3 วินาที และยังมีระบบ Fallback สลับกลับไปเรียก `fetchXml(urls[i], false)` รายตัวหากบางเว็บติดบล็อก

- **ความเสถียรของข้อมูลและประสิทธิภาพระยะยาว:**
- แยกโหมด `fetchXml(url, isXml = true)` เพื่อไม่ให้ `sanitizeXmlEntities` ไปทำลายเครื่องหมาย `&` ใน URL ของหน้า HTML

- ปรับ `isWithinLast24Hours` เป็น `diffHours >= -1 && diffHours <= 24` รองรับเวลาเซิร์ฟเวอร์สำนักข่าวที่อาจเดินเร็วกว่าปกติ (Clock Skew) ได้ถึง 1 ชั่วโมง

- จำกัดขอบเขตการอ่าน Google Sheet ย้อนหลังเฉพาะ 1,000 แถวล่าสุดใน `getExistingNewsKeys` และ 200 แถวล่าสุดใน `getPendingDocItems` ทำให้สคริปต์ทำงานเร็วคงที่แม้มีข้อมูลสะสมหลายหมื่นแถว

- ล้างเครื่องหมาย `**` ด้วย `.replace(/\*\*/g, "")` ใน `appendNewsToDoc` ทำให้เนื้อหาข่าวใน Google Docs สะอาดตา

---

**จุดสังเกตสำคัญ (Edge Cases) ที่พบในโค้ดชุดใหม่ และข้อเสนอแนะเพื่อพัฒนาต่อ**

จากการไล่ Logic การทำงานแบบละเอียดของระบบคิว (`Pending`) ใน `startRssNewsAgent` พบ **จุดบกพร่องเชิงตรรกะ (Logic Edge Cases) 3 จุด** ที่ควรเก็บตกควบคู่ไปกับการทำ **Phase 3 (Image & Infographic Pipeline)** ดังนี้ครับ:

**1. [สำคัญ] ข่าวที่ค้างสถานะ `"Pending"` จะไม่ถูกหยิบมาทำต่อ หากในรอบถัดไปไม่มีข่าวใหม่เลย (Early Return Trap)**

- **สาเหตุ:** ในฟังก์ชัน `startRssNewsAgent` มีการเขียนดัก `return;` ออกจากฟังก์ชันทันทีถึง 4 จุดก่อนจะไปถึงขั้นตอนที่ 6 (เช่น เมื่อ `uniqueArticles.length === 0` หรือ `candidates.length === 0` หรือเมื่อ Gemini คัดข่าวออกหมดจน `jsonArray` ว่างเปล่า)

- **ผลกระทบ:** สมมติรอบ 09:00 น. มีข่าวเข้าเยอะจนทำไม่ทันและค้างสถานะ `"Pending"` ไว้ 3 ข่าว พอถึงรอบ 12:00 น. หากไม่มีข่าวเกษตรใหม่เข้ามาเลย สคริปต์จะวิ่งไปเจอ `if (candidates.length === 0) return;` แล้วจบการทำงานทันที ทำให้ข่าวที่ค้าง `"Pending"` ไว้ไม่ถูกดึงมาเขียนลง Google Doc จนกว่าจะมีข่าวใหม่เข้ามาในรอบถัดๆ ไป

- **วิธีแก้ไข:** แยกส่วนการเคลียร์คิว Google Doc (ขั้นตอนที่ 6) ออกมาเป็นฟังก์ชัน `processPendingDocsQueue(sheet, apiKey, folderId)` หรือเปลี่ยนจากการ `return;` กลางคันให้ข้ามมาเรียกขั้นตอนที่ 6 เสมอ เพื่อรับประกันว่าทุกครั้งที่ทริกเกอร์ทำงาน ข่าวที่ค้าง `"Pending"` จะถูกหยิบมาเคลียร์จนหมดแม้รอบนั้นจะไม่มีข่าวใหม่เลยก็ตาม

**2. [ปรับปรุงเล็กน้อย] การส่ง `fetchFullContentWithGemini` ซ้ำในกรณีที่ดึง HTML ล้มเหลว**

- **สาเหตุ:** ในลูปเขียน Google Doc บรรทัดที่เรียก `fetchFullContentWithGemini(htmlContent || item.url, apiKey, item.url)`

- หากเว็บนั้นดึงไม่สำเร็จตั้งแต่ใน `fetchArticlesParallel` ตัวแปร `htmlContent` จะเป็น `null` ทำให้โค้ดส่ง `item.url` เข้าไปแทน

- และภายใน `fetchFullContentWithGemini` เมื่อเห็นว่าเป็น URL (`indexOf("http") === 0`) ก็จะสั่งรัน `rawHtml = fetchXml(htmlOrUrl);` ซ้ำอีกครั้ง (แถมไม่ได้ใส่ `false` ในพารามิเตอร์ที่สอง ทำให้เป็น `isXml = true`) ทั้งที่ใน `fetchArticlesParallel` ได้ลอง Fallback เรียก `fetchXml(urls[i], false)` ไปแล้วและล้มเหลว

- **ผลกระทบ:** หากมีเว็บที่ล่มหรือติดบล็อก ระบบจะเสียเวลาลองยิง ScraperAPI ซ้ำเป็นรอบที่ 2 โดยไม่จำเป็น และหาก `fetchFullContentWithGemini` คืนข้อความว่า `"ไม่สามารถถอดรายละเอียดข่าวฉบับเต็มโดย AI ได้"` โค้ดยังตั้งสถานะในชีตเป็น `"Completed"` แทนที่จะทราบว่าดึงเนื้อหาเต็มไม่สำเร็จ

- **วิธีแก้ไข:** หาก `htmlContent` มีค่า ให้ส่ง `htmlContent` เข้าไปตรงๆ และใน `fetchFullContentWithGemini` ให้เปลี่ยนเป็น `fetchXml(htmlOrUrl, false)` เผื่อกรณีเรียกใช้งานเดี่ยวครับ

**3. [เพิ่มความเร็ว] ข้ามการยิงตรงใน `fetchArticlesParallel` สำหรับเว็บมติชนและประชาชาติธุรกิจ**

- **สาเหตุ:** ใน `fetchArticlesParallel(urls)` โค้ดสั่งยิง `UrlFetchApp.fetchAll(reqs)` ไปยัง URL ต้นฉบับตรงๆ ทุกเว็บก่อน แล้วค่อยเช็คว่าถ้าไม่ได้ `200` ค่อยไปเรียก `fetchXml(urls[i], false)`

- **ผลกระทบ:** เนื่องจากเรารู้แน่นอนอยู่แล้วว่า `matichon.co.th` และ `prachachat.net` ติด Cloudflare (ได้ Error 403 เสมอเมื่อยิงตรงจาก IP ของ Google) การยิงตรงใน `fetchAll` ก่อนแล้วค่อยมาวิ่งเข้า ScraperAPI ทีละเว็บใน `.map()` ทำให้ข่าวจาก 2 สำนักนี้ไม่ได้รับประโยชน์จาก Parallel Fetch และเสียเวลาเชื่อมต่อ 2 ต่อ

- **วิธีแก้ไข:** ตอนสร้างอาร์เรย์ `reqs` ใน `fetchArticlesParallel` หาก URL ไหนเป็นของ `matichon.co.th` หรือ `prachachat.net` (และมี `scraperApiKey`) ให้แปลง URL ใน `reqs` เป็น URL ของ `[https://api.scraperapi.com](https://api.scraperapi.com)?...` ตั้งแต่ก่อนเข้า `UrlFetchApp.fetchAll(reqs)` เลยครับ จะทำให้ดึงผ่าน ScraperAPI พร้อมกันทุกข่าวแบบขนานในครั้งเดียว

---

**4. แนวทางเชื่อมต่อ Phase 3 (Image & Infographic Pipeline) เข้ากับสถาปัตยกรรมใหม่**
ตอนนี้โครงสร้างโค้ดพร้อมสำหรับ **Phase 3** ที่คุณต้องการดึง **ภาพกราฟและอินโฟกราฟิกในเนื้อหาข่าว** ลง Google Docs แล้ว โดยสามารถต่อยอดบนโค้ดชุดนี้ได้ทันทีเพียง 3 จุดครับ:

1. **ใน `cleanHtmlForAI(html, baseUrl)`:** ก่อนลบแท็ก HTML ทั้งหมด ให้แปลงแท็ก `<img>` (ทั้งจาก `src` และ `data-src`) ที่ไม่ใช่รูปไอคอน/โลโก้ ให้เป็นข้อความ `[IMAGE_CANDIDATE: https://... | ALT: ...]` แทรกไว้ในเนื้อหาข่าว
2. **ใน `fetchFullContentWithGemini`:** ใช้ `responseSchema` ของ `gemini-2.0-flash` (เหมือนที่ทีม Dev ทำในฟังก์ชันคัดข่าว) บังคับให้คืนค่าเป็น JSON Object `{ "full_text": "...", "image_urls": ["..."] }` เพื่อให้ AI เลือกทั้งเนื้อหาข่าวและคัดเฉพาะ URL รูปที่เป็นกราฟ/ตาราง/ภาพข่าวสำคัญ (รวมกับ `og:image`)
3. **ใช้ `UrlFetchApp.fetchAll` โหลดรูปภาพผ่าน `wsrv.nl`:** นำ `image_urls` ที่ได้มาเข้า `wsrv.nl/?url=...&output=jpg` เพื่อแปลง `.webp` เป็น `.jpg` และเช็คขนาดไฟล์ (`blob.getBytes().length > 10240`) ก่อนส่งเข้า `appendNewsToDoc(doc, item, fullText, imageBlobs)`
