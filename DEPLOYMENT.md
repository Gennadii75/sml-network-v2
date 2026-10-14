# SementsulV2 — mainnet deployment record

- Network: BNB Smart Chain Mainnet (chainId 56)
- Contract: `0x1FE40AAd7c3c3ccEB4efc9099EFBC57D2Dcc0dC7`
- Deploy tx: `0x97f8fd4c07f728328f5573f93806bc03b44579700d74e198229935b92ed1589d`
- Block: 127505290
- Deployer / initialOwner: `0xE69a0bcE418F198Fd869d7Ade2175A06fA215BFE` (750M SML)
- Oracle (`networkOracle`): `0x0324c6BC589007F367D71B1899916CE9BDf59a39`
- Treasury (`treasuryWallet`): `0xfC3e715DaB3FE1fbf95f7Df8BB14E1cF6f12e5d4`
- Constructor mint verified in receipt logs: 750M → owner, 250M → contract (reserve)
- Gas used: 2 049 705
- Compiler: solc 0.8.34 (Remix), OZ 5.0.2, optimization 200 runs

## TODO

1. [x] Verify source on BscScan (Standard JSON, solc 0.8.34, 200 runs) — полное совпадение.
2. [x] GitHub Secrets `sementsul-site`: `SML_CONTRACT` — стоит.
3. [ ] Create PancakeSwap V2 pool для нового адреса (старый пул V1 НЕ мигрирует).
4. [ ] GitHub Secrets `sml-network-v2`: осталось вручную `CF_API_TOKEN` (D1 Edit),
   `ORACLE_PRIVATE_KEY` (Account 28), `REPORT_SECRET` (тот же, что в воркере).
   Уже стоят: `CONTRACT_ADDRESS`, `BNB_RPC_URL`, `CF_ACCOUNT_ID`, `CF_D1_DATABASE_ID`.
5. [ ] Cloudflare Worker `sementsul-edge`: код залит в репо, создать воркер в дашборде,
   привязать D1 (`DB`), vars `MY_TREASURY_WALLET`, secret `REPORT_SECRET` (мастер-ключ),
   роут `sementsul.net/api/*` (report-bot + request-secret), тест POST → проверка D1.
   В D1 Console один раз выполнить блок `webmasters` из db/schema.sql.
