const { distance } = require('fastest-levenshtein');

// Krill harflarni lotin harflarga o'girish jadvali (o'zbekcha)
const CYRILLIC_TO_LATIN = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya',
  ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
};

/**
 * Matnni "solishtirish uchun standart" ko'rinishga keltiradi:
 * - kichik harflarga o'tkazadi
 * - kirilcha harflarni lotinchaga o'giradi
 * - o' / g' kabi apostroflarni olib tashlaydi (shunda "o'ni o qilib yozish" ham mos tushadi)
 * - harf va raqamdan boshqa belgilarni olib tashlaydi
 */
function normalizeText(text) {
  if (!text) return '';
  let t = String(text).toLowerCase();

  t = t
    .split('')
    .map((ch) => (CYRILLIC_TO_LATIN[ch] !== undefined ? CYRILLIC_TO_LATIN[ch] : ch))
    .join('');

  // o', g', ʻ, ʼ, ‘, ’, ` — barchasini bir xil deb hisoblab olib tashlaymiz
  t = t.replace(/[ʻʼ'`’‘]/g, '');

  // faqat harf, raqam va bo'shliq qoldiramiz
  t = t.replace(/[^a-z0-9\s]/g, '');

  t = t.replace(/\s+/g, ' ').trim();

  return t;
}

function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - distance(a, b) / maxLen;
}

/**
 * Ro'yxatdagi dorilar ichidan so'ralgan nomga eng mos kelganini topadi.
 * Aniq mos kelish, ichiga kirish (substring) va xato-yozuvga chidamli
 * o'xshashlik (Levenshtein) ketma-ket tekshiriladi.
 */
function findBestMatch(query, medicines, threshold = 0.6) {
  const normQuery = normalizeText(query);
  if (!normQuery) return null;

  let best = null;
  let bestScore = 0;

  for (const med of medicines) {
    const normName = normalizeText(med.name);
    if (!normName) continue;

    if (normName === normQuery) {
      return { medicine: med, score: 1 };
    }

    if (normName.includes(normQuery) || normQuery.includes(normName)) {
      const score = 0.9;
      if (score > bestScore) {
        bestScore = score;
        best = med;
      }
      continue;
    }

    const score = similarity(normQuery, normName);
    if (score > bestScore) {
      bestScore = score;
      best = med;
    }
  }

  if (best && bestScore >= threshold) {
    return { medicine: best, score: bestScore };
  }
  return null;
}

module.exports = { normalizeText, similarity, findBestMatch };
