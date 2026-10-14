// client-worker.js — шаблон для вебмастера.
// НЕ ЗАПОЛНЯЙ ВРУЧНУЮ: готовый код с твоим кошельком и персональным секретом
// выдает страница подключения:
//   https://gennadii75.github.io/sml-network-v2/cloudflare-connect.html
// Ниже — тот же код, как он выглядит после генерации.
// Воркер НИКОГО НЕ БЛОКИРУЕТ: фиксирует ботов и пропускает трафик дальше.

const WEBMASTER_WALLET = "0x..."; // твой BNB-кошелек (подставит генератор)
const SHARED_SECRET = "...";      // твой персональный секрет (выдаст генератор)
const CENTRAL_GATEWAY = "https://sementsul.net/api/report-bot";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const bm = request.cf?.botManagement;
    const threat = bm && typeof bm.score === "number" ? 100 - bm.score : request.cf?.threatScore || 0;

    if (threat > 10 || url.searchParams.has("bot_trigger")) {
      const ip = request.headers.get("cf-connecting-ip");
      if (ip) {
        const payload = {
          ip,
          webmaster: WEBMASTER_WALLET,
          asn: request.cf?.asn || 0,
          country: request.cf?.country || "unknown",
          userAgent: request.headers.get("user-agent") || "unknown",
          secret: SHARED_SECRET,
        };
        ctx.waitUntil(
          fetch(CENTRAL_GATEWAY, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }).catch(() => {})
        );
      }
    }

    return fetch(request);
  },
};
