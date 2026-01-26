-- Allow specific emails to manage tenants from the client app
create policy "Tenant admins manage tenants"
  on public.tenants
  for all
  to authenticated
  using (
    (auth.jwt() ->> 'email') in (
      'lucas.defoliveira@gmail.com',
      'diego.fjddf@gmail.com'
    )
  )
  with check (
    (auth.jwt() ->> 'email') in (
      'lucas.defoliveira@gmail.com',
      'diego.fjddf@gmail.com'
    )
  );
