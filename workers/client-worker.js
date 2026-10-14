// client-worker.js — ставит вебмастер у себя в Cloudflare.
// Перед деплоем заменить WEBMASTER_WALLET и SHARED_SECRET (выдается на cloudflare-connect.html).
// Требует: wrangler secret put SHARED_SECRET (значение = REPORT_SECRET центра).

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const WEBMASTER_WALLET = "0xВАШ_КОШЕЛЕК_BNB_CHAIN"; // <-- заменить
    const CENTRAL_GATEWAY = "https://sementsul.net/api/report-bot";

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
          secret: env.SHARED_SECRET || "CHANGE_ME",
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
