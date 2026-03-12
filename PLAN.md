# Brospify Hub – Neuaufbau-Plan (stabil & minimal)

## Ziel
- **Alle Fehler entfernen**, App nutzbar machen
- **Ladezeit** und **„nichts klickbar“** beheben
- Nur **Channel-Erstellung (mit allen Features)** + **Standard-Funktionen** behalten
- Alles darüber hinaus **entfernen** → quasi **neue, schlanke App**

---

## 1. Performance & UX („lädt ewig“, „nichts klickbar“)

| Problem | Maßnahme |
|--------|----------|
| **AuthReady** | Bereits optimiert (Session-Check + 400 ms Timeout). Timeout auf **200 ms** reduzieren, damit bei fehlender Session schneller zu Login umgeleitet wird. |
| **AdminAuthReady** | Aktuell: blockiert bis API `/api/user/profile` oder **5 s**. → **Max. 1,5 s** warten, dann UI anzeigen; Berechtigung im Hintergrund prüfen und bei Nicht-Admin weiche Umleitung zu `/dashboard`. Kein 5 s-Spinner mehr. |
| **Schweres Bundle** | Framer Motion nur dort behalten, wo nötig (z. B. Mobile-Menü). Admin-Sidebar auf einfache CSS-Hover-States umstellen, wo möglich. |
| **Overlays / unclickable** | Keine zusätzlichen globalen Overlays; Modals nur bei Channel-Manager (ChannelModal). Toten Code **Tutorial-Overlay** entfernen (wird nirgends eingebunden). |

---

## 2. Main-App – Was bleibt (Standard)

- **Auth:** Login, Register, Welcome
- **Navigation:** Sidebar + Mobile-Nav mit **nur:** Dashboard, Einstellungen, Channel-Liste (dynamisch)
- **Seiten:** `/dashboard`, `/settings`, `/profile` (→ Redirect zu Settings), `/channels`, `/channels/[channelId]`, `/user/[userId]` (Profil-Link)
- **Funktionen:** Channel-Liste anzeigen, Channel öffnen, Chat/Nachrichten (wie bisher), Profil & Einstellungen

---

## 3. Main-App – Was entfernt wird

- **Nav-Einträge:** Gespeichert (Favorites), Support-Tickets, Winning Product, Produkte
- **Routen/Seiten:**  
  `/favorites`, `/tickets`, `/support`, `/channels/winning-product`, `/products`, `/products/[slug]`
- **Komponenten:**  
  `favorites/`, `tickets/`, `support/`, `channels/winning-product-view`, Produkt-Seiten-Komponenten (product-showcase, winning-product-showcase etc.), sofern nur für diese Routen genutzt

---

## 4. Admin – Was bleibt (Channel-Erstellung + Standard)

- **Channel-Manager** (`/admin/channels`): Erstellen, Bearbeiten, alle Modal-Features (Name, Typ, Kategorie, Berechtigungen, Rollen, Freigabe, Rate-Limit, etc.)
- **Kategorien** (`/admin/categories`): Channel-Kategorien für die Channel-Erstellung
- **App-Einstellungen** (`/admin/settings`): Optional, für App-Logo/Name (Sidebar)
- **Admin-Start:** `/admin` → Redirect auf `/admin/channels` (einzige Landing-Seite)

---

## 5. Admin – Was entfernt wird

- **Nav-Einträge:** Übersicht, Support-Tickets, Ticket-Kategorien, Lizenz-Management, Produkt-Manager, Rollen-Manager, Benutzer & Rollen, User-Zentrale, Geräte-Manager, Freigaben, Scheduler, Aktivitätslog, Emojis
- **Routen/Seiten:**  
  Alle zugehörigen Admin-Seiten (tickets, ticket-categories, licenses, products, winning-product, roles, user-roles, users, devices, approval, scheduler, activity, emojis, quick-replies, support, tutorials) – **außer** `channels`, `categories`, `settings`
- **Komponenten:**  
  Entsprechende Admin-Komponenten (admin-dashboard, support-inbox, ticket-category-manager, license-manager, product-manager, winning-product-editor, role-manager, user-role-manager, user-management, device-manager, approval-queue, content-scheduler, activity-log, emoji-manager, quick-replies-manager, tutorial-editor etc.)

---

## 6. API & Sonstiges

- **API-Routen entfernen/ungenutzt:**  
  `channels/winning-product`, `cron/post-scheduled`, `support/conversation`, `webhooks/shopify`; `geo` nur entfernen, wenn nicht für Kernfunktionen genutzt.
- **Toter Code:**  
  `tutorial-overlay.tsx` (nirgends importiert) löschen.
- **Sidebar Channel-Liste:**  
  Filter `winning_product` und `support` beibehalten (diese Channel-Typen werden nicht mehr in der App angezeigt, schadet nicht).

---

## 7. Reihenfolge der Umsetzung

1. **PLAN.md** (dieses Dokument) anlegen  
2. **Auth/Performance:** AuthReady 200 ms, AdminAuthReady max. 1,5 s + Hintergrund-Check  
3. **Main-App:** Sidebar + Mobile-Nav auf Dashboard + Einstellungen + Channels reduzieren  
4. **Main-App:** Routen Favorites, Tickets, Support, Winning Product, Products auf Redirect zu `/dashboard` oder 404-Seite mit Link zu Dashboard (empfohlen: Redirect)  
5. **Admin:** Sidebar + Mobile-Admin-Nav nur Channel-Manager, Kategorien, App-Einstellungen; `/admin` → `/admin/channels`  
6. **Admin:** Alle anderen Admin-Seiten löschen bzw. durch Redirect ersetzen  
7. **Komponenten:** Gelöschte Seiten zugehörige Komponenten entfernen  
8. **API & toter Code:** Ungenutzte API-Routen und Tutorial-Overlay entfernen  
9. **Build & Smoke-Test:** `npm run build`, manuell Login, Dashboard, Channel öffnen, Admin Channels + Kategorien prüfen  

---

## 8. Ergebnis

- **Stabile, schlanke App:** Nur Auth, Dashboard, Einstellungen, Channels (inkl. Chat), Admin nur Channel-Manager + Kategorien (+ optional App-Einstellungen).  
- **Schnellerer Einstieg:** Kein 5 s-Block im Admin, kürzerer Auth-Timeouts.  
- **Weniger Fehlerquellen:** Keine Tickets, Produkte, Lizenzen, Scheduler etc. – weniger Code, weniger Angriffsfläche.
