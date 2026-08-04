-- Bifa "afișare" per client la Datorii Clienți - un client marcat ca nevizibil
-- nu mai e considerat/afisat ca datornic (in lista de datorii si in sumar),
-- dar ramane in baza de clienti (nume/CIF/email/telefon) si in facturile lui.
ALTER TABLE public.datorii_clienti ADD COLUMN IF NOT EXISTS vizibil boolean NOT NULL DEFAULT true;
