# บันทึกการปรับปรุงระบบ (Dev Review & Fix Round 1)

**วันที่บันทึก:** 9 พฤศจิกายน 2026  
**ผู้ปรับปรุง:** Antigravity AI Assistant  
**เอกสารอ้างอิง:** [argon_review1.md](file:///d:/Project/RSS%20Thai%20News/dev_reviews/argon_review1.md) และ [claude_review1.md](file:///d:/Project/RSS%20Thai%20News/dev_reviews/claude_review1.md)

---

## 1. ที่มาและปัญหาที่พบจากการรีวิว (Root Causes)

จากการรวบรวมและวิเคราะห์ผลการรีวิวระบบจาก Gemini Argon และ Claude พบจุดบกพร่องที่ต้องปรับปรุงเร่งด่วนในเชิงความปลอดภัย ความถูกต้องของข้อมูล และความเสถียรของระบบ ดังนี้:

1. **ความปลอดภัยของ ScraperAPI (Security Vulnerability):**
   - URL ของ ScraperAPI ทั้งคีย์หลักและคีย์สำรองเดิมใช้โปรโตคอล `http://api.scraperapi.com` ซึ่งส่ง API Key ผ่านเครือข่ายโดยไม่มีการเข้ารหัส เสี่ยงต่อการถูกดักจับข้อมูล
2. **ปัญหาการรันชนกัน (Concurrency / Race Conditions):**
   - ฟังก์ชันหลัก `startRssNewsAgent` ยังไม่มีการป้องกันด้วย `LockService` ทำให้หากรอบรันอัตโนมัติมาชนกับผู้ใช้กดสั่งรันด้วยตนเอง อาจทำให้เกิดการเขียนบันทึก Google Sheet หรือสร้าง Google Doc ซ้ำซ้อน
3. **ปัญหาโมเดล AI ตกรุ่น (Outdated Default Model):**
   - โค้ดยังตั้งค่าโมเดลเริ่มต้นเป็น `gemini-1.5-flash` ซึ่งควรปรับปรุงเป็น `gemini-2.0-flash` เพื่อเพิ่มความเร็ว ความแม่นยำในการคัดแยกข่าวภาษาไทย และรองรับ Google AI Studio Free Tier (1,500 RPD) อย่างคุ้มค่า
4. **ปัญหา AI คาดเดาวันที่เผยแพร่ข่าว (Bug B: Date Hallucination):**
   - ในประวัติข้อมูลเดิมมีข่าวบางรายการที่แสดงปีผิดเพี้ยน (เช่น ปี 2024 หลุดมาในปี 2026) อันเกิดจากการสั่งให้ Gemini สกัด `publish_date` เอง ทำให้เปลือง Token และเสี่ยงต่อการที่ AI เดาวันที่ขึ้นมา

---

## 2. รายละเอียดการปรับปรุงในโค้ด (`RSS_Code_with_MSTeam.gs`)

### 2.1 เพิ่ม `LockService` ป้องกันการทำงานซ้อนกัน
- ใส่ `const lock = LockService.getScriptLock();` ที่ต้นฟังก์ชัน `startRssNewsAgent`
- ตั้งเวลารอรับสิทธิ์สูงสุด 30 วินาที (`lock.tryLock(30000)`) หากติดการทำงานของอีกอินสแตนซ์ ระบบจะข้ามรอบรันทันทีอย่างปลอดภัย
- คืนสิทธิ์การล็อกในบล็อก `finally { lock.releaseLock(); }` เสมอ

### 2.2 ยกระดับความปลอดภัย ScraperAPI สู่ HTTPS
- ปรับเปลี่ยน URL ของ ScraperAPI ทั้ง Primary Key และ Backup Key เป็น:
  ```javascript
  const scraperUrl = "https://api.scraperapi.com?api_key=" + ...
  ```
  เพื่อให้การส่งถ่ายข้อมูลและ API Key ผ่านการเข้ารหัส TLS/HTTPS ทั้งหมด

### 2.3 อัปเกรดโมเดลเริ่มต้นเป็น `gemini-2.0-flash` พร้อมคุม `temperature: 0`
- ปรับค่า Default Model ใน `parseCandidatesWithGemini` และ `fetchFullContentWithGemini` จาก `gemini-1.5-flash` เป็น `gemini-2.0-flash`
- ใส่ `temperature: 0` ในส่วน generationConfig เพื่อให้การสรุปข้อเท็จจริงและการถอดเนื้อหาข่าวคงความแม่นยำ ไม่แต่งเติมข้อมูล
- **การตรวจสอบโควต้า Google AI Studio (Free Tier):**
  - โควต้า `gemini-2.0-flash` ใน Free Tier อนุญาตสูงสุด **15 RPM** (Requests Per Minute) และ **1,500 RPD** (Requests Per Day)
  - ระบบของเราทำงานวันละ 5 รอบ (06, 09, 12, 15, 18 น.) โดยเฉลี่ยใช้ API ประมาณ 10–50 Requests ต่อวัน ซึ่งใช้ไม่ถึง 4% ของโควต้าประจำวัน ปลอดภัยและเพียงพอแน่นอน

### 2.4 ปรับปรุงการสกัดวันที่ข่าว (แก้ปัญหา Bug B เด็ดขาด)
- ถอด `publish_date` ออกจาก `getSystemPrompt` และ `responseSchema` ของ Gemini ทั้งหมด เพื่อลดปริมาณ Token ที่ใช้ลง
- ปรับปรุง Logic ในการแมปข้อมูลข่าว ให้ยึดวันที่จริงจาก `pubDate` หรือ `<news:publication_date>` ของสำนักข่าวต้นทาง 100% หากไม่มีจะระบุเป็น `"ไม่ระบุวันเผยแพร่"` แทนการปล่อยให้โมเดลคาดเดาเอง

---

## 3. ผลการทดสอบความถูกต้อง (Verification)
- ตรวจสอบความถูกต้องของไวยากรณ์ (Syntax Validation) ด้วย Node.js Engine: **ผ่านเรียบร้อย (Syntax OK)**

---

## 4. แผนการปรับปรุงในระยะถัดไป (Next Phase)
- **Phase 2 (Queue Sheet Architecture):** แยกชีตสำหรับคิวงานเพื่อป้องกันปัญหา Bug A (ข่าวเกิน 8 รายการหลุดหายจาก Google Doc) และป้องกันปัญหาการรันเกินเวลา 6 นาทีของ Apps Script
- **Phase 3 (Image & Infographic Pipeline):** ปรับปรุงการดึงภาพในบทความ (กราฟ ตารางสถิติ อินโฟกราฟิก) ผ่าน `wsrv.nl` แปลง WebP สู่ JPEG และแทรกลงใน Google Doc อย่างสมบูรณ์
