CREATE OR REPLACE FUNCTION update_location_path()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.path := NEW.name;
  ELSE
    SELECT path || ' > ' || NEW.name INTO NEW.path
    FROM inventory_location
    WHERE id = NEW.parent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_location_path
BEFORE INSERT OR UPDATE ON inventory_location
FOR EACH ROW
EXECUTE FUNCTION update_location_path();
