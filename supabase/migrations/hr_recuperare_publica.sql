-- Permite angajatului sa isi declare, chiar din formularul public (fara login),
-- cand recupereaza orele de invoire - nu mai trebuie sa astepte ca HR sa le adauge
-- manual din aplicatie. Recuperarea ramane totusi "in_asteptare" pana o aproba cineva
-- din aplicatie, la fel ca inainte.
--
-- Functia e scopata strict la un invoire_id existent (SECURITY DEFINER), acelasi
-- model ca restul functiilor publice din acest modul - nu se poate lista/modifica
-- nimic altceva in afara de a adauga un rand nou in hr_invoire_recuperari.

CREATE OR REPLACE FUNCTION hr_submit_recuperare_invoire(
  p_invoire_id uuid,
  p_data date,
  p_ora_inceput time,
  p_ora_sfarsit time
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM hr_cereri_invoire WHERE id = p_invoire_id) THEN
    RAISE EXCEPTION 'Cerere de învoire invalidă';
  END IF;

  INSERT INTO hr_invoire_recuperari (invoire_id, data, ora_inceput, ora_sfarsit, status)
  VALUES (p_invoire_id, p_data, p_ora_inceput, p_ora_sfarsit, 'in_asteptare')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION hr_submit_recuperare_invoire(uuid, date, time, time) TO anon, authenticated;
