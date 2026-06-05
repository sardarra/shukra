-- Product Manager migration
-- Creates products and product_cost_items tables with RLS policies

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  name text NOT NULL CHECK (char_length(name) <= 150),
  product_type text NOT NULL CHECK (product_type IN ('Physical Good', 'Service')),
  description text,
  selling_price numeric NOT NULL CHECK (selling_price > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own products"
  ON products FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own products"
  ON products FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own products"
  ON products FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own products"
  ON products FOR DELETE
  USING (auth.uid()::text = user_id);

CREATE TABLE IF NOT EXISTS product_cost_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  label text NOT NULL CHECK (char_length(label) <= 150),
  cost_type text NOT NULL CHECK (cost_type IN ('Variable', 'Fixed')),
  amount numeric NOT NULL CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE product_cost_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cost items"
  ON product_cost_items FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own cost items"
  ON product_cost_items FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own cost items"
  ON product_cost_items FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own cost items"
  ON product_cost_items FOR DELETE
  USING (auth.uid()::text = user_id);
