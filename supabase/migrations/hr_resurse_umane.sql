-- Modul Resurse Umane: angajati, cereri de concediu, cereri de invoire + recuperare ore.
--
-- Cererile se pot depune public, fara login, prin scanarea unui cod QR afisat in firma
-- (angajatul isi alege numele dintr-o lista, nu il scrie el, ca sa fie corect in sistem).
-- Ca si la Pernador Clean, NU adaugam politici RLS "using (true)" pe tabele - in loc,
-- folosim functii SECURITY DEFINER limitate strict la ce trebuie sa faca formularul public:
-- listarea angajatilor (fara telefon) si inserarea unei singure cereri noi (status mereu
-- 'in_asteptare' - nu se pot auto-aproba). Aprobarea/gestionarea se face doar din aplicatie,
-- de utilizatori autentificati (RLS standard `auth.role() = 'authenticated'`).

-- ─── Angajati ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_angajati (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nume text NOT NULL,
  prenume text NOT NULL,
  telefon text,
  activ boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.hr_angajati ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read hr_angajati"
  ON public.hr_angajati FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can insert hr_angajati"
  ON public.hr_angajati FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can update hr_angajati"
  ON public.hr_angajati FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can delete hr_angajati"
  ON public.hr_angajati FOR DELETE
  USING (auth.role() = 'authenticated');

-- ─── Cereri de concediu ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_cereri_concediu (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  angajat_id uuid NOT NULL REFERENCES public.hr_angajati(id) ON DELETE CASCADE,
  tip text NOT NULL DEFAULT 'Odihnă', -- Odihnă / Fără plată / Medical / Evenimente deosebite
  data_inceput date NOT NULL,
  data_sfarsit date NOT NULL,
  nr_zile integer NOT NULL,
  observatii text,
  semnatura_base64 text,
  status text NOT NULL DEFAULT 'in_asteptare', -- in_asteptare / aprobat / respins
  motiv_respingere text,
  decis_de uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  data_decizie timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hr_cereri_concediu_angajat_idx ON public.hr_cereri_concediu(angajat_id);
CREATE INDEX IF NOT EXISTS hr_cereri_concediu_status_idx ON public.hr_cereri_concediu(status);
CREATE INDEX IF NOT EXISTS hr_cereri_concediu_perioada_idx ON public.hr_cereri_concediu(data_inceput, data_sfarsit);

ALTER TABLE public.hr_cereri_concediu ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read hr_cereri_concediu"
  ON public.hr_cereri_concediu FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can insert hr_cereri_concediu"
  ON public.hr_cereri_concediu FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can update hr_cereri_concediu"
  ON public.hr_cereri_concediu FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can delete hr_cereri_concediu"
  ON public.hr_cereri_concediu FOR DELETE
  USING (auth.role() = 'authenticated');

-- ─── Cereri de invoire ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hr_cereri_invoire (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  angajat_id uuid NOT NULL REFERENCES public.hr_angajati(id) ON DELETE CASCADE,
  data date NOT NULL,
  ora_inceput time NOT NULL,
  ora_sfarsit time NOT NULL,
  interes text, -- de serviciu / personal / etc (text liber, ca pe formularul de hartie)
  semnatura_base64 text,
  status text NOT NULL DEFAULT 'in_asteptare', -- in_asteptare / aprobat / respins
  motiv_respingere text,
  decis_de uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  data_decizie timestamptz,
  ore_recuperate_complet boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hr_cereri_invoire_angajat_idx ON public.hr_cereri_invoire(angajat_id);
CREATE INDEX IF NOT EXISTS hr_cereri_invoire_status_idx ON public.hr_cereri_invoire(status);
CREATE INDEX IF NOT EXISTS hr_cereri_invoire_data_idx ON public.hr_cereri_invoire(data);

ALTER TABLE public.hr_cereri_invoire ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read hr_cereri_invoire"
  ON public.hr_cereri_invoire FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can insert hr_cereri_invoire"
  ON public.hr_cereri_invoire FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can update hr_cereri_invoire"
  ON public.hr_cereri_invoire FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can delete hr_cereri_invoire"
  ON public.hr_cereri_invoire FOR DELETE
  USING (auth.role() = 'authenticated');

-- ─── Recuperare ore de invoire (adaugata/gestionata din aplicatie de HR) ──
CREATE TABLE IF NOT EXISTS public.hr_invoire_recuperari (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoire_id uuid NOT NULL REFERENCES public.hr_cereri_invoire(id) ON DELETE CASCADE,
  data date NOT NULL,
  ora_inceput time NOT NULL,
  ora_sfarsit time NOT NULL,
  status text NOT NULL DEFAULT 'in_asteptare', -- in_asteptare / aprobat / respins
  decis_de uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  data_decizie timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hr_invoire_recuperari_invoire_idx ON public.hr_invoire_recuperari(invoire_id);

ALTER TABLE public.hr_invoire_recuperari ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read hr_invoire_recuperari"
  ON public.hr_invoire_recuperari FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can insert hr_invoire_recuperari"
  ON public.hr_invoire_recuperari FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can update hr_invoire_recuperari"
  ON public.hr_invoire_recuperari FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can delete hr_invoire_recuperari"
  ON public.hr_invoire_recuperari FOR DELETE
  USING (auth.role() = 'authenticated');

-- ─── Functii publice (fara login) pentru formularul QR ────────────────────

-- 1. Lista angajatilor activi, DOAR nume/prenume (fara telefon), pentru selectorul din formular.
--    E o listare completa intentionat (angajatul trebuie sa se gaseasca pe el in lista),
--    dar expune strict minimul necesar - nu si telefonul.
CREATE OR REPLACE FUNCTION hr_get_angajati_public()
RETURNS TABLE (id uuid, nume text, prenume text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id, nume, prenume
  FROM hr_angajati
  WHERE activ = true
  ORDER BY nume, prenume;
$$;

GRANT EXECUTE ON FUNCTION hr_get_angajati_public() TO anon, authenticated;

-- 2. Depunere cerere de concediu - status e mereu 'in_asteptare', nu se poate auto-aproba.
CREATE OR REPLACE FUNCTION hr_submit_cerere_concediu(
  p_angajat_id uuid,
  p_tip text,
  p_data_inceput date,
  p_data_sfarsit date,
  p_nr_zile integer,
  p_observatii text,
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

  INSERT INTO hr_cereri_concediu (angajat_id, tip, data_inceput, data_sfarsit, nr_zile, observatii, semnatura_base64, status)
  VALUES (p_angajat_id, p_tip, p_data_inceput, p_data_sfarsit, p_nr_zile, p_observatii, p_semnatura_base64, 'in_asteptare')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION hr_submit_cerere_concediu(uuid, text, date, date, integer, text, text) TO anon, authenticated;

-- 3. Depunere cerere de invoire - status e mereu 'in_asteptare', nu se poate auto-aproba.
CREATE OR REPLACE FUNCTION hr_submit_cerere_invoire(
  p_angajat_id uuid,
  p_data date,
  p_ora_inceput time,
  p_ora_sfarsit time,
  p_interes text,
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

  INSERT INTO hr_cereri_invoire (angajat_id, data, ora_inceput, ora_sfarsit, interes, semnatura_base64, status)
  VALUES (p_angajat_id, p_data, p_ora_inceput, p_ora_sfarsit, p_interes, p_semnatura_base64, 'in_asteptare')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION hr_submit_cerere_invoire(uuid, date, time, time, text, text) TO anon, authenticated;
