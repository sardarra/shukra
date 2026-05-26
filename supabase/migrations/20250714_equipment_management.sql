-- Migration: Equipment Management
-- Creates equipment_assets, equipment_reminders, equipment_audit_log, and equipment_attachments tables
-- with RLS policies for per-user data isolation.

-- ============================================================
-- equipment_assets
-- ============================================================
CREATE TABLE IF NOT EXISTS equipment_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  name text NOT NULL,
  specific_name text NOT NULL,
  category text NOT NULL,
  description text,
  account text NOT NULL DEFAULT 'Equipment',
  cost numeric NOT NULL,
  salvage_value numeric NOT NULL DEFAULT 0,
  useful_life_years integer NOT NULL,
  depreciation_method text NOT NULL DEFAULT 'SL',
  purchase_date date NOT NULL,
  last_depreciated_date timestamptz,
  status text NOT NULL DEFAULT 'Active',
  sale_date date,
  sale_price numeric,
  gain_loss numeric,
  associated_journal_entry_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE equipment_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own equipment assets"
  ON equipment_assets FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own equipment assets"
  ON equipment_assets FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own equipment assets"
  ON equipment_assets FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own equipment assets"
  ON equipment_assets FOR DELETE
  USING (auth.uid()::text = user_id);

-- ============================================================
-- equipment_reminders
-- ============================================================
CREATE TABLE IF NOT EXISTS equipment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  type text NOT NULL,
  target_date date NOT NULL,
  notes text,
  is_dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE equipment_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reminders"
  ON equipment_reminders FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own reminders"
  ON equipment_reminders FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own reminders"
  ON equipment_reminders FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own reminders"
  ON equipment_reminders FOR DELETE
  USING (auth.uid()::text = user_id);

-- ============================================================
-- equipment_audit_log
-- ============================================================
CREATE TABLE IF NOT EXISTS equipment_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  action text NOT NULL,
  previous_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE equipment_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit log"
  ON equipment_audit_log FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own audit log entries"
  ON equipment_audit_log FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

-- ============================================================
-- equipment_attachments
-- ============================================================
CREATE TABLE IF NOT EXISTS equipment_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES equipment_assets(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  file_size_bytes integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE equipment_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own attachments"
  ON equipment_attachments FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own attachments"
  ON equipment_attachments FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own attachments"
  ON equipment_attachments FOR DELETE
  USING (auth.uid()::text = user_id);
