-- Unificare clienti - PASUL 2 (ultimul) din migratia FK. ATENȚIE: ruleaza acest
-- fisier DOAR dupa ce:
--   1. Ai rulat deja clienti_unificat_fk_pas1.sql (sterge constrangerea veche)
--   2. Ai folosit din nou "Rulează unificarea" din Admin > Unificare Clienți si
--      s-a terminat cu succes (căsuța verde, fără eroare) - acum toate valorile
--      com_comenzi.client_id ar trebui sa fie deja id-uri valide din tabelul "clienti"
--
-- Acest fisier: adauga constrangerea noua (com_comenzi -> clienti), repointeaza si
-- datorii_facturi spre clienti, apoi arhiveaza (redenumeste, NU sterge) tabelele
-- vechi com_clienti si datorii_clienti, ca backup.

ALTER TABLE public.com_comenzi
  ADD CONSTRAINT com_comenzi_client_id_clienti_fkey
  FOREIGN KEY (client_id) REFERENCES public.clienti(id);

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

ALTER TABLE public.com_clienti RENAME TO com_clienti_old_backup;
ALTER TABLE public.datorii_clienti RENAME TO datorii_clienti_old_backup;
