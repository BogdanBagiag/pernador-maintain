-- Payment condition templates
CREATE TABLE IF NOT EXISTS public.payment_condition_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  content text NOT NULL DEFAULT '',
  payment_type text NOT NULL DEFAULT 'term',
  is_default boolean DEFAULT false,
  order_index int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.payment_condition_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users can read payment templates"
  ON public.payment_condition_templates FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Auth users can modify payment templates"
  ON public.payment_condition_templates FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Add column to contracts
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS payment_condition_template_id uuid
  REFERENCES public.payment_condition_templates(id) ON DELETE SET NULL;

-- Seed 3 default templates
INSERT INTO public.payment_condition_templates (name, description, content, payment_type, is_default, order_index)
VALUES
(
  'Plată integrală la termen',
  'Clientul achită 100% în termen de N zile de la facturare',
  'Plata se va efectua integral în termen de {{PAYMENT_TERM_DAYS}} ({{PAYMENT_TERM_TEXT}}) zile calendaristice de la data emiterii facturii.',
  'term', true, 1
),
(
  'Avans + rest la livrare',
  'Un procent avans la semnare, restul la livrarea produselor',
  'Plata se va efectua astfel: (i) {{ADVANCE_PERCENT}}% avans la semnarea comenzii și (ii) {{DELIVERY_PERCENT}}% la livrarea produselor/serviciilor.',
  'advance_delivery', false, 2
),
(
  'Avans + rest la termen',
  'Un procent avans la semnare, restul în termen de N zile',
  'Plata se va efectua astfel: (i) {{ADVANCE_PERCENT}}% avans la semnarea comenzii și (ii) {{INVOICE_TERM_PERCENT}}% în termen de {{INVOICE_TERM_DAYS}} ({{INVOICE_TERM_TEXT}}) zile calendaristice de la data emiterii facturii.',
  'advance_term', false, 3
)
ON CONFLICT DO NOTHING;
