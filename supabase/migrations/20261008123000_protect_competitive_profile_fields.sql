create or replace function public.protect_profile_competitive_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.elo is distinct from old.elo
      or new.wins is distinct from old.wins
      or new.losses is distinct from old.losses
      or new.banned is distinct from old.banned)
     and not public.has_role('admin', auth.uid()) then
    raise exception 'COMPETITIVE_FIELDS_PROTECTED';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_competitive_fields on public.profiles;
create trigger protect_profile_competitive_fields
before update on public.profiles
for each row execute function public.protect_profile_competitive_fields();
