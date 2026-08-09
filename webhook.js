const bot = require('../lib/bot');

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    try {
      await bot.handleUpdate(req.body);
      res.status(200).end();
    } catch (err) {
      console.error('Webhook error:', err);
      res.status(200).end(); // Telegram qayta-qayta urinishiga yo'l qo'ymaslik uchun 200 qaytaramiz
    }
  } else {
    res.status(200).send('Dori bot ishlayapti ✅');
  }
};
