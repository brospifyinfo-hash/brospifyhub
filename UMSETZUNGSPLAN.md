# Umsetzungsplan – Brospify Hub

## 1. Reload beschleunigen
- **AuthReady:** Timeout von 3s auf 1,5s reduzieren; Session-Check nicht blockierend (optional: Kinder sofort rendern, Redirect nur bei fehlender Session).
- **Kein Full-Page-Spinner:** Kurzer Check, dann Inhalt anzeigen; ggf. Skeleton statt "Session wird geladen…".

## 2. Rollen-Schreibrechte + Channel-Ausnahmen (synchron)
- **Regel:** Rolle ohne `can_send_messages` = User darf **nirgends** schreiben (außer Admin).
- **Channel-Einstellungen (bei Erstellung/Bearbeitung):**
  - "User dürfen nur Text senden" / "User dürfen nur Bilder senden" bleiben **unter** den Rollenrechten: Nur Nutzer, die laut Rolle schreiben/dürfen, sind betroffen.
  - **Ausnahme pro Channel:** Pro Rolle können explizit "darf hier schreiben" / "darf hier Bilder schicken" als Channel-Ausnahme aktiviert werden (überschreibt Rollen-Standard nur für diesen Channel).
- **Technisch:** `permissions-v2` + DB nutzen: Basis = Rolle (`can_send_messages`, `can_send_images`); Channel = `channel_role_overrides` (oder `channel_role_permissions`). Bei Speichern eines Channels Rollen-Overrides speichern und mit Rollen-Standard synchron halten.

## 3. Entfernen (Kurzbefehle, Profil-Einstellungen, Streak, Unnötiges)
- **Kurzbefehle (Slash-Befehle):** Slash-UI im Chat entfernen (MessageInput: keine Slash-Suggestions, kein `/`-Trigger). Admin-Seite "Slash-Befehle" und Sidebar-Link entfernen.
- **Profil-Einstellungen:** Route `/profile` und große Profil-Settings-Seite entfernen oder auf Minimum reduzieren (nur Anzeigename in Einstellungen behalten). User-Panel: Link "Mein Profil" auf Einstellungen oder Dashboard umbiegen.
- **Streak-Funktion:** Alle Streak-Anzeigen und -Berechnungen entfernen (Dashboard, Profil, User-Role-Manager, Stats).
- **Sonstiges Unnötiges:** Prüfen und entfernen (z. B. doppelte Einstellungen, tote Links).

## 4. Produkterstellung + Preview + Preisklassen (Preisklassen speichern)
- **Produkt-Manager:** Speichern der Preisklassen (product_price_tiers) prüfen – korrekte Insert/Update mit `product_id`, Reihenfolge, Credits, Button-Text etc.
- **Preview:** Nutzer-Preview der Produkte (z. B. ProductShowcase) und Admin-Preview (Produktkachel/Detail) prüfen und fixen.
- **Varianten-Preis-Links:** Sicherstellen, dass beim Speichern von Preisklassen die Verknüpfung zu Varianten (variant_price_links) korrekt gespeichert wird.

## 5. Nachrichten: Styling + Echtzeit
- **Eigene Nachricht:** Nicht mehr komplett grün gefüllt; nur **grüner Rand** (z. B. `border-2 border-primary`), Hintergrund wie andere Nachrichten (z. B. `bg-card` oder leicht abgesetzt).
- **Formatierung:** Nachrichten kompakter – kleinere Schrift, weniger Padding, kürzere Zeilenabstände.
- **Echtzeit:** Nachricht sofort anzeigen, sobald "Senden" geklickt wurde (optimistic update oder Insert mit `.select()` und Event an MessageArea, damit die Liste sofort aktualisiert wird; Realtime bleibt für andere User).

## 6. Login-Seite neu designen
- **Desktop + Mobile:** Layout für beide Ansichten; nicht nur Handy-Format.
- **Neues Design:** Klare Sektionen, Logo/Branding, Lizenz-Key-Eingabe zentriert, optional Illustration oder dezente Grafik; Buttons und Inputs einheitlich, lesbar und gut klickbar.

---

## Reihenfolge der Umsetzung
1. Reload optimieren (AuthReady)
2. Nachrichten: Styling (grüner Rand, kleiner) + Echtzeit (optimistic/sofort anzeigen)
3. Rollen/Channel: Schreibrechte durchsetzen + Channel "nur Text/nur Bilder" + Ausnahmen
4. Kurzbefehle entfernen, Profil/Streak reduzieren/entfernen
5. Produkt + Preisklassen + Preview fixen
6. Login-Seite neu designen

---

## Erledigt (Stand)
- AuthReady Timeout 1,2s; Session aus localStorage.
- Nachrichten: grüner Rand, kompakter; Echtzeit via CustomEvent + Realtime.
- permissions-v2 nutzt channel_role_permissions; Channel-Manager lädt Rollen-Standards aus roles; MessageInput prüft allow_user_text/images/files + canSend*.
- Slash-Befehle aus Chat + Admin-Nav entfernt; /profile → /settings; Streak aus Profil/PublicProfile entfernt.
- Preisklassen-Speichern (saveTier) mit klarem Payload + Fehlerbehandlung; selectedProduct nach Speichern aktualisiert.
- Login: Zwei-Spalten-Desktop, einspaltig Mobile.
- Produkt-Übersicht /products; Sidebar + Mobile „Produkte“; Admin „Als Nutzer ansehen“ pro Produkt.
- Chat-Komponenten nutzen apiFetch für /api/user/profile (Token aus localStorage).
- Loading-Spinner: (main)/loading.tsx und (admin)/loading.tsx für Route-Übergänge.
- 404-Seite: app/not-found.tsx mit Hinweis und Links „Zurück“ / „Start“.
- Fehlerseite: error.tsx mit zusätzlichem Link „Zum Dashboard“.
