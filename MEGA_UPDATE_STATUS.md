# Brospify Hub – Mega-Update: Vollständiger Status & Plan

## ✅ ERLEDIGT

| # | Feature | Status | Details |
|---|---------|--------|---------|
| 1 | **Login** | ✅ Fertig | Zentrierte Karte, Blur, Logo aus app_settings, ein Input + Button |
| 2 | **Admin App-Settings** | ✅ Fertig | Logo Drag&Drop Upload (Storage `attachments`, Pfad `app/`), App-Name, Primärfarbe, Willkommenstext, Meta-Suffix, max_upload_size |
| 3 | **Sidebar** | ✅ Fertig | Logo und App-Name aus app_settings, MemberCount |
| 4 | **Chat** | ✅ Fertig | Eigene rechts (#95BF47), andere links, Rollen-Badge, keine Streak/Level/Count, keine Social Links, Klick auf Avatar/Name → /user/[id] |
| 5 | **Dashboard** | ✅ Fertig | Keine Streak/Level/Count, Credits, offene Tickets, Willkommensblock, Produkte-Grid |
| 6 | **Profil** | ✅ Fertig | Social Links entfernt |
| 7 | **Datenbank** | ✅ Vorbereitet | IN_DATENBANK_EINFUEGEN.sql mit: slash_commands, slash_command_roles, ticket_categories, tickets.category_id, tickets.archived_at, roles.can_use_slash_commands |

---

## ❌ OFFEN (Muss noch gebaut werden)

### 1. Produkt-Erstellung (Admin)

| Task | Beschreibung |
|------|--------------|
| Bild-Upload | ~~**Kein** Drag&Drop~~ → **Erledigt:** Drag&Drop + Klick-Zone, Upload in Storage `attachments/products/`, URL in image_url gespeichert |
| UI vereinfachen | Wizard/Tabs: 1) Basis (Name, Slug, Beschreibung), 2) Bild, 3) Varianten, 4) Preise/Links (optional) |
| Mehr Optionen | **Erledigt:** Video-URL, PDF-URL optional (Migration 018 + Felder im Produkt-Formular); Badge-Text/Farbe, Featured-Toggle (bereits vorhanden) |
| Validierung | **Erledigt:** Slug-Eindeutigkeit vor dem Speichern; Hinweis wenn keine Varianten (Bestätigung) |

### 2. Slash-Commands

| Task | Beschreibung |
|------|--------------|
| Admin-UI | **Erledigt:** `/admin/slash-commands` – CRUD (SlashCommandsManager), Rollen-Zuordnung (slash_command_roles) |
| Frontend Chat-Input | **Erledigt:** message-input.tsx – bei `/` Autocomplete, Auswahl per Klick oder Enter |
| Ausführung | **Erledigt:** route → router.push, url → window.open, text → in Eingabe einfügen |
| Rollenprüfung | **Erledigt:** Nur Befehle, für die User-Rolle berechtigt ist (slash_command_roles bzw. can_use_slash_commands) |

### 3. Ticket-System

| Task | Beschreibung |
|------|--------------|
| Kategorie-Dropdown | create-ticket-modal.tsx: Beim Erstellen Kategorie auswählen (ticket_categories laden) |
| category_id speichern | Insert mit category_id in tickets |
| Admin ticket_categories | Neue Admin-Seite oder Tab für **Ticket-Kategorien** (nicht channel_categories!) – CRUD |
| Archiv | tickets.archived_at: Wenn Status "in_progress" oder "resolved"/"closed" → optional Archiv-Button; Filter "Archiv" in ticket-list (archived_at IS NOT NULL ausblenden in Standardliste, eigene Ansicht "Archiv") |
| "Abgeschlossen" | Plan: Wenn Status "bearbeitet" → als erledigt markieren. Status "in_progress" / "resolved" / "closed" existieren bereits; Archiv-Logik ergänzen |

**→ Umgesetzt:** database.ts (category_id, archived_at, TicketCategory, roles.can_use_slash_commands), Kategorie-Dropdown im Create-Ticket-Modal, Admin-Seite `/admin/ticket-categories` mit TicketCategoryManager, Archiv-Filter in ticket-list (Aktiv/Archiv), Archiv-Button & Wiederherstellen in ticket-view.

### 4. Typen & Kleinigkeiten

| Task | Beschreibung |
|------|--------------|
| database.ts | tickets: category_id, archived_at zu Row/Insert/Update hinzugefügt; TicketCategory Type für ticket_categories; roles: can_use_slash_commands. |
| Storage-Policy | **Erledigt:** Migration 017 – Admins können in app/ und products/ hochladen; normale User nur in user-id/ |

---

## Reihenfolge der Umsetzung

1. ~~**DB-Typen** – database.ts um tickets.category_id, archived_at, TicketCategory ergänzen~~
2. ~~**Tickets** – Kategorie-Dropdown + Admin ticket_categories + Archiv-Filter~~
3. ~~**Produkte** – Drag&Drop Bild statt URL~~
4. ~~**Slash-Commands** – Admin-UI + Frontend /-Autocomplete~~

---

## Fehlerquellen (bereits behoben / zu prüfen)

| Fehler | Status |
|--------|--------|
| error.tsx ohne "use client" | ✅ Behoben |
| sidebar.tsx doppelte Imports (createClient) | ✅ Behoben |
| Internal Server Error (fehlender Service-Role-Key) | ✅ Dashboard try/catch + Fehlermeldung |
| Storage-Policy für app/ Upload | ✅ Migration 017 – Admins dürfen in app/ und products/ hochladen |

---

## Nächste Schritte

1. ~~`IN_DATENBANK_EINFUEGEN.sql` im Supabase SQL Editor ausführen~~
2. **`IN_DATENBANK_ERWEITERUNGEN.sql`** im Supabase SQL Editor ausführen (Storage-Policy für Logo/Produkt-Upload + Spalten video_url/pdf_url)
3. **`IN_DATENBANK_STANDARD_SLASH_COMMANDS.sql`** im Supabase SQL Editor ausführen (20+ funktionierende Standard-Befehle, Admin-only)
3. ~~database.ts aktualisieren~~
4. ~~Ticket-Kategorien, Archiv, Produkt-Manager, Slash-Commands~~
