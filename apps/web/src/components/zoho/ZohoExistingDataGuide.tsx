const pullItems = [
  'Organisasi, chart of accounts, pajak, rekening bank, dan metode pembayaran.',
  'Customer, vendor, item/SKU, UOM, serta scope cabang untuk proses pencocokan.',
  'Saldo pembanding pada tanggal cut-off untuk rekonsiliasi, bukan menyalin transaksi satu per satu.',
];

const pushItems = [
  'Master RAHO yang belum ada di Zoho setelah mapping disetujui.',
  'Transaksi baru setelah tanggal cut-off: invoice, pembayaran, expense, PO, bill, dan vendor payment.',
  'Penyesuaian inventory yang sudah approved/posted sesuai kebijakan integrasi.',
];

export function ZohoExistingDataGuide() {
  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-blue-200 bg-blue-50/70 p-5 dark:border-blue-900 dark:bg-blue-950/20 md:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">Data Zoho sudah terisi</p>
          <h2 className="mt-1 text-lg font-semibold">Tarik & cocokkan dulu, baru kirim transaksi baru</h2>
          <p className="mt-1 max-w-3xl text-sm text-neutral-600 dark:text-neutral-300">
            Discovery bersifat read-only. Transaksi terapi dan finance lokal tetap berjalan saat Zoho OFF,
            dry-run, gagal, atau belum selesai dipetakan.
          </p>
        </div>
        <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Aman untuk flow terapi
        </span>
      </div>

      <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">
        <div className="min-w-0 overflow-hidden rounded-xl border border-white/80 bg-white/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
          <h3 className="break-words font-semibold">Tarik dari Zoho (read-only)</h3>
          <ul className="mt-2 min-w-0 list-disc space-y-2 break-words pl-5 text-sm text-neutral-600 dark:text-neutral-300">
            {pullItems.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <div className="min-w-0 overflow-hidden rounded-xl border border-white/80 bg-white/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
          <h3 className="break-words font-semibold">Push dari RAHO (setelah cut-off)</h3>
          <ul className="mt-2 min-w-0 list-disc space-y-2 break-words pl-5 text-sm text-neutral-600 dark:text-neutral-300">
            {pushItems.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </div>

      <div className="mt-4 min-w-0 max-w-full overflow-x-auto rounded-xl border border-blue-100 bg-white/80 dark:border-blue-900 dark:bg-neutral-900/70">
        <table className="min-w-[680px] w-full text-left text-sm">
          <thead className="border-b text-xs uppercase text-neutral-500">
            <tr><th className="p-3">Kondisi data</th><th className="p-3">Tindakan aman</th></tr>
          </thead>
          <tbody className="divide-y dark:divide-neutral-800">
            <tr><td className="p-3">Ada di Zoho dan RAHO</td><td className="p-3">Link/mapping ID; jangan create ulang.</td></tr>
            <tr><td className="p-3">Master hanya ada di Zoho</td><td className="p-3">Ambil lewat discovery, review, lalu hubungkan.</td></tr>
            <tr><td className="p-3">Master hanya ada di RAHO</td><td className="p-3">Push setelah mapping dan tanggal cut-off disetujui.</td></tr>
            <tr><td className="p-3">Transaksi historis ada di Zoho</td><td className="p-3">Jangan push ulang; gunakan saldo awal dan rekonsiliasi.</td></tr>
            <tr><td className="p-3">Transaksi baru setelah cut-off</td><td className="p-3">RAHO menjadi sumber transaksi, Zoho menerima melalui antrean.</td></tr>
          </tbody>
        </table>
      </div>

      <ol className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <li className="rounded-lg border border-blue-100 bg-white/70 p-3 dark:border-blue-900 dark:bg-neutral-900/60"><strong>1. Hubungkan</strong><span className="mt-1 block text-neutral-500">OAuth dan organisasi.</span></li>
        <li className="rounded-lg border border-blue-100 bg-white/70 p-3 dark:border-blue-900 dark:bg-neutral-900/60"><strong>2. Discovery</strong><span className="mt-1 block text-neutral-500">Tarik master read-only.</span></li>
        <li className="rounded-lg border border-blue-100 bg-white/70 p-3 dark:border-blue-900 dark:bg-neutral-900/60"><strong>3. Mapping</strong><span className="mt-1 block text-neutral-500">Review duplikasi dan cut-off.</span></li>
        <li className="rounded-lg border border-blue-100 bg-white/70 p-3 dark:border-blue-900 dark:bg-neutral-900/60"><strong>4. Go-live</strong><span className="mt-1 block text-neutral-500">Dry-run → canary → live.</span></li>
      </ol>
    </section>
  );
}
