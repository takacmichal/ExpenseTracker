# Expense Tracker

Osobná aplikácia na správu výdavkov a príjmov. Monorepo so Spring Boot backendom, Angular frontendom a PostgreSQL, celé spustiteľné cez Docker Compose. Každý používateľ vidí len svoje dáta.

## Tech stack

| Vrstva     | Technológia                                                        |
| ---------- | ------------------------------------------------------------------ |
| Backend    | Java 21, Spring Boot 4.1, Spring Data JPA, Spring Security + JWT    |
| Databáza   | PostgreSQL 17, schéma verzovaná cez Flyway                          |
| Frontend   | Angular 22 (standalone komponenty, signals), PrimeNG 22, Chart.js   |
| Testy      | JUnit 5 + Mockito (backend), Vitest cez `@angular/build:unit-test` (frontend) |
| Deployment | Docker Compose, nginx                                              |

## Funkcie

- **Prehľad** — mesačné príjmy, výdavky a bilancia, rozdelenie podľa kategórií, widget s čerpaním rozpočtov.
- **Rok a odhad** — ročný prehľad po mesiacoch a lineárny odhad do konca roka.
- **Transakcie** — ručné pridávanie a úprava, filtre (obdobie, kategória, účet, typ, text v popise) uložené v URL, takže sa dajú zdieľať aj prežijú obnovenie stránky. Hromadné akcie nad výberom (nastaviť kategóriu, zmazať), export do CSV, pri každom riadku tlačidlo „Vytvoriť pravidlo" z jeho popisu. Skratka `n` otvorí formulár na novú položku (Transakcie, Účty, Rozpočty, Pravidlá).
- **Výplaty** — detail výplat (príjmov) mimo bežných transakcií.
- **Import** — CSV výpis z George (Slovenská sporiteľňa) s náhľadom, automatickou kategorizáciou a označením duplicít voči vybranému účtu. História importov s možnosťou celý import vrátiť späť.
- **Rozpočty** — mesačný limit na výdavkovú kategóriu alebo jeden celkový limit; výdavky podkategórií sa započítajú do nadradenej kategórie, pre aktuálny mesiac sa počíta odhad do konca mesiaca.
- **Opakované platby** — automaticky nájdené predplatné a pravidelné platby za posledných 12 mesiacov s odhadom ročnej sumy a ďalšej platby.
- **Kategórie a pravidlá** — vlastné kategórie (aj podkategórie), pravidlá „text v popise → kategória" s prioritou a skúškou nanečisto pred uložením.
- **Účty** — bankové účty s menou.
- **Profil a účet** — zmena mena, zmena hesla (odhlási všetky ostatné relácie), zmazanie účtu so všetkými dátami.

UI je po slovensky, tmavá téma, od šírky 900 px nižšie sa bočné menu mení na vysúvací panel.

## Rýchly štart

```bash
cp .env.example .env      # vyplň JWT_SECRET a POSTGRES_PASSWORD
docker compose up --build
```

Potom otvor:

- **Frontend** — http://localhost:4200
- **Swagger UI** — http://localhost:8080/swagger-ui.html
- **OpenAPI JSON** — http://localhost:8080/v3/api-docs
- **Health check** — http://localhost:8080/actuator/health

Prvý krok v aplikácii: zaregistruj sa, vytvor si účet v sekcii **Účty**, potom pridávaj transakcie alebo importuj CSV.

## Premenné prostredia

Všetky sú v `.env.example`; `.env` je v `.gitignore`.

| Premenná | Popis |
| --- | --- |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | prihlasovanie do databázy |
| `POSTGRES_PORT`, `BACKEND_PORT`, `FRONTEND_PORT` | porty na hostiteľovi (5432, 8080, 4200) |
| `JWT_SECRET` | aspoň 32 znakov, napr. `openssl rand -base64 48` |
| `JWT_EXPIRATION_MINUTES` | platnosť tokenu, predvolene 1440 (24 h) |
| `CORS_ALLOWED_ORIGINS` | origin, z ktorého beží frontend |
| `PRIMENG_LICENSE` | kľúč PrimeNG, pozri nižšie |

