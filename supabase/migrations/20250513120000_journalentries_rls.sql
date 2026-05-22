-- journalEntries: allow each authenticated user to read and insert only their own rows.
-- Fixes: new row violates row-level security policy for table "journalEntries"

ALTER TABLE "journalEntries" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "journal_entries_select_own" ON "journalEntries";
CREATE POLICY "journal_entries_select_own"
  ON "journalEntries"
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "journal_entries_insert_own" ON "journalEntries";
CREATE POLICY "journal_entries_insert_own"
  ON "journalEntries"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);
