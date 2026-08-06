-- Unificare clienti - PASUL 1 din migratia FK (inlocuieste clienti_unificat_fk.sql,
-- care incerca sa faca totul intr-un singur pas si crea un cerc vicios: constrangerea
-- veche com_comenzi -> com_clienti blocheaza schimbarea client_id spre id-uri din
-- Datorii Clienti INAINTE sa fie adaugata constrangerea noua, dar constrangerea noua
-- nu poate fi adaugata decat DUPA ce toate valorile client_id sunt deja corecte.
--
-- Acest fisier doar STERGE constrangerea veche (fara sa adauge una noua inca), ca sa
-- deblocheze pasul urmator: rularea din nou a "Rulează unificarea" din Admin >
-- Unificare Clienți, care acum va putea sa actualizeze com_comenzi.client_id spre
-- noile id-uri din tabelul "clienti".
--
-- E sigur de rulat oricand si de mai multe ori (daca deja nu mai exista constrangerea,
-- pur si simplu nu gaseste nimic de sters).

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
