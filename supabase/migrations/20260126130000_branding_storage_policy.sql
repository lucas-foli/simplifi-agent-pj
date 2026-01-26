-- Storage policies for branding bucket
drop policy if exists "Public read branding assets" on storage.objects;
drop policy if exists "Admin manage branding assets" on storage.objects;

create policy "Public read branding assets"
  on storage.objects for select
  using (bucket_id = 'branding');

create policy "Admin manage branding assets"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'branding'
    and (auth.jwt() ->> 'email') in (
      'lucas.defoliveira@gmail.com',
      'diego.fjddf@gmail.com'
    )
  )
  with check (
    bucket_id = 'branding'
    and (auth.jwt() ->> 'email') in (
      'lucas.defoliveira@gmail.com',
      'diego.fjddf@gmail.com'
    )
  );
