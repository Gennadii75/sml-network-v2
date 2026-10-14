# Sementsul Network V2 — что исправлено относительно ТЗ Google ИИ

Каркас собран. Исходное ТЗ **нерабочее**, ниже — что починили и почему.

## Критические баги исходного ТЗ

1. **Фейковое сжигание.** Контракт только уменьшал счетчик `burnReservePool`,
   но токены резерва никогда не минтились. `_mint(webmaster, 3)` / `_mint(treasury, 7)`
   — чистая инфляция. V2: 250M минтится на `address(this)`, сжигание — реальный
   `_burn(address(this), 10e18)`. Нетто: primary −7, recapture −3.
2. **Потеря повторных атак.** `INSERT OR IGNORE` + `PRIMARY KEY(ip)` молча отбрасывал
   рецидивы → ветка 10/7 недостижима. V2: `ON CONFLICT(ip) DO UPDATE SET hits+1, processed=0`.
3. **Бесконечный минт.** Любой мог слать фейковые IP (4 млрд IPv4) и минтить 3 SML.
   V2: `MAX_MINTS_PER_DAY=500`, `BURN_CAP_PER_YEAR=2.5M`, revert при превышении
   (в ТЗ первая ветка молча минтила без burn при превышении капа).
4. **Разорванный оракул.** Workflow в ТЗ никогда не вызывал контракт BNB.
   V2: `scripts/oracle-sync.mjs` (ethers v6) читает D1 → `processAttackMining` → `processed=1`.
5. **Обрезанные URL/API.** `https://cloudflare.com`, `Date.now()` без `()`,
   `JSON.s tringify`, секрет `sml-network-public-v1` в паблике.
   V2: `https://api.cloudflare.com/client/v4/.../query`, `REPORT_SECRET` в secrets,
   валидация IP/кошелька, CORS preflight.
6. **Deprecated `threatScore`.** V2 использует `cf.botManagement.score` с fallback.
7. **Хардкод статистики.** `stats.html` V2 читает `blocklist.txt` + `eth_call` к контракту.

## Структура

```
contracts/SementsulV2.sol      — токен (OZ 5.0.2, solc 0.8.22)
workers/edge-honeypot.js       — центр sementsul.net/api/report-bot
workers/client-worker.js       — шаблон вебмастера
db/schema.sql                  — D1 с hits/last_seen
scripts/oracle-sync.mjs        — D1 → BNB минт
.github/workflows/sync-botnets.yml
public/blocklist.txt, stats.html, cloudflare-connect.html
wrangler.toml, package.json, .env.example
```

## Деплой (порядок)

1. `wrangler d1 create sementsul-db` → вписать `database_id` в `wrangler.toml` →
   `wrangler d1 execute sementsul-db --file=db/schema.sql`
2. `wrangler secret put REPORT_SECRET` + выставить `MY_TREASURY_WALLET` →
   `wrangler deploy`
3. Remix: скомпилировать `SementsulV2.sol` (imports OZ 5.0.2), конструктор
   `(initialOwner, oracle, treasury)` → записать адрес в `public/stats.html` и secrets.
4. GitHub Secrets: `CF_ACCOUNT_ID / CF_D1_DATABASE_ID / CF_API_TOKEN /
   BNB_RPC_URL / ORACLE_PRIVATE_KEY / CONTRACT_ADDRESS`.
5. Проверка: `npm install && npm run check:workers`, затем
   `DRY_RUN=1` прогон оракула.

## Про пул $2000 (из хвоста ТЗ)

Налог 5–10% на продажу несовместим с текущим SML 0%/0% (`sementsul-site`
показывает Buy 0% / Sell 0%) и убьет листинг. Для V2 отдельный токен/пул:
старт $0.01, лимит покупки на кошелек первые 24ч, затем DCA из доходов.
Не переносить налог в действующий контракт `0xF79C...` — это потребует
нового токена и миграции ликвидности.
