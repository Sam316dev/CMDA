-- Academic performance tracking for Whole Man
-- Run in Supabase SQL editor.

insert into public.staff_pins (role, pin_hash)
values
  ('classrep', crypt('8642', gen_salt('bf'))),
  ('academicsec', crypt('9753', gen_salt('bf')))
on conflict (role) do nothing;

create table if not exists public.academic_scores (
  id bigserial primary key,
  class_id text not null,
  exam_type text not null,
  label text not null,
  average numeric not null,
  count_below_50 integer not null,
  submitted_at timestamptz not null default now()
);

alter table public.academic_scores
  add column if not exists submission_group_id text,
  add column if not exists section_name text,
  add column if not exists section_order integer,
  add column if not exists section_count integer,
  add column if not exists max_score numeric,
  add column if not exists threshold_percent numeric,
  add column if not exists threshold_score numeric,
  add column if not exists count_below_threshold integer;

alter table public.academic_scores enable row level security;

revoke all on public.academic_scores from anon, authenticated;

-- remove legacy signature to keep RPC resolution deterministic

drop function if exists public.submit_class_scores(text, text, text, text, numeric, integer);

create or replace function public.submit_class_scores(
  check_pin text,
  class_id text,
  exam_type text,
  label text,
  average numeric,
  count_below_50 integer,
  submission_group_id text default null,
  section_name text default null,
  section_order integer default null,
  section_count integer default null,
  max_score numeric default null,
  threshold_percent numeric default null,
  threshold_score numeric default null,
  count_below_threshold integer default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.verify_staff_pin(submit_class_scores.check_pin) <> 'classrep' then
    return false;
  end if;

  insert into public.academic_scores (
    class_id,
    exam_type,
    label,
    average,
    count_below_50,
    submission_group_id,
    section_name,
    section_order,
    section_count,
    max_score,
    threshold_percent,
    threshold_score,
    count_below_threshold
  )
  values (
    submit_class_scores.class_id,
    submit_class_scores.exam_type,
    submit_class_scores.label,
    submit_class_scores.average,
    submit_class_scores.count_below_50,
    submit_class_scores.submission_group_id,
    submit_class_scores.section_name,
    submit_class_scores.section_order,
    submit_class_scores.section_count,
    submit_class_scores.max_score,
    submit_class_scores.threshold_percent,
    submit_class_scores.threshold_score,
    submit_class_scores.count_below_threshold
  );

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
  if public.verify_staff_pin(get_academic_data.check_pin) <> 'academicsec' then
    return;
  end if;

  return query
  select a.*
  from public.academic_scores as a
  order by a.submitted_at asc, a.id asc;
end;
$$;

create or replace function public.delete_academic_score(check_pin text, score_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.verify_staff_pin(delete_academic_score.check_pin) <> 'academicsec' then
    return false;
  end if;

  delete from public.academic_scores as a
  where a.id = delete_academic_score.score_id;

  return true;
end;
$$;

grant execute on function public.submit_class_scores(
  text, text, text, text, numeric, integer,
  text, text, integer, integer, numeric, numeric, numeric, integer
) to anon, authenticated;
grant execute on function public.get_academic_data(text) to anon, authenticated;
grant execute on function public.delete_academic_score(text, bigint) to anon, authenticated;
