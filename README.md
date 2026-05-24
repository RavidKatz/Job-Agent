# מערכת סוכן משרות - MVP

זהו בסיס ראשוני למערכת חיפוש עבודה חכמה.
המערכת מקבלת קורות חיים כטקסט, מקבלת רשימת משרות, מחשבת אחוז התאמה, ומייצאת רק משרות שעוברות את סף ההתאמה.

## עבודה ב-VS Code

פתח את התיקייה הזו ב-VS Code:

```powershell
code C:\Users\רביד\Documents\Codex\2026-05-24\new-chat\job-agent
```

לאחר מכן אפשר להריץ מתוך הטרמינל:

```powershell
.\start.ps1
```

האפליקציה המקומית תעלה בכתובת:

```text
http://127.0.0.1:4317
```

אפשר גם להפעיל ולפתוח אוטומטית:

```powershell
.\open-app.ps1
```

אפשר גם להריץ דרך VS Code:

```text
Terminal > Run Task > Start Job Agent
```

## מה יש כרגע

- קובץ הגדרות חיפוש: `config/search-profile.json`
- קובץ מקורות משרות: `config/sources.json`
- קובץ קורות חיים לדוגמה: `data/resume.example.txt`
- קובץ משרות לדוגמה: `data/jobs.sample.json`
- ממשק העלאת קורות חיים: `public/index.html`
- שרת מקומי: `server.mjs`
- חילוץ טקסט מ-PDF/DOCX/TXT: `scripts/extract_resume.py`
- ניתוח פרופיל והמלצת סוגי משרות: `src/role-recommender.mjs`
- מחברי משרות פתוחים: `src/connectors/remotive.mjs`, `src/connectors/himalayas.mjs`, `src/connectors/hiremetech.mjs`
- מנוע דירוג התאמה: `src/matcher.mjs`
- יצוא תוצאות ל-JSON ול-CSV: `outputs/matches.json`, `outputs/matches.csv`

## הרצה

ממשק מקומי:

```powershell
.\start.ps1
```

פתיחה אוטומטית:

```powershell
.\open-app.ps1
```

CLI:

מתוך תיקיית `job-agent`:

```powershell
.\run.ps1
```

או עם קבצים משלך:

```powershell
.\run.ps1 --resume data/my-resume.txt --jobs data/jobs.json
```

או עם מקורות מתוך קובץ הגדרות:

```powershell
.\run.ps1 --resume data/my-resume.txt --sources config/sources.json
```

## מבנה משרה

```json
{
  "company": "Company name",
  "title": "Job title",
  "location": "Israel, Hybrid",
  "workMode": "Hybrid",
  "source": "LinkedIn / Company site / Manual",
  "applyUrl": "https://example.com/apply",
  "postedAt": "2026-05-24",
  "description": "Job description text"
}
```

הקובץ לדוגמה כולל משרות דמה בלבד.

כדי שכפתור ההגשה יפתח משרה אמיתית, יש להזין קישור אמיתי בשדה הבא:

`applyUrl`

## השלב הבא

כדי להפוך את זה לסוכן מלא:

1. להחליף את `data/resume.example.txt` בקורות החיים האמיתיים.
2. לתת למערכת לנתח את הפרופיל ולהציע סוגי תפקידים.
3. לחפש משרות לפי מונחי החיפוש שנוצרו מתוך קורות החיים.
4. לעדכן את Google Sheets עם התוצאות שעוברות `75%`.
5. להוסיף התאמת קורות חיים ומכתב פנייה לכל משרה.

המערכת בנויה כך שאפשר להוסיף בהמשך מחברי חיפוש נפרדים לכל אתר, בלי לשנות את מנוע הדירוג.

## ניתוח פרופיל

המערכת מחלצת מתוך קורות החיים:

- כישורים וכלים מרכזיים.
- שנות ניסיון אם הן מופיעות בקובץ.
- רמת ניסיון משוערת.
- סוגי תפקידים שמתאימים לפרופיל.
- מונחי חיפוש דינמיים עבור מקורות המשרות.

לאחר מכן המערכת משתמשת במונחי החיפוש האלה כדי למצוא משרות קרובות יותר לניסיון ולאופי הפרופיל.

## חיבור API

מקורות מוגדרים בקובץ `config/sources.json`.
מקור מסוג `file` קורא קובץ JSON מקומי.
מקור מסוג `jsonApi` קורא API שמחזיר JSON וממפה שדות למבנה אחיד של משרה.
מקור מסוג `remotive` מחפש משרות מרחוק דרך API פתוח.
מקור מסוג `himalayas` מחפש משרות מרחוק דרך API פתוח.
מקור מסוג `hiremetech` מחפש משרות בישראל דרך מקור הנתונים של HireMeTech.
מקור מסוג `searchPage` יוצר קישורי חיפוש מדויקים לאתרים שאין להם API ציבורי פתוח.

דוגמה ל-API:

```json
{
  "id": "custom-json-api",
  "name": "Custom JSON jobs API",
  "type": "jsonApi",
  "enabled": true,
  "url": "https://api.example.com/jobs?q=PMO&location=Israel",
  "headers": {
    "Authorization": "Bearer ${JOB_API_TOKEN}"
  },
  "arrayPath": "jobs",
  "fieldMap": {
    "company": "company.name",
    "title": "title",
    "location": "location",
    "workMode": "workMode",
    "applyUrl": "applyUrl",
    "postedAt": "postedAt",
    "description": [
      "description",
      "requirements"
    ]
  }
}
```

לפני ההרצה מגדירים Token:

```powershell
$env:JOB_API_TOKEN = "your-token"
.\run.ps1
```

## סטטוס אתרי משרות

- `LinkedIn`: הממשקים הרשמיים פתוחים בעיקר לשותפים מאושרים ולמערכות ATS/פרסום משרות. זה לא API ציבורי רגיל לחיפוש משרות למועמד.
- `AllJobs`: לא נמצא תיעוד API ציבורי רשמי. צריך API/Feed מאושר, יצוא נתונים, או אישור אינטגרציה.
- `Drushim`: לא נמצא תיעוד API ציבורי רשמי. צריך API/Feed מאושר, יצוא נתונים, או אישור אינטגרציה.
- `Remotive`: מחובר כמקור API פתוח למשרות מרחוק.
- `Himalayas`: מחובר כמקור API פתוח למשרות מרחוק.
- `HireMeTech`: מחובר כמקור משרות בישראל עם קישורים ישירים לעמודי המשרה.

המערכת מוכנה לקלוט כל מקור חוקי שמחזיר JSON, גם אם הוא מגיע מספק חיצוני, Feed של חברה, או יצוא מאתר משרות.
