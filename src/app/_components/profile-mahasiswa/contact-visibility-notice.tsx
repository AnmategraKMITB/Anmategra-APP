'use client';

import { X } from 'lucide-react';
import React, { useSyncExternalStore } from 'react';
import { Button } from '~/components/ui/button';

const STORAGE_KEY = 'anmategra:contact-visibility-notice-v1';

// Penyimpanan peramban dibaca lewat useSyncExternalStore supaya tidak ada
// ketidakcocokan hidrasi: server selalu menganggap banner sudah ditutup.
const listeners = new Set<() => void>();
let dismissedThisSession = false;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readDismissed(): boolean {
  if (dismissedThisSession) return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markDismissed() {
  dismissedThisSession = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Penyimpanan tidak tersedia; banner hanya disembunyikan untuk sesi ini.
  }
  listeners.forEach((listener) => listener());
}

/**
 * Pemberitahuan sekali tampil: kontak kini tersembunyi dari mahasiswa lain
 * secara bawaan. Disimpan di peramban (bukan basis data) karena sifatnya hanya
 * kenyamanan.
 */
export function ContactVisibilityNotice({
  anyShown,
  onConfigure,
}: {
  /** Pemilik sudah menyalakan setidaknya satu bidang, jadi tidak perlu diberi tahu. */
  anyShown: boolean;
  onConfigure: () => void;
}) {
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => true);
  if (anyShown || dismissed) return null;

  return (
    <div
      role="status"
      className="mx-auto flex w-full max-w-[600px] items-start justify-between gap-3 rounded-2xl border border-secondary-200 bg-secondary-50 px-4 py-3 text-sm"
    >
      <p className="text-neutral-800">
        Kontakmu (WhatsApp, ID Line, dan email) kini tersembunyi dari mahasiswa
        lain secara bawaan. Owner dan Admin tempat kamu terlibat tetap dapat
        melihatnya.
      </p>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            markDismissed();
            onConfigure();
          }}
        >
          Atur
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={markDismissed}
          aria-label="Tutup pemberitahuan"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
