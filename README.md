# Dori-bot — Telegram bot (Vercel + Firebase + Whisper)

## Bot nima qiladi
- `/start` — dorilar ro'yhatini menyu ko'rinishida chiqaradi, bosilganda rasm + ma'lumot ko'rsatadi
- Nomini yozib yuborsangiz — krilcha/lotincha, xato yozuv, `o'` ni `o` deb yozish kabi holatlarda ham topadi
- Ovozli xabar yuborsangiz — ovozni matnga aylantirib, xuddi shu tarzda qidiradi
- `/ma'lumot` (admin) — yangi dori qo'shish: nom → rasm (yoki `/yoq`) → ma'lumot matni
- `/delete` (admin) — ro'yxatdan birini tanlab o'chirish
- `/edit` (admin) — ro'yxatdan birini tanlab, rasm va matnini yangilash

> **Eslatma:** Telegram buyruqlarida apostrof (`'`) rasmiy ravishda ishlamaydi, shu sabab `/ma'lumot` va `/yo'q` bilan bir qatorda `/malumot` va `/yoq` (apostrofsiz) ham qabul qilinadi — ikkalasi ham ishlaydi.

---

## 1-qadam: Firebase loyihasi

1. https://console.firebase.google.com → **Add project** → nom bering (masalan `dori-bot`)
2. Chap menyudan **Build → Firestore Database** → **Create database** → istalgan mintaqa, **production mode**
3. Loyiha sozlamalari (⚙️ belgisi) → **Service accounts** → **Generate new private key** → JSON fayl yuklab olinadi
4. Bu JSON faylning **butun mazmunini bitta qatorga** yig'ing (masalan https://jsonformatter.org/json-minify orqali) — bu `FIREBASE_SERVICE_ACCOUNT` qiymati bo'ladi

## 2-qadam: OpenAI API kaliti

1. https://platform.openai.com/api-keys → **Create new secret key**
2. Kalitni saqlab qo'ying — bu `OPENAI_API_KEY`
3. Hisobingizda biroz balans/karta bog'langan bo'lishi kerak (Whisper juda arzon — bir daqiqalik ovoz ~$0.006)

## 3-qadam: GitHub'ga yuklash

```bash
cd dori-bot
git init
git add .
git commit -m "Dori bot - boshlang'ich versiya"
git branch -M main
git remote add origin https://github.com/FOYDALANUVCHI_NOMI/dori-bot.git
git push -u origin main
```

(`.env` fayli `.gitignore` orqali GitHub'ga tushmaydi — bu to'g'ri, sirlar u yerda bo'lmasligi kerak)

## 4-qadam: Vercel'ga deploy

1. https://vercel.com → **Add New → Project** → GitHub repo'ingizni tanlang → **Import**
2. **Environment Variables** bo'limiga quyidagilarni qo'shing:
   | Nomi | Qiymati |
   |---|---|
   | `BOT_TOKEN` | sizning bot tokeningiz |
   | `ADMIN_CHAT_ID` | `6283517295` |
   | `OPENAI_API_KEY` | 2-qadamda olingan kalit |
   | `FIREBASE_SERVICE_ACCOUNT` | 1-qadamda tayyorlangan bir qatorli JSON |
3. **Deploy** tugmasini bosing. Tugagach, sizga `https://dori-bot-xxxx.vercel.app` kabi manzil beriladi

## 5-qadam: Telegram webhook'ni o'rnatish

Brauzerda yoki terminalda quyidagi manzilni oching (`<TOKEN>` va `<VERCEL_URL>` ni o'zgartiring):

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<VERCEL_URL>/api/webhook
```

Masalan:
```
https://api.telegram.org/bot8573583397:AAGYta6yU9KW76KHPSnHQAm0mMUSjly5jSc/setWebhook?url=https://dori-bot-xxxx.vercel.app/api/webhook
```

`{"ok":true,"result":true,...}` javobi chiqsa — tayyor, bot ishlayapti!

Tekshirish uchun: `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`

---

## ⚠️ Xavfsizlik bo'yicha muhim eslatma

Bot tokeningiz avvalgi xabarda ochiq yozilgan edi. Agar bu suhbatni boshqa birov ko'rgan bo'lsa, ular botingizni to'liq boshqarib olishi mumkin. Tavsiya:

1. Telegram'da **@BotFather** → `/mybots` → botingizni tanlang → **API Token** → **Revoke current token**
2. Yangi tokenni faqat Vercel'ning Environment Variables bo'limiga kiriting, boshqa hech qayerga yozmang

## Lokal test qilish (ixtiyoriy)

```bash
npm install
cp .env.example .env   # va qiymatlarni to'ldiring
```

Vercel CLI orqali lokal serverless muhitda sinash mumkin: `npx vercel dev`
