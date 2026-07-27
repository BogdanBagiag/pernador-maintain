-- Asigurari pentru proprietatile in chirie (ex: asigurare locuinta / PAD)
-- "tip" e text liber (nu enum), la fel ca la location_inspections, ca sa poata fi adaugate usor alte tipuri.
CREATE TABLE IF NOT EXISTS public.property_insurances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.rental_properties(id) ON DELETE CASCADE,
  tip text NOT NULL DEFAULT 'Asigurare locuință',
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

CREATE INDEX IF NOT EXISTS property_insurances_property_id_idx ON public.property_insurances(property_id);

ALTER TABLE public.property_insurances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read property_insurances"
  ON public.property_insurances FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can insert property_insurances"
  ON public.property_insurances FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can update property_insurances"
  ON public.property_insurances FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can delete property_insurances"
  ON public.property_insurances FOR DELETE
  USING (auth.role() = 'authenticated');

-- Documente atasate unei asigurari (o asigurare poate avea mai multe fisiere: polita, anexe etc.)
CREATE TABLE IF NOT EXISTS public.property_insurance_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insurance_id uuid NOT NULL REFERENCES public.property_insurances(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size bigint,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS property_insurance_files_insurance_id_idx ON public.property_insurance_files(insurance_id);

ALTER TABLE public.property_insurance_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read property_insurance_files"
  ON public.property_insurance_files FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can insert property_insurance_files"
  ON public.property_insurance_files FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can delete property_insurance_files"
  ON public.property_insurance_files FOR DELETE
  USING (auth.role() = 'authenticated');
