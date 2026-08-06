-- Adaugă câmpul "Dimensiune Cauciucuri" (ex: 225/65 R17) la mașini.
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS tire_size text;
