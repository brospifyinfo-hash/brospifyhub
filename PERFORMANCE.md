# Performance – Was wir gemacht haben & was du noch tun kannst

## Bereits umgesetzt in der App

### 1. Nachrichten (Channel-Chat)
- **Limit:** Es werden nur die **letzten 50 Nachrichten** geladen, nicht mehr alle. Ältere Nachrichten werden nicht abgerufen.
- **Schnelle Anzeige:** Zuerst werden nur **Channel + Nachrichten** geladen und sofort angezeigt. Favoriten, Admin-Check und Rollen-Badges laden **danach im Hintergrund** und blockieren die Anzeige nicht.
- **Paralleles Laden:** Channel und Nachrichten werden in **einem parallelen Request** (Promise.all) geholt.

### 2. Channel-Seite
- **Code-Splitting:** Die Chat-Komponenten (MessageArea, MessageInput etc.) werden erst geladen, wenn du einen Channel öffnest (dynamic import). So ist der erste App-Start leichter.

### 3. Sidebar
- **Member-Count:** Die Member-Anzeige wird **300 ms verzögert** geladen, damit die Sidebar zuerst erscheint und die App nicht auf den Count wartet.

---

## Was du zusätzlich tun kannst

### Supabase / Datenbank

1. **Index prüfen**  
   Es gibt bereits `idx_messages_channel` und `idx_messages_created`. Wenn Nachrichten trotzdem langsam sind, in Supabase Dashboard unter **Database → Query Performance** prüfen, ob Abfragen auf `messages(channel_id, created_at DESC)` einen Index nutzen. Gegebenenfalls einen **zusammengesetzten Index** anlegen:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_messages_channel_created
   ON public.messages (channel_id, created_at DESC);
   ```

2. **Realtime reduzieren**  
   Wenn du Realtime für viele Channels/Tabellen nutzt, lastet das auf Verbindung und CPU. Prüfen, ob alle Subscriptions nötig sind (z. B. nur für den aktuell geöffneten Channel abonnieren – das macht die App bereits).

3. **Region**  
   Supabase-Projekt in einer Region nahe deiner Nutzer wählen (z. B. EU), um Latenz zu verringern.

### Hosting & Netzwerk

4. **Next.js / Vercel**  
   App nahe an den Nutzern deployen (z. B. Vercel mit passender Region). So werden HTML und API schneller ausgeliefert.

5. **Bilder**  
   Wenn viele Bilder in Nachrichten vorkommen: **Supabase Storage CDN** oder einen Image-Proxy (z. B. Next.js `Image` mit passendem Loader) nutzen, damit Bilder gebündelt und optimiert geladen werden.

### Optional in der App

6. **„Ältere Nachrichten laden“**  
   Aktuell werden nur die letzten 50 Nachrichten angezeigt. Wenn du willst, kann ein Button „Ältere Nachrichten laden“ ergänzt werden, der die nächsten 50 (oder mehr) nachlädt – ohne die ersten 50 nochmal zu laden.

7. **Caching**  
   Für Daten, die sich selten ändern (z. B. App-Name, Channel-Liste), könnte man **React Query / SWR** oder kurzes in-memory Caching nutzen. Das wäre ein nächster Schritt für feinere Optimierung.

---

## Kurzfassung

- **App:** Nur 50 Nachrichten pro Channel, schnelle Anzeige durch paralleles Laden und Hintergrund-Laden von Favoriten/Rollen, Code-Splitting für die Channel-Seite, verzögerter Member-Count.
- **Du:** Index für `(channel_id, created_at DESC)` prüfen/anlegen, Region bei Supabase und Hosting wählen, bei Bedarf „Ältere Nachrichten“ und Caching ergänzen.