## Predvolené kategórie a pravidlá

Nový účet dostane pri registrácii 19 kategórií (14 výdavkových, 5 príjmových) definovaných v `DefaultCategories` a sadu pravidiel podľa bežných obchodníkov z `DefaultCategoryRules`. Sada je odvodená z toho, čo sa reálne objavuje na slovenskom bežnom účte, a farby sú volené tak, aby boli čitateľné na tmavom pozadí a odlíšiteľné navzájom v grafe.

Existujúci účet si ich doplní tlačidlom **Doplniť odporúčané** v sekcii Kategórie, alebo cez `POST /api/categories/defaults`. Zhoduje sa podľa názvu bez ohľadu na veľkosť písmen, takže opakované volanie nič nezduplikuje a premenované kategórie nechá na pokoji.

## Kategorizácia

Pravidlo je podreťazec, ktorý sa hľadá v popise transakcie (bez ohľadu na diakritiku a veľkosť písmen) a potom v type transakcie z banky. Uplatnia sa len pravidlá, ktorých kategória má rovnaký smer ako transakcia (výdavok/príjem); vyhráva vyššia priorita, pri zhode dlhší vzor. Rovnaká logika (`CategoryMatcher`) beží v náhľade importu, pri importe, pri skúške pravidla aj pri `POST /api/transactions/categorise`, ktorý dokategorizuje doteraz nezaradené transakcie.

## PrimeNG licencia

PrimeNG je od verzie 18 komerčný produkt (posledná MIT verzia bola 17.18.0, tá však Angular 22 nepodporuje). Bez kľúča appka funguje úplne normálne, len vykreslí červenú poznámku „Invalid PrimeUI License" v pravom dolnom rohu.

**Community licencia je zadarmo** pre jednotlivcov, študentov, neziskovky a firmy do 1 M USD obratu / 5 vývojárov / 10 zamestnancov. Kľúč sa generuje na https://primeui.dev a obnovuje sa raz ročne.

Kam kľúč vložiť:

- **Docker** — do `.env` ako `PRIMENG_LICENSE=...`. Pri builde sa injektuje cez build argument, takže sa nikdy nedostane do gitu.
- **Lokálny `ng serve`** — do `frontend/src/environments/environment.ts`, pole `primeNgLicense`.

Overenie prebieha offline, bez telemetrie a bez sieťového volania.

## Štruktúra

```
├── backend/          Spring Boot aplikácia
│   └── src/main/java/com/expensetracker/
│       ├── common/       BaseEntity, výnimky, obsluha chýb (ProblemDetail), TextNormalizer
│       ├── config/       Security, CORS, OpenAPI
│       ├── auth/         registrácia, login, JWT filter, CurrentUser
│       ├── user/         User entita, profil, zmena hesla, zmazanie účtu
│       ├── account/      bankové účty
│       ├── category/     kategórie, pravidlá, CategoryMatcher, predvolené sady
│       ├── transaction/  transakcie, filtre, hromadné akcie, CSV export
│       ├── income/       detail výplat
│       ├── budget/       mesačné rozpočty a ich čerpanie
│       ├── imports/      CSV import, parser, detekcia duplicít, história
│       └── report/       súhrny, ročný prehľad, odhad, opakované platby
├── frontend/         Angular aplikácia
│   └── src/app/
│       ├── core/         auth, API služby, modely, ui/ (hlásenia, chyby, skratky, titulky, PrimeNG po slovensky)
│       ├── shared/       znovupoužiteľné komponenty (prázdny stav, chyba, hlavička stránky, …)
│       ├── layout/       shell so sidebarom, nav.ts so skupinami menu
│       └── features/     auth, dashboard, year, transactions, incomes, import, budgets,
│                         recurring, categories, rules, accounts, settings
├── docker-compose.yml
└── .env.example
```

Balík pre import sa volá `imports`, lebo `import` je v Jave rezervované slovo.

## REST API

