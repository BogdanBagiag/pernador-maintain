-- Camp liber de observatii per client (unificat, folosit atat din Comenzi cat si
-- din Datorii Clienti).
ALTER TABLE public.clienti ADD COLUMN IF NOT EXISTS observatii text;
