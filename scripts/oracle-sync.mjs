// scripts/oracle-sync.mjs — оффчейн-валидатор (запуск из GitHub Actions).
// 1. Читает новые строки из D1 (processed=0) через Cloudflare D1 HTTP API.
// 2. Для каждой строки вызывает processAttackMining(webmaster, keccak256(ip), true).
// 3. Помечает обработанные строки processed=1.
// Env: CF_ACCOUNT_ID, CF_D1_DATABASE_ID, CF_API_TOKEN,
//      BNB_RPC_URL, ORACLE_PRIVATE_KEY, CONTRACT_ADDRESS, DRY_RUN=1 (проверка без отправки)
import { createHash } from "node:crypto";

const {
  CF_ACCOUNT_ID, CF_D1_DATABASE_ID, CF_API_TOKEN,
  BNB_RPC_URL, ORACLE_PRIVATE_KEY, CONTRACT_ADDRESS, DRY_RUN,
} = process.env;

// Минимальный ABI
const ABI = [
  "function processAttackMining(address webmaster, bytes32 ipHash, bool isCaughtByUs)",
  "function ipStatus(bytes32) view returns (uint8)",
];

async function d1Query(sql, params = []) {
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_D1_DATABASE_ID}/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${CF_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }),
    }
  );
  const j = await r.json();
  if (!j.success) throw new Error("D1 error: " + JSON.stringify(j.errors));
  return j.result?.[0]?.results ?? [];
}

function ipHash(ip) {
  return "0x" + createHash("sha256").update(ip).digest("hex");
}

const isWallet = (a) => /^0x[0-9a-fA-F]{40}$/.test(a || "");

async function main() {
  for (const v of ["CF_ACCOUNT_ID", "CF_D1_DATABASE_ID", "CF_API_TOKEN"]) {
    if (!process.env[v]) throw new Error(`Missing env ${v}`);
  }
  const rows = await d1Query(
    "SELECT ip, webmaster_address FROM bot_logs WHERE processed = 0 ORDER BY last_seen ASC LIMIT 200"
  );
  console.log(`D1 new rows: ${rows.length}`);
  if (rows.length === 0) return;

  // DRY_RUN: только экспорт blocklist, без chain-вызовов (для проверки пайплайна)
  if (DRY_RUN === "1" || !BNB_RPC_URL || !ORACLE_PRIVATE_KEY || !CONTRACT_ADDRESS) {
    console.log("DRY_RUN: chain calls skipped");
    const { writeFileSync, mkdirSync } = await import("node:fs");
    mkdirSync("public", { recursive: true });
    const ips = [...new Set(rows.map((r) => r.ip).filter(Boolean))];
    writeFileSync("public/blocklist-live.txt", ips.join("\n") + "\n");
    return;
  }

  const { ethers } = await import("ethers");
  const provider = new ethers.JsonRpcProvider(BNB_RPC_URL);
  const wallet = new ethers.Wallet(ORACLE_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

  let ok = 0;
  const minted = [];
  for (const row of rows) {
    try {
      if (!isWallet(row.webmaster_address)) {
        console.warn(`skip bad wallet for ${row.ip}`);
        // битый кошелек не починится — помечаем, чтобы не крутить вечно
        minted.push(row.ip);
        continue;
      }
      const hash = ipHash(row.ip);
      const tx = await contract.processAttackMining(row.webmaster_address, hash, true);
      console.log(`${row.ip} -> ${tx.hash}`);
      await tx.wait(1);
      ok++;
      minted.push(row.ip);
    } catch (e) {
      console.error(`mint failed for ${row.ip}:`, e.shortMessage || e.message);
      // не помечаем processed — попробуем в следующем цикле
    }
  }

  // Помечаем ТОЛЬКО успешные (revert из-за капов/резерва повторим в следующем цикле)
  for (let i = 0; i < minted.length; i += 50) {
    const chunk = minted.slice(i, i + 50);
    const q = `UPDATE bot_logs SET processed = 1 WHERE ip IN (${chunk.map(() => "?").join(",")})`;
    await d1Query(q, chunk);
  }
  console.log(`done, minted: ${ok}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
