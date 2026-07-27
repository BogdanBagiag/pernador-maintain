-- Inspectii periodice pentru locatii/cladiri (ex: PRAM - priza de pamant, ISCIR, stingatoare etc.)
-- "tip" e text liber (nu enum) ca sa poata fi adaugate usor alte tipuri de inspectii pe viitor.
CREATE TABLE IF NOT EXISTS public.location_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  tip text NOT NULL DEFAULT 'PRAM',
  data_inspectie date NOT NULL,
  data_expirare date NOT NULL,
  furnizor text,
  numar_document text,
  observatii text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS location_inspections_location_id_idx ON public.location_inspections(location_id);

ALTER TABLE public.location_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read location_inspections"
  ON public.location_inspections FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can insert location_inspections"
  ON public.location_inspections FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can update location_inspections"
  ON public.location_inspections FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can delete location_inspections"
  ON public.location_inspections FOR DELETE
  USING (auth.role() = 'authenticated');
