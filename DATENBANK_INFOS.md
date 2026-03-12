# Was die Datenbank für Brospify Hub braucht

## 1. Schema (Tabellen & RLS)

**Alle Migrationen in Reihenfolge ausführen** (Supabase Dashboard → SQL Editor oder `supabase db push`):

- `001_initial_schema.sql` … bis … `020_slash_commands_category.sql`  
  in `supabase/migrations/`

Damit entstehen u. a.:

- **Kern:** `users`, `channels`, `messages`
- **Auth/Lizenzen:** `internal_keys`, `user_devices`
- **Rollen:** `roles`, `permissions`, `role_permissions`, `user_roles`, `channel_role_permissions`, ggf. `channel_role_overrides`
- **Profile:** `user_profiles`, `user_stats`, `user_notes`, `user_warnings`, `user_presence`, `activity_log`, `achievements`, `user_achievements`
- **Content:** `channel_categories`, `channel_stats`, `scheduled_posts`, `custom_emojis`, `quick_replies`, `tutorial_steps`, `user_tutorial_progress`
- **Produkte:** `products`, `product_variants`, `product_price_tiers`, `variant_price_links`, `payment_methods`, `product_payment_methods`, `product_content`, `user_purchases`
- **Support:** `support_conversations`, `support_messages`, `support_helpers`, `tickets`, `ticket_messages`, `ticket_categories`
- **Sonstiges:** `app_settings`, `user_favorites`, `user_channel_permissions`, `internal_keys`, `slash_commands`, `slash_command_roles`, Storage-Bucket `attachments`

Wichtig: Der **Trigger** `on_auth_user_created` (Migration 008) legt bei jedem neuen Auth-User automatisch einen Eintrag in `public.users` an.

---

## 2. Pflicht-Daten (damit die App funktioniert)

### 2.1 Rollen & Berechtigungen

Werden von den Migrationen **012** und **013** (ggf. **015**) eingespielt:

- **roles:** z. B. `owner`, `admin`, `moderator`, `support`, `vip`, `member`, `guest`
- **permissions:** viele Einträge (manage_roles, send_messages, send_images, …)
- **role_permissions:** Verknüpfung Rolle ↔ Berechtigung

Ohne diese Daten funktionieren Rollen und Channel-Rechte nicht korrekt.

### 2.2 App-Einstellungen

Werden in **009** und **016** eingefügt:

- `app_settings`: z. B. `app_name`, `app_logo_url`, `app_primary_color`, `welcome_title`, `welcome_text`, `default_language`, `max_upload_size_mb`, …

Mindestens die in den Migrationen genannten Keys sollten vorhanden sein.

### 2.3 Lizenzen (User-Login)

- **Tabelle:** `internal_keys`
- **Spalten:** `key_value` (eindeutig), `is_assigned` (boolean), `assigned_to` (UUID, optional), `assigned_at` (optional), `is_active` (boolean, Standard `true`)

**Damit sich ein Nutzer mit Lizenz-Key einloggen kann:**

- Es muss **mindestens ein** aktiver Key existieren:  
  `INSERT INTO public.internal_keys (key_value, is_active) VALUES ('DEIN-KEY-HIER', true);`
- Beim ersten Login mit diesem Key wird ein User in `auth.users` angelegt, in `public.users` (via Trigger bzw. Auth-Action) mit `license_key` versehen und der Key in `internal_keys` mit `is_assigned = true` und `assigned_to = user.id` verknüpft.

Keys kannst du auch im Admin unter **Lizenzen** anlegen/importieren (dann muss die Tabelle `internal_keys` die Spalte `is_active` haben, Migration 009).

### 2.4 Erster Admin

- **Login als Admin** nutzt den festen Master-Key (im Code: `ADMIN_MASTER_KEY`), **nicht** die Tabelle `internal_keys`.
- Damit sich jemand als Admin einloggen kann, muss:
  1. In **Supabase Auth** ein User existieren (z. B. per Dashboard angelegt oder per `auth.admin.createUser`).
  2. In **public.users** ein Eintrag mit derselben `id` und **role = 'admin'** existieren.

Vorgehen typisch:

- User in Supabase Dashboard (Authentication → Users) anlegen **oder** per Migration/Script einen Auth-User erstellen.
- Danach in `public.users` für diese `id` setzen:  
  `UPDATE public.users SET role = 'admin' WHERE id = 'UUID-DES-AUTH-USERS';`  
  (Falls der Trigger den User schon als `user` angelegt hat, reicht dieses UPDATE.)

---

## 3. Optionale / nützliche Start-Daten

| Was | Tabelle(n) | Nutzen |
|-----|------------|--------|
| Channel-Kategorien | `channel_categories` | Kategorien in der Channel-Liste (Migration 010 fügt Beispiele ein) |
| Ticket-Kategorien | `ticket_categories` | Kategorien beim Ticket-Erstellen (Migration 016: z. B. Allgemein, Technisch, Abrechnung, Sonstiges) |
| Slash-Befehle | `slash_commands`, `slash_command_roles` | Nur relevant, wenn du Slash-Commands wieder aktivierst (in der App aktuell reduziert) |
| Channels | `channels` | Mind. ein Channel (z. B. „Winning Product“ oder „Allgemein“), sonst ist die Liste leer (Migration 009 legt ggf. einen an) |
| Produkte | `products`, … | Nur nötig, wenn du die Produkt-/Shop-Funktion nutzt |

---

## 4. Kurz-Checkliste

1. **Migrationen** der Reihe nach ausführen.
2. **Rollen/Permissions** sind in 012/013/015 enthalten – keine Extra-Inserts nötig, wenn Migrationen laufen.
3. **app_settings** sind in 009/016 enthalten.
4. **Lizenzen:** Mindestens einen Key in `internal_keys` eintragen (oder im Admin „Lizenzen“ anlegen), damit sich Nutzer mit Key anmelden können.
5. **Admin:** Einen Auth-User anlegen und in `public.users` für diese `id` `role = 'admin'` setzen; Login mit dem im Code hinterlegten Admin-Master-Key.

Wenn du willst, kann noch ein kleines **Setup-Script** (eine SQL-Datei) gebaut werden, die nur die minimalen Inserts macht (ein Key + ggf. ein Admin-Setup-Hinweis).
