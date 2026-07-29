-- Suport pentru scanarea publica a bonurilor Pernador Clean (fara autentificare)
-- Nu adaugam o politica RLS "using (true)" pe pernador_clean, pentru ca ar expune tot
-- tabelul (nume/telefon clienti) oricui are cheia anon (care e oricum publica in bundle-ul JS).
-- In loc, folosim 2 functii SECURITY DEFINER care lucreaza doar cu un id explicit, cunoscut
-- doar din codul QR tiparit pe bon - nu se poate "lista" tabelul, doar interoga un id specific.

-- 1. Citire publica a unui singur bon, dupa id
create or replace function pc_get_bon_public(p_bon_id uuid)
returns table (
  id uuid,
  nr_bon integer,
  nume text,
  telefon text,
  status text,
  produse jsonb,
  observatii text,
  created_at timestamptz,
  data_gata timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select id, nr_bon, nume, telefon, status, produse, observatii, created_at, data_gata
  from pernador_clean
  where id = p_bon_id;
$$;

grant execute on function pc_get_bon_public(uuid) to anon, authenticated;

-- 2. Schimbare status publica, dupa id - valideaza statusul, nimic altceva nu se poate modifica
create or replace function pc_advance_status(p_bon_id uuid, p_new_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_new_status not in ('adus', 'in_lucru', 'gata', 'ridicat') then
    raise exception 'Status invalid: %', p_new_status;
  end if;

  update pernador_clean
  set
    status = p_new_status,
    data_gata = case when p_new_status = 'gata' then now() else data_gata end
  where id = p_bon_id;
end;
$$;

grant execute on function pc_advance_status(uuid, text) to anon, authenticated;
