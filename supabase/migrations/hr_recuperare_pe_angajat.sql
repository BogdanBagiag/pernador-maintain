-- Recuperarea orelor de invoire devine un sold PER ANGAJAT, nu mai e legata de o
-- singura cerere de invoire anume. Angajatul poate depune oricand o cerere de
-- "Recuperare ore", separat de cererea de invoire, iar soldul se calculeaza automat
-- din diferenta dintre orele datorate (invoiri aprobate) si orele deja recuperate
-- (recuperari aprobate).

ALTER TABLE hr_invoire_recuperari ALTER COLUMN invoire_id DROP NOT NULL;
ALTER TABLE hr_invoire_recuperari ADD COLUMN IF NOT EXISTS angajat_id uuid REFERENCES hr_angajati(id) ON DELETE CASCADE;
ALTER TABLE hr_invoire_recuperari ADD COLUMN IF NOT EXISTS motiv_respingere text;
ALTER TABLE hr_invoire_recuperari ADD COLUMN IF NOT EXISTS semnatura_base64 text;
CREATE INDEX IF NOT EXISTS hr_invoire_recuperari_angajat_idx ON hr_invoire_recuperari(angajat_id);

-- 1. Sold public (fara login) - doar 3 numere (ore), pentru un singur angajat explicit.
--    Nu expune niciun detaliu al cererilor, doar totalurile.
CREATE OR REPLACE FUNCTION hr_get_sold_recuperare_public(p_angajat_id uuid)
RETURNS TABLE (ore_datorate numeric, ore_recuperate numeric, sold numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    datorate.total AS ore_datorate,
    recuperate.total AS ore_recuperate,
    datorate.total - recuperate.total AS sold
  FROM
    (SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (ora_sfarsit - ora_inceput)) / 3600), 0) AS total
     FROM hr_cereri_invoire WHERE angajat_id = p_angajat_id AND status = 'aprobat') datorate,
    (SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (ora_sfarsit - ora_inceput)) / 3600), 0) AS total
     FROM hr_invoire_recuperari WHERE angajat_id = p_angajat_id AND status = 'aprobat') recuperate;
$$;

GRANT EXECUTE ON FUNCTION hr_get_sold_recuperare_public(uuid) TO anon, authenticated;

-- 2. Depunere cerere de recuperare, scopata direct la angajat (nu mai necesita o
--    cerere de invoire anume ca parinte). Status mereu 'in_asteptare'.
CREATE OR REPLACE FUNCTION hr_submit_recuperare_public(
  p_angajat_id uuid,
  p_data date,
  p_ora_inceput time,
  p_ora_sfarsit time,
  p_semnatura_base64 text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM hr_angajati WHERE id = p_angajat_id AND activ = true) THEN
    RAISE EXCEPTION 'Angajat invalid';
  END IF;

  INSERT INTO hr_invoire_recuperari (angajat_id, data, ora_inceput, ora_sfarsit, semnatura_base64, status)
  VALUES (p_angajat_id, p_data, p_ora_inceput, p_ora_sfarsit, p_semnatura_base64, 'in_asteptare')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION hr_submit_recuperare_public(uuid, date, time, time, text) TO anon, authenticated;
