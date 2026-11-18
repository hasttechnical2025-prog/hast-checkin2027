import 'server-only';

// Gửi thông báo Telegram (best-effort). Token ở TELEGRAM_BOT_TOKEN (server env, KHÔNG ra client).
// Telegram lỗi KHÔNG được chặn luồng chấm công/duyệt -> mọi hàm nuốt lỗi, trả boolean.

export async function sendTelegram(chatId: number | string | null | undefined, message: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendTelegramMany(
  chatIds: (number | string | null | undefined)[],
  message: string,
): Promise<void> {
  await Promise.all(chatIds.filter(Boolean).map((id) => sendTelegram(id, message)));
}
