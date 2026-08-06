-- Pasul 3 din unificarea clientilor - ATENȚIE: ruleaza acest fisier DOAR dupa ce:
--   1. Ai rulat deja clienti_unificat.sql (creeaza tabelul "clienti")
--   2. Ai folosit pagina Admin > "Unificare Clienți" din aplicatie si ai confirmat
--      ca datele din tabelul "clienti" arata corect (clientii din Comenzi si din
--      Datorii Clienti apar unificati acolo, cu numele corecte)
--
-- Acest fisier: leaga definitiv Comenzi (com_comenzi.client_id) si Datorii Clienti
-- (datorii_facturi.client_id) de noul tabel "clienti" in loc de tabelele vechi, apoi
-- arhiveaza (redenumeste, NU sterge) tabelele vechi com_clienti si datorii_clienti,
-- ca sa ramana o copie de siguranta a datelor originale.

-- 1) Repointeaza com_comenzi.client_id spre clienti(id) in loc de com_clienti(id)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.com_comenzi'::regclass
      AND confrelid = 'public.com_clienti'::regclass
      AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.com_comenzi DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.com_comenzi
  ADD CONSTRAINT com_comenzi_client_id_clienti_fkey
  FOREIGN KEY (client_id) REFERENCES public.clienti(id);

-- 2) Repointeaza datorii_facturi.client_id spre clienti(id) in loc de datorii_clienti(id)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.datorii_facturi'::regclass
      AND confrelid = 'public.datorii_clienti'::regclass
      AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.datorii_facturi DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.datorii_facturi
  ADD CONSTRAINT datorii_facturi_client_id_clienti_fkey
  FOREIGN KEY (client_id) REFERENCES public.clienti(id) ON DELETE CASCADE;

-- 3) Arhiveaza tabelele vechi (redenumire, nu stergere - datele raman intacte
-- ca backup si pot fi consultate oricand, dar aplicatia nu le mai foloseste)
ALTER TABLE public.com_clienti RENAME TO com_clienti_old_backup;
ALTER TABLE public.datorii_clienti RENAME TO datorii_clienti_old_backup;
