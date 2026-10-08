-- GreetAndWin: support priority must belong only to verified supporters.
create or replace function public.set_report_priority()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.priority := exists (
    select 1
    from public.profiles p
    where p.id = new.user_id
      and p.support_priority = true
  );
  return new;
end;
$$;

drop trigger if exists reports_priority on public.reports;
create trigger reports_priority
before insert on public.reports
for each row execute function public.set_report_priority();

create index if not exists reports_priority_created_idx
  on public.reports(priority desc, created_at desc);
