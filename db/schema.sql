-- Sementsul Network V2: Cloudflare D1 schema
-- ВНИМАНИЕ: выполнять целиком только на пустой базе! DROP ниже сотрет bot_logs.
-- Для догрузки отдельных таблиц копируй нужные блоки в Console вручную.
-- Фикс ТЗ: вместо INSERT OR IGNORE (терял повторные атаки)
-- используем UPSERT по клиенту воркера + счетчик hits.
DROP TABLE IF EXISTS bot_logs;
CREATE TABLE IF NOT EXISTS bot_logs (
    ip TEXT PRIMARY KEY,
    first_seen INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    hits INTEGER NOT NULL DEFAULT 1,
    asn INTEGER DEFAULT 0,
    country TEXT DEFAULT 'unknown',
    user_agent TEXT DEFAULT 'unknown',
    processed INTEGER NOT NULL DEFAULT 0,
    webmaster_address TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_botlogs_processed ON bot_logs(processed, last_seen);
CREATE INDEX IF NOT EXISTS idx_botlogs_webmaster ON bot_logs(webmaster_address, processed);

-- Персональные секреты вебмастеров (автовыдача через POST /api/request-secret)
CREATE TABLE IF NOT EXISTS webmasters (
    wallet TEXT PRIMARY KEY,
    secret TEXT NOT NULL,
    created INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
);
