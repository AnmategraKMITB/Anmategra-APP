'use client';

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';

import { AddMenu } from './add-menu';
import { useBuilder } from './builder-context';
import { ConditionEditor } from './condition-editor';
import { FieldCard } from './field-card';
import { type ContentGroup, conditionSources } from './model';
import { SectionBindingEditor } from './section-binding';

/** Di atas jumlah pertanyaan ini, bagian di editor dilipat kecuali yang pertama. */
const LARGE_FORM_FIELDS = 40;
/** Dikirim panel "Halaman" agar bagian yang memuat pertanyaan tujuan membuka dirinya. */
export const REVEAL_FIELD_EVENT = 'form-builder:reveal-field';

/**
 * Satu bagian beserta pertanyaannya. Grup tanpa bagian (`section: null`)
 * memakai pembungkus yang sama tanpa judul yang bisa diubah.
 */
export function SectionCard({
  group,
  position,
  sectionCount,
  onDelete,
}: {
  group: ContentGroup;
  /** Urutan bagian ini di antara bagian lain (dari 0); -1 untuk grup tanpa bagian. */
  position: number;
  sectionCount: number;
  onDelete: () => void;
}) {
  const builder = useBuilder();
  const { section, fields } = group;
  const sections = builder.detail?.sections ?? [];

  // Form besar (mis. oprec dengan puluhan divisi) merender ratusan kartu sekaligus dan terasa lag
  // setiap kali ada perubahan. Di atas ambang ini hanya bagian pertama yang terbuka dari awal.
  const totalFields = builder.groups.reduce((n, g) => n + g.fields.length, 0);
  const large = totalFields > LARGE_FORM_FIELDS;
  const [open, setOpen] = useState(!large || position <= 0);
  const folded = large && !open;

  // Panel "Halaman" membuka bagian yang memuat pertanyaan tujuan sebelum melompat ke sana.
  useEffect(() => {
    const onReveal = (e: Event) => {
      const fieldId = (e as CustomEvent<string>).detail;
      if (fields.some((f) => f.id === fieldId)) setOpen(true);
    };
    window.addEventListener(REVEAL_FIELD_EVENT, onReveal);
    return () => window.removeEventListener(REVEAL_FIELD_EVENT, onReveal);
  }, [fields]);

  const moveSection = (delta: number) => {
    const ids = sections.map((s) => s.id);
    const from = position;
    const to = from + delta;
    if (!section || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to]!, ids[from]!];
    void builder.reorderSectionIds(ids);
  };

  return (
    <section
      aria-label={section.title}
      className="rounded-[24px] border border-neutral-400 bg-neutral-100 p-3 sm:p-5"
    >
      <div className="mb-4 flex flex-wrap items-start gap-3">
          <div className="grid min-w-0 flex-1 gap-2">
              <Input
                key={`${section.id}:${section.title}`}
                defaultValue={section.title}
                aria-label="Judul bagian"
                maxLength={255}
                className="text-lg font-semibold"
                onBlur={(e) => {
                  const value = e.currentTarget.value.trim();
                  if (value && value !== section.title) {
                    void builder.editSection(section.id, { title: value });
                  } else {
                    e.currentTarget.value = section.title;
                  }
                }}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              />
              <Input
                key={`${section.id}:d:${section.description ?? ''}`}
                defaultValue={section.description ?? ''}
                aria-label="Deskripsi bagian"
                placeholder="Deskripsi bagian (opsional)"
                maxLength={2000}
                onBlur={(e) => {
                  const value = e.currentTarget.value.trim();
                  if (value !== (section.description ?? '')) {
                    void builder.editSection(section.id, {
                      description: value || null,
                    });
                  }
                }}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              />
              <div>
                {builder.detail?.oprec ? (
                  <SectionBindingEditor
                    sectionId={section.id}
                    recruitmentId={builder.detail.oprec.recruitmentId}
                  />
                ) : (
                  <ConditionEditor
                    title={section.title}
                    value={section.condition}
                    sources={conditionSources(builder.groups, {
                      sectionId: section.id,
                    })}
                    onSave={(condition) =>
                      void builder.editSection(section.id, { condition })
                    }
                  />
                )}
              </div>
            </div>
          <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Naikkan bagian"
                disabled={position <= 0}
                onClick={() => moveSection(-1)}
              >
                <ArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Turunkan bagian"
                disabled={position >= sectionCount - 1}
                onClick={() => moveSection(1)}
              >
                <ArrowDown />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Hapus bagian"
                className="text-danger-dark hover:text-danger-dark"
                disabled={sectionCount <= 1}
                onClick={onDelete}
              >
                <Trash2 />
              </Button>
          </div>
      </div>

      {folded ? (
        <Button
          variant="dark_blue_outline"
          aria-expanded={false}
          onClick={() => setOpen(true)}
        >
          <ChevronDown /> Tampilkan {fields.length} pertanyaan
        </Button>
      ) : (
        <>
      <div className="grid gap-4">
        {fields.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-400 px-4 py-6 text-center text-sm text-neutral-700">
            Bagian ini belum berisi pertanyaan.
          </p>
        ) : (
          fields.map((field, index) => (
            <FieldCard
              key={field.id}
              field={field}
              sectionId={section?.id ?? null}
              index={index}
              size={fields.length}
            />
          ))
        )}
      </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
        <AddMenu
          onSelect={(kind) => void builder.addField(kind, section.id)}
        />
            {large ? (
              <Button
                variant="ghost"
                aria-expanded
                onClick={() => setOpen(false)}
              >
                <ChevronUp /> Ciutkan bagian
              </Button>
            ) : null}
      </div>
        </>
      )}
    </section>
  );
}
