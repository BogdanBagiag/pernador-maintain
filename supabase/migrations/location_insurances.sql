-- Asigurari pentru locatii/cladiri (ex: asigurare cladire)
-- "tip" e text liber (nu enum), la fel ca la location_inspections / property_insurances.
CREATE TABLE IF NOT EXISTS public.location_insurances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  tip text NOT NULL DEFAULT 'Asigurare clădire',
  asigurator text,
  numar_polita text,
  data_inceput date NOT NULL,
  data_expirare date NOT NULL,
  suma_asigurata numeric,
  prima_asigurare numeric,
  observatii text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS location_insurances_location_id_idx ON public.location_insurances(location_id);

ALTER TABLE public.location_insurances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read location_insurances"
  ON public.location_insurances FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can insert location_insurances"
  ON public.location_insurances FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can update location_insurances"
  ON public.location_insurances FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can delete location_insurances"
  ON public.location_insurances FOR DELETE
  USING (auth.role() = 'authenticated');

-- Documente atasate unei asigurari de locatie (o asigurare poate avea mai multe fisiere)
CREATE TABLE IF NOT EXISTS public.location_insurance_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insurance_id uuid NOT NULL REFERENCES public.location_insurances(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size bigint,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS location_insurance_files_insurance_id_idx ON public.location_insurance_files(insurance_id);

ALTER TABLE public.location_insurance_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read location_insurance_files"
  ON public.location_insurance_files FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can insert location_insurance_files"
  ON public.location_insurance_files FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can delete location_insurance_files"
  ON public.location_insurance_files FOR DELETE
  USING (auth.role() = 'authenticated');
