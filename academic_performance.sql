-- Academic performance tracking for Whole Man
-- Run in Supabase SQL editor.

insert into public.staff_pins (role_name, pin_hash)
values
  ('classrep', crypt('8642', gen_salt('bf'))),
  ('academicsec', crypt('9753', gen_salt('bf')))
on conflict (role_name) do nothing;

create table if not exists public.academic_scores (
  id bigserial primary key,
  class_id text not null,
  exam_type text not null,
  label text not null,
  average numeric not null,
  count_below_50 integer not null,
  submitted_at timestamptz not null default now()
);

alter table public.academic_scores enable row level security;

create or replace function public.submit_class_scores(
  check_pin text,
  class_id text,
  exam_type text,
  label text,
  average numeric,
  count_below_50 integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.verify_staff_pin(check_pin) <> 'classrep' then
    return false;
  end if;

  insert into public.academic_scores (class_id, exam_type, label, average, count_below_50)
  values (class_id, exam_type, label, average, count_below_50);

  return true;
end;
$$;

create or replace function public.get_academic_data(check_pin text)
returns setof public.academic_scores
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.verify_staff_pin(check_pin) <> 'academicsec' then
    return;
  end if;

  return query
  select *
  from public.academic_scores
  order by submitted_at asc, id asc;
end;
$$;

create or replace function public.delete_academic_score(check_pin text, score_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.verify_staff_pin(check_pin) <> 'academicsec' then
    return false;
  end if;

  delete from public.academic_scores
  where id = score_id;

  return true;
end;
$$;

grant execute on function public.submit_class_scores(text, text, text, text, numeric, integer) to anon, authenticated;
grant execute on function public.get_academic_data(text) to anon, authenticated;
grant execute on function public.delete_academic_score(text, bigint) to anon, authenticated;
