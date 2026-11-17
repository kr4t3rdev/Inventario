CREATE OR REPLACE FUNCTION prevent_consumed_opening_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."estado" = 'CONSUMIDA' THEN
    RAISE EXCEPTION 'La apertura consumida es inmutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;