| Metóda            | Endpoint                               | Popis                                                  |
| ----------------- | -------------------------------------- | ------------------------------------------------------ |
| POST              | `/api/auth/register`                   | registrácia, vráti JWT                                 |
| POST              | `/api/auth/login`                      | prihlásenie, vráti JWT                                 |
| GET               | `/api/auth/me`                         | prihlásený používateľ                                  |
| GET/PUT/DELETE    | `/api/users/me`                        | profil, zmena mena, zmazanie účtu (vyžaduje heslo)     |
| POST              | `/api/users/me/password`               | zmena hesla, vráti nový JWT                            |
| GET/POST/PUT/DEL  | `/api/accounts`                        | správa účtov                                           |
| GET/POST/PUT/DEL  | `/api/categories`                      | správa kategórií                                       |
| POST              | `/api/categories/defaults`             | doplní odporúčanú sadu kategórií                       |
| GET/POST/PUT/DEL  | `/api/category-rules`                  | správa kategorizačných pravidiel                       |
| POST              | `/api/category-rules/test`             | skúška vzoru nanečisto: počet zhôd + ukážka            |
| GET/POST/PUT/DEL  | `/api/transactions`                    | transakcie, filtre + stránkovanie; `includeSubcategories=true` pridá podkategórie `categoryId` |
| GET               | `/api/transactions/export`             | CSV export s rovnakými filtrami                        |
| POST              | `/api/transactions/bulk`               | hromadne `SET_CATEGORY` / `DELETE` (max. 1000)         |
| POST              | `/api/transactions/categorise`         | uplatní pravidlá na nezaradené transakcie              |
| GET/POST/PUT/DEL  | `/api/incomes`                         | detail výplat                                          |
| GET/POST/PUT/DEL  | `/api/budgets`                         | rozpočty (bez `categoryId` = celkový)                  |
| GET               | `/api/budgets/status?year=&month=`     | čerpanie rozpočtov za mesiac                           |
| POST              | `/api/import/csv/preview?accountId=…`  | náhľad CSV bez uloženia; s účtom označí duplicity      |
| POST              | `/api/import/csv?accountId=…`          | import CSV do účtu, duplicity preskočí                 |
| GET               | `/api/import/batches`                  | história importov                                      |
| DELETE            | `/api/import/batches/{id}`             | vráti import späť (zmaže jeho transakcie)              |
| GET               | `/api/reports/summary?month=YYYY-MM`   | príjmy, výdavky, bilancia za mesiac                    |
| GET               | `/api/reports/by-category`             | súčty podľa kategórií                                  |
| GET               | `/api/reports/year?year=`              | ročný prehľad po mesiacoch                             |
| GET               | `/api/reports/forecast?year=`          | odhad do konca roka                                    |
| GET               | `/api/reports/recurring`               | opakované platby za posledných 12 mesiacov             |

Filtre pre `/api/transactions`: `from`, `to`, `categoryId`, `includeSubcategories` (s `categoryId` zahrnie aj podkategórie), `accountId`, `type`, `q` (text v popise alebo v type transakcie z banky, bez ohľadu na diakritiku a veľkosť písmen, max. 100 znakov), `page`, `size`, `sort`.

Všetky endpointy okrem `register` a `login` vyžadujú hlavičku `Authorization: Bearer <token>`. Chyby vracajú RFC 7807 `ProblemDetail` so slovenskou správou v `detail`.

## Vývoj bez Dockera

Backend potrebuje **JDK 21 alebo novší** (pom cieli na `release 21`, takže stačí aj JBR 25 pribalený k IntelliJ — `JAVA_HOME="/Applications/IntelliJ IDEA.app/Contents/jbr/Contents/Home"`). Maven netreba, v repozitári je wrapper.

```bash
# 1. databáza
docker compose up -d postgres

# 2. backend na :8080
cd backend && ./mvnw spring-boot:run

# 3. frontend na :4200, /api sa proxuje na backend cez proxy.conf.json
cd frontend && npm install && npm start
```

## Testy

```bash
cd backend && ./mvnw test                       # všetky testy, bez Spring kontextu a bez databázy
cd frontend && npx ng test --watch=false        # jednorazový beh (npm test spustí watch režim)
```

