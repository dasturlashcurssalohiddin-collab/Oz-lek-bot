const { Telegraf, Markup } = require('telegraf');
const { db } = require('./firebaseAdmin');
const { findBestMatch } = require('./matcher');
const { transcribeVoice } = require('./whisper');

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = String(process.env.ADMIN_CHAT_ID);

function isAdmin(ctx) {
  return String(ctx.chat.id) === ADMIN_ID;
}

// ---------- Firestore yordamchi funksiyalar ----------

async function getAllMedicines() {
  const snap = await db.collection('medicines').orderBy('name').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function getSession(chatId) {
  const doc = await db.collection('admin_sessions').doc(String(chatId)).get();
  return doc.exists ? doc.data() : null;
}

async function setSession(chatId, data) {
  await db.collection('admin_sessions').doc(String(chatId)).set(data);
}

async function clearSession(chatId) {
  await db.collection('admin_sessions').doc(String(chatId)).delete();
}

// ---------- Xabar yuborish yordamchilari ----------

async function sendMenu(ctx) {
  const meds = await getAllMedicines();
  if (meds.length === 0) {
    return ctx.reply("Hozircha ro'yxatda dori yo'q.");
  }
  const buttons = meds.map((m) => [Markup.button.callback(m.name, `show_${m.id}`)]);
  return ctx.reply("Dorilar ro'yhati:", Markup.inlineKeyboard(buttons));
}

async function sendMedicine(ctx, med) {
  const caption = `*${med.name}*\n\n${med.info || ''}`;
  if (med.photoFileId) {
    await ctx.replyWithPhoto(med.photoFileId, { caption, parse_mode: 'Markdown' });
  } else {
    await ctx.reply(caption, { parse_mode: 'Markdown' });
  }
}

async function handleSearch(ctx, query) {
  const meds = await getAllMedicines();
  const result = findBestMatch(query, meds);
  if (result) {
    await sendMedicine(ctx, result.medicine);
  } else {
    await ctx.reply(`"${query}" nomli dori topilmadi.`);
  }
}

// ---------- /start ----------

bot.start(async (ctx) => {
  await ctx.reply(
    "Assalomu alaykum!\nKerakli dorini ro'yhatdan tanlang, nomini yozing yoki ovozli xabar yuboring."
  );
  await sendMenu(ctx);
});

// Menyudan bosilganda
bot.action(/^show_(.+)$/, async (ctx) => {
  const id = ctx.match[1];
  const doc = await db.collection('medicines').doc(id).get();
  await ctx.answerCbQuery();
  if (!doc.exists) return ctx.reply("Bu dori topilmadi (ehtimol o'chirilgan).");
  await sendMedicine(ctx, doc.data());
});

// ---------- /ma'lumot — yangi dori qo'shish (admin) ----------

bot.hears(/^\/(?:ma['’ʻ]?lumot|malumot)$/i, async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('Bu buyruq faqat admin uchun.');
  await setSession(ctx.chat.id, { step: 'awaiting_name', data: {} });
  await ctx.reply('Yangi dori nomini kiriting:');
});

// ---------- /delete — dorini o'chirish (admin) ----------

bot.command('delete', async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('Bu buyruq faqat admin uchun.');
  const meds = await getAllMedicines();
  if (meds.length === 0) return ctx.reply("Ro'yxat bo'sh.");
  const buttons = meds.map((m) => [Markup.button.callback(`❌ ${m.name}`, `del_${m.id}`)]);
  await ctx.reply("O'chirish uchun dorini tanlang:", Markup.inlineKeyboard(buttons));
});

bot.action(/^del_(.+)$/, async (ctx) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("Ruxsat yo'q");
  const id = ctx.match[1];
  await db.collection('medicines').doc(id).delete();
  await ctx.answerCbQuery("O'chirildi");
  await ctx.reply("✅ Dori ro'yxatdan o'chirildi.");
});

// ---------- /edit — dorini tahrirlash (admin) ----------

bot.command('edit', async (ctx) => {
  if (!isAdmin(ctx)) return ctx.reply('Bu buyruq faqat admin uchun.');
  const meds = await getAllMedicines();
  if (meds.length === 0) return ctx.reply("Ro'yxat bo'sh.");
  const buttons = meds.map((m) => [Markup.button.callback(`✏️ ${m.name}`, `edit_${m.id}`)]);
  await ctx.reply('Tahrirlash uchun dorini tanlang:', Markup.inlineKeyboard(buttons));
});

