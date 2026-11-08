'use client';

import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';

import { AddMenu } from './add-menu';
import { useBuilder } from './builder-context';
import { ConditionEditor } from './condition-editor';
import { FieldCard } from './field-card';
import { type ContentGroup, conditionSources } from './model';
import { SectionBindingEditor } from './section-binding';

/**
 * Satu bagian beserta pertanyaannya. Grup tanpa bagian (`section: null`)
 * memakai pembungkus yang sama tanpa judul yang bisa diubah.
 */
export function SectionCard({
  group,
  position,
  sectionCount,
  hideTitle = false,
  onDelete,
}: {
  group: ContentGroup;
  /** Urutan bagian ini di antara bagian lain (dari 0); -1 untuk grup tanpa bagian. */
  position: number;
  sectionCount: number;
  /** Grup tanpa bagian saat form belum punya bagian sama sekali: tanpa judul. */
  hideTitle?: boolean;
  onDelete: () => void;
}) {
  const builder = useBuilder();
  const { section, fields } = group;
  const sections = builder.detail?.sections ?? [];
  // Form tanpa bagian: pertanyaan tampil langsung, tanpa kartu bagian di sekelilingnya.
  const bare = !section && hideTitle;

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
      aria-label={section ? section.title : 'Pertanyaan tanpa bagian'}
      className={
        bare
          ? undefined
          : 'rounded-[24px] border border-neutral-400 bg-neutral-100 p-3 sm:p-5'
      }
    >
      {bare ? null : (
        <div className="mb-4 flex flex-wrap items-start gap-3">
          {section ? (
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
          ) : hideTitle ? null : (
            <h3 className="flex-1 text-lg font-semibold text-neutral-1000">
              Tanpa bagian
            </h3>
          )}
          {section ? (
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
                onClick={onDelete}
              >
                <Trash2 />
              </Button>
            </div>
          ) : null}
        </div>
      )}

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

      <div className="mt-4">
        <AddMenu
          onSelect={(kind) => void builder.addField(kind, section?.id ?? null)}
        />
      </div>
    </section>
  );
}
