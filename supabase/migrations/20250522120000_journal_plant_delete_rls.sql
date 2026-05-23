-- Allow users to delete their own journal entries and plant assets.

DROP POLICY IF EXISTS "journal_entries_delete_own" ON "journalEntries";
CREATE POLICY "journal_entries_delete_own"
  ON "journalEntries"
  FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "plant_assets_delete_own" ON "plantAssets";
CREATE POLICY "plant_assets_delete_own"
  ON "plantAssets"
  FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id);
