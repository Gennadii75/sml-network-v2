// edge-honeypot.js — центральный воркер sementsul.net
// Wrangler: [[d1_databases]] binding = "DB", vars: REPORT_SECRET (мастер-ключ), MY_TREASURY_WALLET
// Routes: sementsul.net/api/* (report-bot + request-secret) + локальный перехват sementsul.net/*

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function isValidIp(ip) {
  if (typeof ip !== "string" || ip.length > 45) return false;
  // IPv4
  const v4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
  if (v4.test(ip)) return true;
  // IPv6 — строгая проверка через URL-парсер (отсекает мусор вида ":fa", "cce")
  if (!ip.includes(":")) return false;
  try {
    new URL(`http://[${ip}]/`);
    return true;
  } catch {
    return false;
  }
}

function isValidWallet(a) {
  return typeof a === "string" && /^0x[0-9a-fA-F]{40}$/.test(a);
}

function newSecret() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// Проверка секрета: персональный из таблицы webmasters либо мастер-ключ оракула
async function checkSecret(env, wallet, secret) {
  if (!secret || !isValidWallet(wallet)) return false;
  if (env.REPORT_SECRET && secret === env.REPORT_SECRET) return true;
  try {
    const row = await env.DB.prepare(
      "SELECT 1 AS ok FROM webmasters WHERE wallet = ? AND secret = ? AND active = 1"
    )
      .bind(String(wallet).toLowerCase(), secret)
      .first();
    return !!row;
  } catch {
    return false;
  }
}

function botScore(request) {
  // Cloudflare: botManagement.score (0=бот, 100=человек). threatScore deprecated.
  const bm = request.cf?.botManagement;
  if (bm && typeof bm.score === "number") return 100 - bm.score; // приводим к "threat"
  return request.cf?.threatScore || 0;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // --- 0. Автовыдача персонального секрета вебмастеру ---
    if (url.pathname === "/api/request-secret" && request.method === "POST") {
      let data;
      try {
        data = await request.json();
      } catch {
        return new Response("Invalid JSON", { status: 400, headers: CORS });
      }
      const wallet = String(data.wallet || "").toLowerCase();
      if (!isValidWallet(wallet)) {
        return new Response("Bad wallet", { status: 400, headers: CORS });
      }
      const json = { "Content-Type": "application/json" };
      try {
        const existing = await env.DB.prepare(
          "SELECT secret FROM webmasters WHERE wallet = ?"
        )
          .bind(wallet)
          .first();
        if (existing?.secret) {
          return new Response(JSON.stringify({ secret: existing.secret, existed: true }), {
            status: 200, headers: { ...CORS, ...json },
          });
        }
        const secret = newSecret();
        await env.DB.prepare(
          "INSERT INTO webmasters (wallet, secret, created, active) VALUES (?, ?, ?, 1)"
        )
          .bind(wallet, secret, Date.now())
          .run();
        return new Response(JSON.stringify({ secret, existed: false }), {
          status: 200, headers: { ...CORS, ...json },
        });
      } catch {
        return new Response("Oracle not initialized", { status: 503, headers: CORS });
      }
    }

    // --- 1. SaaS API ---
    if (url.pathname === "/api/report-bot" && request.method === "POST") {
      let data;
      try {
        data = await request.json();
      } catch {
        return new Response("Invalid JSON", { status: 400, headers: CORS });
      }
      if (!(await checkSecret(env, data.webmaster, data.secret))) {
        return new Response("Forbidden", { status: 403, headers: CORS });
      }
      if (!isValidIp(data.ip) || !isValidWallet(data.webmaster)) {
        return new Response("Bad ip or wallet", { status: 400, headers: CORS });
      }
      const now = Date.now();
      const asn = Number(data.asn) || 0;
      const country = String(data.country || "unknown").slice(0, 8);
      const ua = String(data.userAgent || "unknown").slice(0, 300);
      ctx.waitUntil(
        env.DB.prepare(
          `INSERT INTO bot_logs (ip, first_seen, last_seen, hits, asn, country, user_agent, processed, webmaster_address)
           VALUES (?, ?, ?, 1, ?, ?, ?, 0, ?)
           ON CONFLICT(ip) DO UPDATE SET
             hits = hits + 1,
             last_seen = excluded.last_seen,
             processed = 0`
        )
          .bind(data.ip, now, now, asn, country, ua, data.webmaster)
          .run()
          .catch((e) => console.error("D1 write failed", e))
      );
      return new Response("Logged", { status: 200, headers: CORS });
    }

    // --- 2. Локальный перехват собственного домена ---
    // Honeypot-ловушка: на статическом лендинге этих путей нет в принципе,
    // любой стук сюда — сканер. Независит от тарифа Cloudflare (bot score
    // на free виден частично). В клиентский шаблон НЕ переносить: там может
    // быть живой WordPress, где wp-login.php легитимен.
    const HONEY = ["/wp-login.php", "/xmlrpc.php", "/.env", "/phpmyadmin", "/pma/", "/.git/config", "/server-status", "/actuator", "/.aws/credentials", "/console/", "/solr/", "/cgi-bin/"];
    const lowPath = url.pathname.toLowerCase();
    const honeypot = HONEY.some((h) => lowPath === h || lowPath.startsWith(h.endsWith("/") ? h : h + "/"));
    const score = botScore(request);
    if (score > 10 || honeypot || url.searchParams.has("bot_trigger")) {
      const ip = request.headers.get("cf-connecting-ip") || "";
      if (isValidIp(ip)) {
        const now = Date.now();
        const wallet = isValidWallet(env.MY_TREASURY_WALLET)
          ? env.MY_TREASURY_WALLET
          : "0x0000000000000000000000000000000000000000";
        const asn = request.cf?.asn || 0;
        const country = request.cf?.country || "unknown";
        const ua = (request.headers.get("user-agent") || "unknown").slice(0, 300);
        ctx.waitUntil(
          env.DB.prepare(
            `INSERT INTO bot_logs (ip, first_seen, last_seen, hits, asn, country, user_agent, processed, webmaster_address)
             VALUES (?, ?, ?, 1, ?, ?, ?, 0, ?)
             ON CONFLICT(ip) DO UPDATE SET
               hits = hits + 1,
               last_seen = excluded.last_seen,
               processed = 0`
          )
            .bind(ip, now, now, asn, country, ua, wallet)
            .run()
            .catch((e) => console.error("D1 local write failed", e))
        );
      }
    }

    return fetch(request);
  },
};
