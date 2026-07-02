export function ReportAccessDenied() {
  return (
    <main className="min-h-screen bg-neutral-50 p-6 text-neutral-900 dark:bg-neutral-950 dark:text-white">
      <section className="mx-auto max-w-3xl rounded-lg border border-red-200 bg-white p-8 dark:border-red-500/30 dark:bg-neutral-900">
        <h1 className="text-2xl font-bold">Akses laporan dibatasi</h1>
        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
          Tidak memiliki izin untuk membuka laporan. Permission forbidden untuk role ini.
        </p>
      </section>
    </main>
  );
}
