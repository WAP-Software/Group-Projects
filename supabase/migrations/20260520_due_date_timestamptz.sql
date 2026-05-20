-- Change tasks.due_date from date to timestamptz
-- Existing date values are preserved at noon (12:00) so deadlines remain on the correct day
ALTER TABLE public.tasks
  ALTER COLUMN due_date TYPE timestamptz
  USING (due_date + time '12:00:00');
