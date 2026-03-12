-- Schnellere Abfrage: letzte Nachrichten pro Channel (ORDER BY created_at DESC LIMIT N)
CREATE INDEX IF NOT EXISTS idx_messages_channel_created_desc
ON public.messages (channel_id, created_at DESC);
