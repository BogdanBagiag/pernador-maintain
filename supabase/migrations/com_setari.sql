-- Setari globale pentru modulul Comenzi (aplicabile tuturor utilizatorilor, nu per browser/localStorage)
CREATE TABLE IF NOT EXISTS public.com_setari (
  id int PRIMARY KEY DEFAULT 1,
  termen_livrare_default int NOT NULL DEFAULT 14,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT com_setari_single_row CHECK (id = 1)
);

INSERT INTO public.com_setari (id, termen_livrare_default)
VALUES (1, 14)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.com_setari ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read com_setari"
  ON public.com_setari FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can update com_setari"
  ON public.com_setari FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
