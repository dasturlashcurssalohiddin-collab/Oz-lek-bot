const fetch = require('node-fetch');
const { OpenAI, toFile } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Telegram voice faylining havolasini olib, Whisper orqali matnga aylantiradi.
 * @param {string} fileUrl - Telegram file link (ctx.telegram.getFileLink natijasi)
 * @returns {Promise<string>} tanilgan matn
 */
async function transcribeVoice(fileUrl) {
  const res = await fetch(fileUrl);
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const file = await toFile(buffer, 'voice.ogg', { type: 'audio/ogg' });

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'uz',
  });

  return transcription.text || '';
}

module.exports = { transcribeVoice };
