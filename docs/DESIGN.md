# 卫戍协议：盟约 — Web Remake · Architecture & Contracts (DESIGN.md)

This is the **single source of truth** for every implementer. Research lives in `docs/research/` (start with `00-INDEX.md`; where a research file's body and its "Addendum (critic)" disagree, the addendum wins). When this document and research disagree, **this document wins**; when this document is silent, follow research; when both are silent, choose the simplest faithful behaviour and write it down in the module's header comment.

Language: player-facing text is **Simplified Chinese** by default, with an English switch since 0.2.0 (§25.2, docs/I18N.md: UI strings through `t('中文')`, game texts from the official Chinese data or the official EN client's). Code, comments and identifiers are English.

Versions: the first public release was **0.1.0** (2026-10-02, the state of §0–§20.15); the releases after it add the player feedback and GitHub reports — 0.1.1 §21, 0.1.2 §22, 0.1.3 §23, 0.1.4 §24 — and **0.2.0** (2026-10-07; `CHANGELOG.md`) the maintainability refactor, two languages, 补位, 自选编队 and their fidelity work — §25 — **0.2.1** (2026-10-07) the 联防 battlefield restored, full potential and the GitHub fixes after it — §26 — and **0.2.2** (2026-10-09) per-operator 潜能 / 练度, Japanese voices, the statistics page, 失衡, whole-frame attack timing and the GitHub fixes after 0.2.1 — §27. **0.2.3** (2026-10-10; `package.json`, `shared/constants.js APP_VERSION`) 克莱门莎 and new modules, community fixes, text size, per-operator voices, installation, the opening reroll and local match recovery — §28. **0.2.4** (2026-10-11) the official shared card pool and item stock, Raid revival and #475, and the community fixes after 0.2.3 — §29, which also records the maintainer's 自研 content layer: the 巴别塔 core bond, its injector `tools/content/custom.mjs` and 克莱门莎 as a T5 shop chess (§29.15). **0.2.5** (2026-10-12) fixed gifts and already displayed operator offers under the shared stock, random boss pairing, the official battlefield scenes on the 3D board (optional local art: the full bundle includes them when extracted, a missing scene keeps the metal board; §15, §30.21), the official damage-number option, the 驭械术师 / hit-tile / bot ports and the community fixes after 0.2.4 — §30, the state described by this document; its rules supersede the corresponding 0.2.4 ones. §29.15–§29.24 carry the 自研 layer on top of it: the 巴别塔 core bond, the 元素 add-on bond and their members, the maintainer's rulings of 2026-10-12 and the default-skill batch of 2026-10-13 (§29.23, §29.24) — a branch of the maintainer's own, merged with §30 and not yet released. The labels v1 / v2 / v2.1–v2.5.2 in §0, §14–§20 and in the BALANCE / SIM comparisons name the design generations and the private playtest builds that came before it; they are kept as history.

---

## Where each section lives

Section numbers are global and never change: code, tests and the other documents cite them as "DESIGN §N". The
current rules by area are in `docs/design/`, the per-release revisions (the evidence behind each rule) in
`docs/history/`. When a revision changes a rule, the rule in `docs/design/` is rewritten too (the revision lists the
normative lines it rewrote).

| sections | file | content |
|---|---|---|
| §0, §1, §2, §11, §12 | [design/overview.md](design/overview.md) | Scope, stack, repository layout, quality bar |
| §3, §4 | [design/geometry-time.md](design/geometry-time.md) | Coordinates, fields, geometry and time |
| §5, §7 | [design/engine.md](design/engine.md) | The battle engine (server/sim) and content modules |
| §6, §16 | [design/match.md](design/match.md) | The match and meta engine (server/match), operator loadouts |
| §8, §14 | [design/network.md](design/network.md) | The network protocol and client-side combat |
| §9, §10, §13, §15 | [design/client.md](design/client.md) | Rendering, UI, local-client art, the 3D board |
| §17 | [history/v2.2-playtest3.md](history/v2.2-playtest3.md) | User playtest #3 (v2.2) |
| §18 | [history/v2.3-playtest4.md](history/v2.3-playtest4.md) | User playtest #4 (v2.3) |
| §19 | [history/v2.4-playtest5.md](history/v2.4-playtest5.md) | User playtest #5 (v2.4) |
| §20 | [history/v2.5-playtest6.md](history/v2.5-playtest6.md) | User playtest #6 (v2.5) and its follow-ups, up to 0.1.0 |
| §21 | [history/0.1.1.md](history/0.1.1.md) | 0.1.1 — player feedback after 0.1.0 |
| §22 | [history/0.1.2.md](history/0.1.2.md) | 0.1.2 — GitHub issues after 0.1.1 |
| §23 | [history/0.1.3.md](history/0.1.3.md) | 0.1.3 — community reports after 0.1.2 |
| §24 | [history/0.1.4.md](history/0.1.4.md) | 0.1.4 — community reports after 0.1.3 |
| §25 | [history/0.2.0.md](history/0.2.0.md) | 0.2.0 |
| §26 | [history/0.2.1.md](history/0.2.1.md) | 0.2.1 — after the 0.2.0 release |
| §27 | [history/0.2.2.md](history/0.2.2.md) | 0.2.2 — after the 0.2.1 release (2026-10-09) |
| §28 | [history/0.2.3.md](history/0.2.3.md) | 0.2.3 — after the 0.2.2 release (2026-10-10) |
| §29 | [history/0.2.4.md](history/0.2.4.md) | 0.2.4 — after the 0.2.3 release (2026-10-11); §29.15 the 自研 巴别塔 core bond and the fiat content channel, §29.16–§29.18 its 11 members, three items, thresholds and official modules, §29.19 the golden update and its attribution, §29.20 the `attrByBond` 部署时判定 alignment (official note 「※仅在每次部署时判定盟约层数」) with its golden moves, §29.21 the 自研 「元素」 add-on bond, its seven members and 珊比's promotion to a visible T4 shop chess, §29.22 the final corpus update (283 scenarios: +2 「元素」 bond scenarios, −2 自选 ones, 187 moved) with the attribution of every moved scenario, the zero-drift controls and the 赫默 `kjeragShip` finding, §29.23 the two maintainer rulings of 2026-10-12 — 克莱门莎's bonds and 特质 targets become 阿戈尔 · 迅捷 · 元素 (不屈 removed) and 妮芙's 元素 clause requires an activated bond — with the corpus update (283 scenarios, 21 moved, none added or removed) and the isolation-measured attribution of every moved scenario, §29.24 the maintainer's default-skill batch of 2026-10-13 (13 chess, `defaultSkillIndex` = `backupCharSkillIndex`, the three official ones already carried the wanted index) together with the withdrawal of 华法琳's 4/8 特质 cap override (back on the official `garrison_72_a/_b` → `garrison_95_a/_b`, 7/14) — the corpus update (283 scenarios, 79 moved, none added or removed, `garrisons` 281 → 277) with the isolation-measured attribution: every one of the 79 moves is the default-skill batch, the 特质 revert moves zero scenarios; the EN data overlay was rebuilt in the same change (`bonds` 93.3 / `garrisons` 94.2 — their two measured floors follow), and one stored-digest expectation in `test/golden-diy.test.js` (a golden-related file this change was told not to touch) awaits the maintainer's ruling |
| §30 | [history/0.2.5.md](history/0.2.5.md) | 0.2.5 — after the 0.2.4 release (2026-10-12); §30.31 the merge of 0.2.5 into the 自研 branch (the three documents' semantic merge, the rebuilt data with both sides' content, the re-baselined corpus and its attribution), including the maintainer's 裁决 (a) of 2026-10-13 — 克莱门莎's four ruled fields (`bondIds`, `garrisonIds`, both default-skill indices) become an **explicit override** of the official mode rather than add-if-absent, after the official 0.2.5 data was checked and found to carry her character and her 盟约策略 but no chess row (`docs/DATA.md` §19.9) |
