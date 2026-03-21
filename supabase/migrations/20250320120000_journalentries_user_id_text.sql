-- Supabase Auth user ids are UUID strings. If `user_id` is still bigint, convert to text
-- so inserts from the app work. Old numeric ids become their string form.
--
-- Run in Supabase SQL editor or via CLI if you use migrations.
ALTER TABLE "journalEntries"
  ALTER COLUMN user_id TYPE text USING user_id::text;
