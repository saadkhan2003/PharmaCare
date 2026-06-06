-- Add a human-readable batch_code column to the batches table.
--
-- The Expiry Report and the purchase workflow both benefit from showing a
-- user-visible batch identifier (supplier-printed batch number, or a stable
-- internal code). This column is nullable so legacy batches can keep their
-- pre-migration id; new batches created through the purchase service get an
-- auto-generated code "B-{purchase_item_id}".

ALTER TABLE batches ADD COLUMN batch_code TEXT;

CREATE INDEX IF NOT EXISTS idx_batches_batch_code ON batches(batch_code);
