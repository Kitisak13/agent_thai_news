# แผนการอัปเดตระบบดึงข้อมูลข่าวข้าวผ่าน RSS และ Sitemap (RSS_Code.gs)

แผนงานนี้ระบุขั้นตอนการเพิ่มแหล่งข่าวใหม่ 4 แหล่งที่ผู้ใช้ต้องการเข้ามาในระบบของไฟล์ [RSS_Code.gs](file:///d:/Project/Thai%20News/RSS_Code.gs):
1. **โพสต์ทูเดย์ (Posttoday):** `https://api.posttoday.com/sitemap/latest`
2. **ฐานเศรษฐกิจ (Thansettakij):** `https://api.thansettakij.com/sitemap/latest`
3. **กรุงเทพธุรกิจ (Bangkokbiznews):** `https://api.bangkokbiznews.com/sitemap/latest`
4. **มติชน (Matichon):** `https://www.matichon.co.th/sitemap-news.xml`

---

## User Review Required

> [!NOTE]
> **การตรวจสอบโครงสร้างสิทธิ์ของสำนักข่าวใหม่:**
> - **โพสต์ทูเดย์, ฐานเศรษฐกิจ, กรุงเทพธุรกิจ, มติชน:** ทั้งหมดใช้งานรูปแบบ **Google News Sitemap** ซึ่งใช้ XML namespace `xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"`
> - เราได้ทำการตรวจสอบเนื้อหา XML พบว่ามีข้อมูลแท็ก `<news:title>` และ `<news:publication_date>` ที่ระบุเวลาเผยแพร่อย่างชัดเจนในรูปแบบ ISO-8601 (เช่น `2026-07-23T09:42:57+07:00`)
> - เพื่อรองรับข่าวประเภทนี้ เราจะสร้างฟังก์ชันการทำงานใหม่ชื่อ `parseNewsSitemap` เพื่อให้สามารถดึงหัวข้อข่าว ลิงก์ และวันที่จริงจากโครงสร้าง Google News Sitemap ได้โดยไม่มีข้อผิดพลาด

---

## Proposed Changes

### [MODIFY] [RSS_Code.gs](file:///d:/Project/Thai%20News/RSS_Code.gs)

การแก้ไขจะประกอบไปด้วย:
1. **เพิ่มแหล่งข่าวใหม่ในอาเรย์ `feeds`:**
   เพิ่มแหล่งข่าวโพสต์ทูเดย์, ฐานเศรษฐกิจ, กรุงเทพธุรกิจ, และมติชน โดยระบุประเภทเป็น `"news_sitemap"`
2. **ปรับปรุงลูปประมวลผลหลัก `startRssNewsAgent()`:**
   เพิ่มเงื่อนไขรองรับกรณีที่ `feed.type === "news_sitemap"` ให้เรียกใช้ฟังก์ชัน `parseNewsSitemap`
3. **สร้างฟังก์ชันพาร์สเซอร์ใหม่ `parseNewsSitemap(xmlString, sourceName)`:**
   ถอดแท็กตาม Namespace ของ Google News Sitemap:
   - ดึงลิงก์ข่าวจาก `<loc>`
   - ดึงหัวข้อข่าวจาก `<news:title>`
   - ดึงเวลาเผยแพร่จริงจาก `<news:publication_date>`
   - ดึงคำอธิบายภาพสากลจาก `<image:caption>` เพื่อใช้เป็นเนื้อหากรองคำสำคัญ (Keyword Filter) เบื้องต้น

---

## Verification Plan

### Automated & Manual Verification
1. **การพาร์ส XML Sitemap:**
   - ทดสอบรันฟังก์ชัน `startRssNewsAgent` เพื่อเช็คการโหลด XML จากทั้ง 4 URL ใหม่ว่าสามารถดึงมาพาร์สหัวข้อและเวลาของข่าวได้สำเร็จหรือไม่
2. **การทำงานของตัวกรองวันที่และข่าวซ้ำ:**
   - ตรวจสอบว่าวันที่ที่ดึงจาก Google News Sitemap ถูกแปลงเข้าสู่เขตเวลาไทย (`Asia/Bangkok`) อย่างถูกต้อง และไม่มีผลลัพธ์เก่าเกิน 1 วันถูกส่งไปให้ Gemini
3. **การตรวจสอบผลลัพธ์ลง Google Sheet:**
   - สังเกตการบันทึกข่าวลงหน้าชีต `RSS` ว่าได้ข้อมูลของสำนักข่าวใหม่เหล่านี้แสดงขึ้นมาอย่างครบถ้วนหรือไม่
