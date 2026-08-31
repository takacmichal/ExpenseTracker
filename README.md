# Expense Tracker

Osobná aplikácia na správu výdavkov a príjmov. Monorepo so Spring Boot backendom, Angular frontendom a PostgreSQL, celé spustiteľné cez Docker Compose.

## Tech stack

| Vrstva     | Technológia                                                        |
| ---------- | ------------------------------------------------------------------ |
| Backend    | Java 21, Spring Boot 4.1, Spring Data JPA, Spring Security + JWT    |
| Databáza   | PostgreSQL 17, schéma verzovaná cez Flyway                          |
| Frontend   | Angular 22 (standalone komponenty, signals), PrimeNG 22, Chart.js   |
| Deployment | Docker Compose, nginx                                              |

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

## Predvolené kategórie

Nový účet dostane pri registrácii 19 kategórií (14 výdavkových, 5 príjmových) definovaných v `DefaultCategories`. Sada je odvodená z toho, čo sa reálne objavuje na slovenskom bežnom účte, a farby sú volené tak, aby boli čitateľné na tmavom pozadí a odlíšiteľné navzájom v grafe.

Existujúci účet si ich doplní tlačidlom **Doplniť odporúčané** v sekcii Kategórie, alebo cez `POST /api/categories/defaults`. Zhoduje sa podľa názvu bez ohľadu na veľkosť písmen, takže opakované volanie nič nezduplikuje a premenované kategórie nechá na pokoji.

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
│       ├── common/       zdieľané typy, BaseEntity, obsluha chýb
│       ├── config/       Security, CORS, OpenAPI
│       ├── auth/         registrácia, login, JWT filter
│       ├── user/         User entita
│       ├── account/      bankové účty
│       ├── category/     kategórie + CategoryRule
│       ├── transaction/  transakcie
│       ├── income/       detail výplat
│       ├── imports/      CSV import a parser
│       └── report/       mesačné a kategóriové súhrny
├── frontend/         Angular aplikácia
│   └── src/app/
│       ├── core/         auth, HTTP interceptor, API služby, modely
│       ├── layout/       shell so sidebarom
│       └── features/     auth, dashboard, transactions, categories, accounts, import
├── docker-compose.yml
└── .env.example
```

Balík pre import sa volá `imports`, lebo `import` je v Jave rezervované slovo.

## REST API

| Metóda            | Endpoint                            | Popis                                |
| ----------------- | ----------------------------------- | ------------------------------------ |
| POST              | `/api/auth/register`                | registrácia, vráti JWT               |
| POST              | `/api/auth/login`                   | prihlásenie, vráti JWT               |
| GET               | `/api/auth/me`                      | prihlásený používateľ                |
| GET/POST/PUT/DEL  | `/api/accounts`                     | správa účtov                         |
| GET/POST/PUT/DEL  | `/api/categories`                   | správa kategórií                     |
| POST              | `/api/categories/defaults`          | doplní odporúčanú sadu kategórií     |
| GET/POST/PUT/DEL  | `/api/transactions`                 | transakcie, filtre + stránkovanie    |
| GET/POST/PUT/DEL  | `/api/incomes`                      | detail výplat                        |
| POST              | `/api/import/csv/preview`           | náhľad CSV bez uloženia              |
| POST              | `/api/import/csv?accountId=…`       | import CSV do účtu                   |
| GET               | `/api/import/batches`               | história importov                    |
| GET               | `/api/reports/summary?month=YYYY-MM`| príjmy, výdavky, bilancia za mesiac  |
| GET               | `/api/reports/by-category`          | súčty podľa kategórií                |

Filtre pre `/api/transactions`: `from`, `to`, `categoryId`, `accountId`, `type`, `page`, `size`, `sort`.

Všetky endpointy okrem `register` a `login` vyžadujú hlavičku `Authorization: Bearer <token>`.

## Vývoj bez Dockera

Backend potrebuje **JDK 21** (lokálne máš JDK 8 — v IntelliJ si daj *Project Structure → SDK → Download JDK 21*). Maven netreba, v repozitári je wrapper.

```bash
# 1. databáza
docker compose up -d postgres

# 2. backend na :8080
cd backend && ./mvnw spring-boot:run

# 3. frontend na :4200, /api sa proxuje na backend cez proxy.conf.json
cd frontend && npm install && npm start
```

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

Pokrytie testami: `GeorgeCsvParserTest` (8 testov) — mapovanie podľa hlavičky, preusporiadané stĺpce, oba oddeľovače, tisícové oddeľovače, ISO dátumy, čiarka vnútri úvodzoviek, chybné riadky, chýbajúce stĺpce.

**PDF výpis sa importovať nedá** a ani sa oň nepokúšaj — text v ňom má vlastné kódovanie fontu a pri extrakcii vznikajú falošné číslice priamo v sumách (−8,30 sa číta ako −38,30). CSV je jediný bezpečný zdroj.

## Čo ešte treba doriešiť

**Kategorizačné pravidlá** — tabuľka `category_rules` a entita `CategoryRule` sú pripravené, `ImportService.matchCategory` zatiaľ robí len jednoduchý substring match podľa priority. Chýba CRUD endpoint na správu pravidiel a bohatšie porovnávanie (regex, suma, protiúčet).

**Ďalšie nedokončené veci** — testy má zatiaľ len CSV parser, žiadny refresh token (JWT platí 24 h a potom treba nový login), Income nemá vlastnú obrazovku vo frontende.
# ExpenseTracker
