/**
 * Memantau apakah satu proses Node jenuh. Delay event loop tinggi bersama CPU proses
 * mendekati 100% berarti thread utama (JavaScript) yang jadi leher botol, bukan database.
 * CPU jauh di atas 100% dengan delay rendah berarti kerja ada di thread lain (mis. sharp).
 *
 * Hanya mencatat saat melewati ambang, supaya log tidak banjir. PERF_MONITOR=1 mencatat
 * setiap interval (default 10 dtk, atur lewat PERF_MONITOR_INTERVAL_MS).
 */
export async function register() {
  // Cek runtime harus positif dan impor dinamis, supaya bundel edge tidak memuat modul Node.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startPerfMonitor } = await import('./instrumentation-node');
    startPerfMonitor();
  }
}
