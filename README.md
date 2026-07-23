# AI-Powered Thai Agricultural News Aggregator (Gemini & GAS)

An automated news intelligence system built on Google Apps Script (GAS) that pulls, filters, and analyzes Thai agricultural and agricultural policy news (covering Rice, Corn, Cassava, Wheat, Animal Feed, and logistics/trade policies) from top Thai news portals. The system leverages the **Gemini API** for intelligent classification and sends notifications to **Email** and **Microsoft Teams**.

---

## 🚀 Key Features

* **Multi-Source Fetching:** Crawls direct XML RSS feeds and Google News Sitemaps from 7 major Thai news networks:
  * Manager Online (RSS)
  * Naewna (RSS)
  * Thairath (Daily Sitemap)
  * Posttoday (News Sitemap)
  * Thansettakij (News Sitemap)
  * Bangkokbiznews (News Sitemap)
  * Matichon (News Sitemap)
  * Prachachat Turakij (News Sitemap)
* **Customizable Keyword Pre-filtering:** Automatically filters news items inside Google Apps Script before calling the AI model to minimize API token usage and cost.
* **Intelligent AI Analysis (Gemini):** Classifies news categories, translates headlines, summarizes key facts, extracts metrics (prices, quantities, budgets), and evaluates export impact level (`High`, `Medium`, `Low`).
* **Anti-Duplicate Sheet Engine:** Compares incoming news links and headlines with historical data in the Google Sheet to prevent recording duplicates.
* **Multi-Channel Notifications:**
  * **Email Notifications:** Rich HTML summaries sent to the user's inbox.
  * **Microsoft Teams Integration:** Grouped Adaptive Cards (v1.4) pushed to your Teams channel via Workflows Webhook.
* **Configurable Setup:** Target crops, keywords, and themes can be modified easily via configuration arrays at the top of the script.

---

## 📁 Repository Structure

* `RSS_Code_with_MSTeam.gs`: The complete Google Apps Script codebase.
* `artifacts/`: Project planning and implementation walkthrough reports.
  * [walkthrough.md](file:///d:/Project/Thai%20News/artifacts/walkthrough.md): Comprehensive guide on installation, trigger setup, and notification previews.
  * [implementation_plan.md](file:///d:/Project/Thai%20News/artifacts/implementation_plan.md): Historical project design details.

---

## 🛠️ Installation & Setup

For a step-by-step installation guide, please refer to [walkthrough.md](file:///d:/Project/Thai%20News/artifacts/walkthrough.md). Below is a summary of the configuration keys.

### Script Properties Config
Before running, navigate to **Project Settings** (⚙️) in your Google Apps Script project and add the following keys:

| Property Name | Description | Example / Recommended Value |
| --- | --- | --- |
| `GEMINI_API_KEY` | Your Google AI Studio API Key | `AIzaSy...` |
| `GEMINI_MODEL_NAME` | The Gemini model to run analysis | `gemini-1.5-flash` |
| `NOTIFICATION_EMAIL` | Destination email for updates | `your-email@domain.com` |
| `TEAMS_WEBHOOK_URL` | Microsoft Teams Workflows Webhook URL | `https://prod-123.westeurope.logic.azure.com...` |
| `SHEET_NAME` | Tab name where news will be saved | `RSS` |
| `SPREADSHEET_ID` | (Optional) Target sheet ID | *Empty if running from bounded script* |

---

## 📜 License
This project is for internal and educational purposes. News content crawled belongs to their respective publishing news agencies.
