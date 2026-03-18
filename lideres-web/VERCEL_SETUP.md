# Deploy & Auth Setup (Vercel + Supabase)

This guide ensures signup/signin with email/password works correctly on Vercel.

## Required environment variables (Vercel Dashboard -> Project -> Settings -> Environment Variables)

- NEXT_PUBLIC_SUPABASE_URL = https://xyzcompany.supabase.co
- NEXT_PUBLIC_SUPABASE_ANON_KEY = <anon-public-key>
- SUPABASE_SERVICE_ROLE_KEY = <service-role-key> (server-only, mark as "Encrypted" and do NOT expose)
- PROVISION_ADMIN_SECRET = <your-provision-secret> (server-only)
- NEXT_PUBLIC_APP_URL = https://your-site.vercel.app

Note: Do NOT set `SUPABASE_SERVICE_ROLE_KEY` as a public env variable. Mark it for Production only and as secret.

## Configure SMTP in Supabase (so `signUp` can send confirmation emails)
1. Open your Supabase project -> Authentication -> Settings -> Email
2. Under "SMTP settings" fill in:
   - SMTP host (e.g. smtp.gmail.com for Gmail)
   - SMTP port (587)
   - SMTP user (your SMTP username or API key user e.g. "apikey")
   - SMTP pass (app password or API key)
3. Set `Site URL` to `https://your-site.vercel.app` and add `Redirect URLs` used by your app.
4. Save changes, then check Authentication Logs for send attempts.

### Gmail quick test
- Generate an App Password: https://myaccount.google.com/apppasswords
- Use `SMTP_USER` = your email, `SMTP_PASS` = generated app password, host `smtp.gmail.com`, port `587`.

## How to create an already-confirmed user (admin flow)
Use the included API route `/api/provision-admin` which requires `PROVISION_ADMIN_SECRET` and the service role key on the server.

Example curl (replace values):

```bash
curl -X POST https://your-site.vercel.app/api/provision-admin \
  -H "Content-Type: application/json" \
  -d '{"secret":"mi-secreto-super-privado","email":"admin@example.com","password":"UnaPassSegura123!","role":"Admin"}'
```

Response expected: `{"ok":true,...}`. Then you can login normally.

## Testing checklist after deploy
1. Deploy to Vercel with the env vars set.
2. Open `https://your-site.vercel.app/admin/login`.
3. Try `Crear cuenta` with email+password.
4. If the UI shows "Revisa tu correo para confirmar la cuenta." then check your email (or Supabase logs).
5. If you want immediate access, use the `provision-admin` curl above to create a confirmed user.

## Troubleshooting
- If `signUp` returns an error in the UI, copy the message shown in the login page (we added explicit error display).
- If emails are not sent: check SMTP credentials and Supabase Logs.
- If keys are incorrect: check Vercel env values and that `NEXT_PUBLIC_SUPABASE_URL` matches the project.

---
If you want, I can also:
- Add a small admin-only UI page to call `provision-admin` from the dashboard (requires `PROVISION_ADMIN_SECRET`).
- Walk you step-by-step through the Supabase SMTP settings while you have the dashboard open.
