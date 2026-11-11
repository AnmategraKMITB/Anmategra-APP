/**
 * Memantau apakah satu proses Node jenuh. Delay event loop tinggi bersama CPU proses
 * mendekati 100% berarti thread utama (JavaScript) yang jadi leher botol, bukan database.
 * CPU jauh di atas 100% dengan delay rendah berarti kerja ada di thread lain (mis. sharp).
 *
 * Hanya mencatat saat melewati ambang, supaya log tidak banjir. PERF_MONITOR=1 mencatat
 * setiap interval (default 10 dtk, atur lewat PERF_MONITOR_INTERVAL_MS).
 */
import { monitorEventLoopDelay } from 'node:perf_hooks';

export function startPerfMonitor() {
  const intervalMs = Number(process.env.PERF_MONITOR_INTERVAL_MS ?? 10_000);
  const always = process.env.PERF_MONITOR === '1';

  const loop = monitorEventLoopDelay({ resolution: 20 });
  loop.enable();
  let lastCpu = process.cpuUsage();
  let lastAt = process.hrtime.bigint();

  setInterval(() => {
    const now = process.hrtime.bigint();
    const cpu = process.cpuUsage(lastCpu);
    const elapsedUs = Number(now - lastAt) / 1000;
    lastCpu = process.cpuUsage();
    lastAt = now;

    // 100% = satu core penuh, bisa lebih dari 100 kalau thread lain ikut bekerja.
    const cpuPct = ((cpu.user + cpu.system) / elapsedUs) * 100;
    const p99 = loop.percentile(99) / 1e6;
    const max = loop.max / 1e6;
    loop.reset();

    if (always || p99 > 100 || cpuPct > 85) {
      const verdict =
        p99 > 100
          ? cpuPct > 85
            ? 'thread utama jenuh'
            : 'event loop terblokir (tugas sinkron/GC?)'
          : cpuPct > 100
            ? 'beban di thread lain'
            : 'ok';
      console.warn(
        `[PERF] event-loop p99=${p99.toFixed(0)}ms max=${max.toFixed(0)}ms cpu=${cpuPct.toFixed(0)}% -> ${verdict}`,
      );
    }
  }, intervalMs).unref();
}
