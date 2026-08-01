# Playwright E2E

## Environment

Copy nilai berikut ke env lokal atau CI secret. Jangan commit credential asli.

```env
E2E_BASE_URL=http://localhost:3000
E2E_WEB_PORT=3000
E2E_API_URL=http://127.0.0.1:4000/api/v1
E2E_START_WEB_SERVER=true
# Opsional setelah `npm run build`: npm run start -- --hostname localhost --port 3000
E2E_WEB_SERVER_COMMAND=

E2E_SUPER_ADMIN_EMAIL=
E2E_SUPER_ADMIN_PASSWORD=
E2E_ADMIN_MANAGER_EMAIL=
E2E_ADMIN_MANAGER_PASSWORD=
E2E_ADMIN_CABANG_EMAIL=
E2E_ADMIN_CABANG_PASSWORD=
E2E_ADMIN_LAYANAN_EMAIL=
E2E_ADMIN_LAYANAN_PASSWORD=
E2E_DOCTOR_EMAIL=
E2E_DOCTOR_PASSWORD=
E2E_NURSE_EMAIL=
E2E_NURSE_PASSWORD=
E2E_MEMBER_EMAIL=
E2E_MEMBER_PASSWORD=
```

## Commands

```powershell
npm.cmd run e2e:install --prefix apps/web
npm.cmd run e2e --prefix apps/web
npm.cmd run e2e:ui --prefix apps/web
npm.cmd run e2e:headed --prefix apps/web
```

Set `E2E_START_WEB_SERVER=false` jika dev server Next.js sudah berjalan.
Untuk suite panjang, build aplikasi lalu isi `E2E_WEB_SERVER_COMMAND` dengan perintah
`npm run start -- --hostname localhost --port 3000` agar memakai server production yang stabil.

## Notes

- `auth/auth.setup.ts` membuat storage state di `e2e/.auth` untuk role yang credential-nya tersedia.
- Smoke login via UI akan skip per role bila env credential role tersebut belum diisi.
- API backend harus sudah berjalan dan dapat diakses melalui `E2E_API_URL`.