bot.action(/^edit_(.+)$/, async (ctx) => {
  if (!isAdmin(ctx)) return ctx.answerCbQuery("Ruxsat yo'q");
  const id = ctx.match[1];
  await ctx.answerCbQuery();
  await setSession(ctx.chat.id, { step: 'edit_awaiting_photo', data: { id } });
  await ctx.reply("Yangi rasm yuboring, yoki rasmni o'zgartirmaslik uchun /yoq deb yozing:");
});

// ---------- /yoq — rasmni o'tkazib yuborish (add/edit oqimlarida) ----------

bot.hears(/^\/(?:yo['’ʻ]?q|yoq)$/i, async (ctx) => {
  if (!isAdmin(ctx)) return;
  const session = await getSession(ctx.chat.id);
  if (!session) return;

  if (session.step === 'awaiting_photo_choice') {
    session.step = 'awaiting_info';
    session.data.photoFileId = null;
    await setSession(ctx.chat.id, session);
    return ctx.reply("Ma'lumot matnini kiriting:");
  }

  if (session.step === 'edit_awaiting_photo') {
    session.step = 'edit_awaiting_info';
    await setSession(ctx.chat.id, session);
    return ctx.reply("Yangi ma'lumot matnini kiriting (o'zgartirmaslik uchun yana /yoq deb yozing):");
  }

  if (session.step === 'edit_awaiting_info') {
    await clearSession(ctx.chat.id);
    return ctx.reply("Hech narsa o'zgartirilmadi.");
  }
});

// ---------- Rasm qabul qilish (add/edit oqimlarida) ----------

bot.on('photo', async (ctx) => {
  if (!isAdmin(ctx)) return;
  const session = await getSession(ctx.chat.id);
  if (!session) return;

  const photos = ctx.message.photo;
  const fileId = photos[photos.length - 1].file_id;

  if (session.step === 'awaiting_photo_choice') {
    session.data.photoFileId = fileId;
    session.step = 'awaiting_info';
    await setSession(ctx.chat.id, session);
    return ctx.reply("Endi ma'lumot matnini kiriting:");
  }

  if (session.step === 'edit_awaiting_photo') {
    session.data.photoFileId = fileId;
    session.step = 'edit_awaiting_info';
    await setSession(ctx.chat.id, session);
    return ctx.reply("Endi yangi ma'lumot matnini kiriting (matnni o'zgartirmaslik uchun /yoq deb yozing):");
  }
});

// ---------- Ovozli xabar — ovoz orqali qidiruv ----------

bot.on('voice', async (ctx) => {
  try {
    const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
    const waitMsg = await ctx.reply('🎤 Ovoz tinglanmoqda...');
    const text = await transcribeVoice(fileLink.href);
    await ctx.deleteMessage(waitMsg.message_id).catch(() => {});
    if (!text.trim()) {
      return ctx.reply("Ovozni tushunolmadim, iltimos qaytadan urinib ko'ring.");
    }
    await handleSearch(ctx, text);
  } catch (err) {
    console.error('Voice error:', err);
    await ctx.reply("Ovozni tanib bo'lmadi, qaytadan urinib ko'ring yoki matn bilan yozing.");
  }
});

// ---------- Matnli xabarlar (buyruqlar, admin oqimi, oddiy qidiruv) ----------

bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  if (text.startsWith('/')) return; // boshqa buyruqlar yuqorida ushlanadi

  const session = isAdmin(ctx) ? await getSession(ctx.chat.id) : null;

  if (session) {
    // --- Yangi dori qo'shish oqimi ---
    if (session.step === 'awaiting_name') {
      session.data.name = text;
      session.step = 'awaiting_photo_choice';
      await setSession(ctx.chat.id, session);
      return ctx.reply("Rasm yuborasizmi? Rasm yuboring, aks holda /yoq deb yozing:");
    }

    if (session.step === 'awaiting_info') {
      session.data.info = text;
      await db.collection('medicines').add({
        name: session.data.name,
        info: session.data.info,
        photoFileId: session.data.photoFileId || null,
        createdAt: new Date().toISOString(),
      });
      const savedName = session.data.name;
      await clearSession(ctx.chat.id);
      return ctx.reply(`✅ "${savedName}" ro'yxatga qo'shildi.`);
    }

    // --- Tahrirlash oqimi ---
    if (session.step === 'edit_awaiting_info') {
      const update = {};
      if (text !== '/yoq') update.info = text;
      if (session.data.photoFileId) update.photoFileId = session.data.photoFileId;
      await db.collection('medicines').doc(session.data.id).update(update);
      await clearSession(ctx.chat.id);
      return ctx.reply("✅ Ma'lumot yangilandi.");
    }
  }

  // --- Oddiy matnli qidiruv ---
  await handleSearch(ctx, text);
});

module.exports = bot;
