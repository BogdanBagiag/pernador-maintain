-- Pasul 1 din unificarea clientilor (Comenzi + Datorii Clienti foloseau pana acum
-- doua tabele separate, com_clienti si datorii_clienti, fara nicio legatura intre
-- ele - de aici acelasi client real aparand cu nume diferite in cele doua zone).
--
-- Acest fisier creeaza NOUL tabel unic "clienti", fara sa modifice sau sa stearga
-- nimic din tabelele existente (com_clienti, datorii_clienti raman neatinse si
-- aplicatia continua sa functioneze exact ca inainte). E sigur de rulat oricand.
--
-- Dupa ce rulezi acest fisier, foloseste pagina Admin > "Unificare Clienți" din
-- aplicatie (o singura data) ca sa muti datele din cele doua tabele vechi in
-- acesta, cu revizuire manuala a potrivirilor. Abia DUPA aceea se ruleaza
-- migratia a doua (clienti_unificat_fk.sql), care leaga Comenzi si Datorii
-- Clienti de acest tabel si arhiveaza tabelele vechi.

CREATE TABLE IF NOT EXISTS public.clienti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nume text NOT NULL UNIQUE,
  cif text,
  email text,
  telefon text,
  adresa text,
  vizibil boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.clienti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read clienti"
  ON public.clienti FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can insert clienti"
  ON public.clienti FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can update clienti"
  ON public.clienti FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can delete clienti"
  ON public.clienti FOR DELETE
  USING (auth.role() = 'authenticated');
