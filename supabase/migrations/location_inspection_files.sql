-- Documente atasate unei inspectii de locatie (o inspectie poate avea mai multe fisiere)
CREATE TABLE IF NOT EXISTS public.location_inspection_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.location_inspections(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size bigint,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS location_inspection_files_inspection_id_idx ON public.location_inspection_files(inspection_id);

ALTER TABLE public.location_inspection_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read location_inspection_files"
  ON public.location_inspection_files FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can insert location_inspection_files"
  ON public.location_inspection_files FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Auth users can delete location_inspection_files"
  ON public.location_inspection_files FOR DELETE
  USING (auth.role() = 'authenticated');
