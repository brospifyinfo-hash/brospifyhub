# Brospify Hub – Mega-Update Plan

## 1. Produkt-Erstellung (Admin)

**Ziel:** Einfacher, verständlicher, mehr Möglichkeiten, echte Bild-Uploads.

| Aufgabe | Umsetzung |
|--------|-----------|
| Bild-Upload | Drag & Drop + Klick-Zone; Upload in Supabase Storage, URL wird gespeichert |
| Vereinfachte UI | Wizard- oder Tab-Struktur: 1) Basis (Name, Slug, Beschreibung), 2) Bild/Banner, 3) Varianten, 4) Preise & Links |
| Mehr Optionen | Optional: Video-URL, PDF-URL, Badge-Text/Farbe, Featured-Toggle, Sortierung |
| Logik prüfen | Validierung: Slug eindeutig, mind. eine Variante, pro Variante/Preisstufe Link oder Credits |

---

## 2. Login-Bereich

**Ziel:** Deutlich schöner und klarer formatiert.

- Zentrierte Karte mit Blur/Glass, klare Typo
- Ein Input: Lizenz-Key, ein Button: Anmelden
- Fehlermeldungen klar und freundlich
- Optional: kleines Logo oben (aus App-Einstellungen)
- Responsive, große Touch-Ziele

---

## 3. Admin Einstellungen

**Ziel:** Logo + viele sinnvolle Optionen.

| Einstellung | Beschreibung |
|------------|--------------|
| App-Logo | Bild-Upload (Drag&Drop), wird oben links in Sidebar/Header angezeigt |
| App-Name | Anzeigename der App |
| Willkommenstext | Für Dashboard oder erste Ansicht |
| Standard-Metadaten | Favicon-URL, SEO-Titel-Suffix |
| Farben | Primärfarbe (z. B. #95BF47), optional Sekundärfarbe |
| Fake-Member-Bonus | Wie bisher |
| Erweiterte Optionen | z. B. Standard-Sprache, Zeitzone, max. Upload-Größe |

Speicherort: `app_settings` (key/value) + neuer Storage-Bucket oder key `app_logo_url`.

---

## 4. Chat-Funktion

**Ziel:** Klare Unterscheidung eigene vs. andere Nachrichten, Rollen-Badge, weniger Ballast.

| Regel | Umsetzung |
|-------|-----------|
| Eigene Nachrichten | Immer rechts, Hintergrund #95BF47 (oder abgeleitete hellere Variante) |
| Andere Nachrichten | Links, neutraler Hintergrund (z. B. Karte/Grau) |
| Rollen-Badge | Neben dem Namen (oder unter dem Avatar) anzeigen, Farbe aus Rolle |
| Entfernen | Streak, Level, Nachrichtenanzahl aus Chat-UI entfernen |
| Social Links | Aus Profil-/Chat-Anzeige entfernen |
| Profile | Klick auf Avatar/Name öffnet Profilseite (z. B. /user/[id]) |

---

## 5. Dashboard

**Ziel:** Optisch und inhaltlich starkes, logisches Update.

- Klare Sektionen: Begrüßung, Schnellaktionen (Support, Produkte, etc.)
- Keine Streak/Level/Nachrichtenanzahl hier (wie gewünscht)
- Optional: letzte Aktivität, offene Tickets, verlinkte Produkte
- Karten-Layout, einheitliche Abstände, evtl. kleine Illustrationen oder Icons
- Responsive Grid

---

## 6. Schnell-Kommando-Zentrale (/ Befehle)

**Ziel:** Slash-Befehle vollständig konfigurierbar, rollenbasiert.

**Datenbank:**

- `slash_commands`: id, name (z. B. `hilfe`), description, action_type (url, internal_route, api_call, text_template), action_value (JSON: url, route, payload), allowed_roles (JSON-Array oder separate Tabelle), is_active, order_index.

**Admin-UI:**

- Liste aller Befehle, Bearbeiten/Erstellen/Löschen
- Pro Befehl: Trigger (z. B. `/hilfe`), Beschreibung, Aktion (Link, interne Route, Text-Snippet), Rollen-Auswahl (welche Rollen dürfen den Befehl nutzen)

**Frontend:**

- In Chat- oder zentralem Eingabefeld: wenn Text mit `/` beginnt, Autocomplete/Liste der erlaubten Befehle anzeigen
- Nach Auswahl/Ausführung: je nach action_type z. B. Navigation, Öffnen eines Modals, Einfügen eines Text-Snippets, Aufruf einer API

**Rollen:** Nur Rollen mit Berechtigung (z. B. `can_use_slash_commands` oder explizite Zuordnung in `slash_commands`) sehen und können den Befehl ausführen.

---

## 7. Ticket-System

**Ziel:** Archiv + Kategorien mit Auswahlfeldern.

| Feature | Umsetzung |
|--------|-----------|
| Status | Z. B. offen, in Bearbeitung, abgeschlossen, archiviert |
| Archiv | Status „archiviert“ oder Filter „Archiv“; archivierte Tickets aus Standard-Liste ausblenden, eigene Ansicht „Archiv“ |
| Abgeschlossen | Wenn Status auf „abgeschlossen“ oder „in Bearbeitung“ (je nach Definition) gesetzt wird, Ticket als erledigt markieren |
| Kategorien | Tabelle `ticket_categories`: name, description, order_index, is_active |
| Auswahlfelder | Beim Erstellen eines Tickets: Dropdown „Kategorie“ (aus ticket_categories); optional weitere Felder (Priorität, Typ) |

Admin: CRUD für Kategorien; User: beim Öffnen eines Tickets Kategorie (und ggf. weitere Felder) auswählen.

---

## 8. Datenbank – Übersicht

- **App-Einstellungen:** app_settings um Keys z. B. `app_logo_url`, `app_primary_color`, `welcome_text` erweitern (oder alles in value als JSON).
- **Produkte:** Bereits vorhanden; ggf. `products.image_url` aus Storage füllen (Upload-Flow).
- **Slash-Commands:** Neue Tabelle `slash_commands` + optional `slash_command_roles` (command_id, role_id).
- **Tickets:** `tickets` um `category_id` (FK auf ticket_categories), `archived_at` (TIMESTAMPTZ, NULL = nicht archiviert) erweitern; Tabelle `ticket_categories`.
- **User/Profile:** Keine Social-Links in der Anzeige (Felder können in DB bleiben); Streak/Level nur aus Dashboard/Chat-UI entfernen, nicht zwingend aus DB löschen.

---

## Reihenfolge der Umsetzung

1. **DB-Migration** – Alle neuen/geänderten Tabellen und Spalten in einer SQL-Datei.
2. **Admin Einstellungen** – Logo-Upload, weitere Optionen, Logo in Sidebar/Header.
3. **Login** – Optik und Formatierung.
4. **Chat** – Eigen rechts/grün, andere links, Rollen-Badge, Streak/Level/Social entfernen, Profil-Link.
5. **Dashboard** – Layout und Inhalte überarbeiten.
6. **Produkt-Erstellung** – Vereinfachte UI, Drag&Drop-Bild, Logik prüfen.
7. **Slash-Commands** – Tabelle, Admin-UI, Frontend-Integration mit Rollenprüfung.
8. **Tickets** – Kategorien, Archiv, Auswahlfelder für User.

Am Ende: Eine vollständige SQL-Datei zum Einfügen in die Datenbank bereitstellen.
