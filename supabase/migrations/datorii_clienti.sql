-- Modul "Datorii Clienți" (Documente) - urmarirea sumelor restante de la clienti,
-- pe baza importului periodic al raportului "Sume de incasat" (xls).
--
-- datorii_clienti = baza de date de clienti (numele nu se schimba in timp, e cheia
-- stabila intre importuri succesive); aici tinem si datele de contact (email/telefon)
-- completate manual din aplicatie, care NU sunt suprascrise la reimport.
--
-- datorii_facturi = facturile individuale, identificate unic prin nr_document; la
-- fiecare reimport se actualizeaza (upsert dupa nr_document), iar facturile care nu
-- mai apar in noul extras (pentru ca s-au achitat integral) sunt marcate automat
-- "achitat" din aplicatie (nu din SQL).

CREATE TABLE IF NOT EXISTS public.datorii_clienti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nume text NOT NULL UNIQUE,
  cif text,
  email text,
  telefon text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.datorii_clienti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read datorii_clienti"
  ON public.datorii_clienti FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can insert datorii_clienti"
  ON public.datorii_clienti FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can update datorii_clienti"
  ON public.datorii_clienti FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can delete datorii_clienti"
  ON public.datorii_clienti FOR DELETE
  USING (auth.role() = 'authenticated');

CREATE TABLE IF NOT EXISTS public.datorii_facturi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.datorii_clienti(id) ON DELETE CASCADE,
  nr_document text NOT NULL UNIQUE,
  data_document date,
  scadenta date,
  moneda text DEFAULT 'RON',
  valoare_totala numeric DEFAULT 0,
  incasat numeric DEFAULT 0,
  rest_de_incasat numeric DEFAULT 0,
  achitat boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS datorii_facturi_client_id_idx ON public.datorii_facturi(client_id);
CREATE INDEX IF NOT EXISTS datorii_facturi_achitat_idx ON public.datorii_facturi(achitat);

ALTER TABLE public.datorii_facturi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read datorii_facturi"
  ON public.datorii_facturi FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can insert datorii_facturi"
  ON public.datorii_facturi FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can update datorii_facturi"
  ON public.datorii_facturi FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can delete datorii_facturi"
  ON public.datorii_facturi FOR DELETE
  USING (auth.role() = 'authenticated');