Backend: čisté unit testy pre `GeorgeCsvParser`, `CategoryMatcher`, `DuplicateDetector`, `BudgetMath`, `RecurringDetector`, `LinearTrend`, `TransactionCsvWriter`, `ValidationMessages.properties`, plus Mockito testy `TransactionService` a `JwtAuthenticationFilter`. Frontend: spec súbory pre auth (service, guard, interceptor), `core/ui`, `labels`, `date-utils` a niekoľko zdieľaných komponentov.

## Import z George

`GeorgeCsvParser` číta CSV export zo Slovenskej sporiteľne. Hlavička exportu:

```
Vlastný názov účtu, Vlastný IBAN, Dátum splatnosti, Suma, Mena, Partner, IBAN partnera,
BIC SWIFT kód banky partnera, Číslo účtu partnera, CC kód banky partnera,
Popis transakcie, Typ transakcie, Konštantný symbol, Špecifický symbol, Variabilný symbol
```

Parser mapuje stĺpce **podľa názvov v hlavičke**, nie podľa pozície, takže prežije preusporiadanie aj pridanie stĺpcov. Sám si zisťuje:

| Vec | Ako |
| --- | --- |
| Oddeľovač | čiarka, bodkočiarka alebo tabulátor podľa hlavičky |
| Kódovanie | UTF-8 (aj s BOM), pri neplatných bajtoch spadne na Windows-1250 |
| Dátum | `d.M.yyyy`, `dd.MM.yyyy`, `yyyy-MM-dd`, `d/M/yyyy`, `yyyy/MM/dd` |
| Desatinná čiarka | posledný z `,` / `.` je desatinný, druhý oddeľuje tisíce |
| Smer | záporná suma → EXPENSE, kladná → INCOME |

Popis transakcie sa skladá ako `Partner · Popis transakcie` — názov obchodníka ide prvý, lebo práve on nesie signál na kategorizáciu.

Chybný riadok sa nezahodí ticho: dostane `error`, zobrazí sa v náhľade a pri importe sa preskočí. Zvyšok súboru prejde.

**Duplicity** — riadok, ktorý už účet obsahuje (rovnaký dátum, suma, smer a popis bez diakritiky), sa v náhľade označí a pri importe preskočí; počet sa uloží k importu. Párovanie je jedna k jednej, takže dve rovnaké kávy v ten istý deň v súbore pri jednej existujúcej znamenajú jednu duplicitu.

**Vrátenie importu** — `DELETE /api/import/batches/{id}` zmaže všetky transakcie, ktoré import vytvoril (aj neskôr upravené), a potom samotný záznam importu.

**PDF výpis sa importovať nedá** a ani sa oň nepokúšaj — text v ňom má vlastné kódovanie fontu a pri extrakcii vznikajú falošné číslice priamo v sumách (−8,30 sa číta ako −38,30). CSV je jediný bezpečný zdroj.

## CSV export

`GET /api/transactions/export` vráti súbor, ktorý Excel so slovenským nastavením otvorí dvojklikom: UTF-8 s BOM, oddeľovač `;`, desatinná čiarka, dátum `dd.MM.yyyy`. Text začínajúci `=`, `+`, `-` alebo `@` dostane na začiatok apostrof, aby ho tabuľkový procesor nevyhodnotil ako vzorec.

## Známe obmedzenia

- **Žiadny refresh token** — JWT platí 24 h (`JWT_EXPIRATION_MINUTES`), potom treba nové prihlásenie. Zmena hesla zneplatní všetky staršie tokeny.
- **Len jeden formát importu** — parser existuje iba pre George CSV; iná banka znamená novú implementáciu `BankStatementParser`. PDF výpisy nie sú podporované (pozri vyššie).
- **Pravidlá sú len podreťazce** — bez regexu, podmienok na sumu či protiúčet.
- **Ikona kategórie je voľný text** — nie je výber z knižnice ikon.
- **Výpočty v pamäti** — opakované platby a skúška pravidla načítajú transakcie používateľa do pamäte; na osobný objem dát to stačí, na veľké objemy nie.
