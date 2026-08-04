-- Extrase bancare (Datorii Clienți) - perioadele de tranzacții bancare importate
-- (PDF sau CSV), folosite DOAR pentru a semnala facturi care par deja achitate
-- (avertizare, nu modificare automată). Nu se poate importa o perioadă care se
-- suprapune cu una deja existentă (verificat din aplicație).

CREATE TABLE IF NOT EXISTS public.datorii_extrase_bancare (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sursa text NOT NULL DEFAULT 'pdf', -- 'pdf' sau 'csv'
  fisier_nume text,
  data_inceput date NOT NULL,
  data_sfarsit date NOT NULL,
  nr_tranzactii integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.datorii_extrase_bancare ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read datorii_extrase_bancare"
  ON public.datorii_extrase_bancare FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can insert datorii_extrase_bancare"
  ON public.datorii_extrase_bancare FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can update datorii_extrase_bancare"
  ON public.datorii_extrase_bancare FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can delete datorii_extrase_bancare"
  ON public.datorii_extrase_bancare FOR DELETE
  USING (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS public.datorii_tranzactii_bancare (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extras_id uuid NOT NULL REFERENCES public.datorii_extrase_bancare(id) ON DELETE CASCADE,
  data date NOT NULL,
  suma numeric NOT NULL DEFAULT 0, -- pozitiv = încasare, negativ = plată
  beneficiar text,
  detalii_plata text,
  referinta text UNIQUE, -- ID referință tranzacție bancă, folosit pentru deduplicare
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS datorii_tranzactii_bancare_extras_id_idx ON public.datorii_tranzactii_bancare(extras_id);
CREATE INDEX IF NOT EXISTS datorii_tranzactii_bancare_data_idx ON public.datorii_tranzactii_bancare(data);

ALTER TABLE public.datorii_tranzactii_bancare ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read datorii_tranzactii_bancare"
  ON public.datorii_tranzactii_bancare FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can insert datorii_tranzactii_bancare"
  ON public.datorii_tranzactii_bancare FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can update datorii_tranzactii_bancare"
  ON public.datorii_tranzactii_bancare FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can delete datorii_tranzactii_bancare"
  ON public.datorii_tranzactii_bancare FOR DELETE
  USING (auth.role() = 'authenticated');
