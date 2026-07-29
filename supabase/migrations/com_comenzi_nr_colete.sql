-- Adauga campul "numar de colete" pe comanda (completat ulterior, dupa ce comanda e facuta)
-- com_linii deja are coloanele croit / cusut / produs_ok / livrat (folosite pentru checklist-ul
-- de finalizare per produs), setate implicit false la insert - nu necesita migrare noua.

ALTER TABLE com_comenzi ADD COLUMN IF NOT EXISTS nr_colete INTEGER;
