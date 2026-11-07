'use client';

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';

import { useBuilder } from './builder-context';
import { ConditionEditor } from './condition-editor';
import { conditionSources } from './model';

/**
 * Layar penutup setelah kirim. Server memilih yang bersyarat dan terpenuhi
 * lebih dulu (menurut urutan di sini), lalu yang tanpa syarat, lalu ucapan
 * terima kasih standar.
 */
export function EndingsPanel() {
  const builder = useBuilder();
  const endings = builder.detail?.endings ?? [];
  const sources = conditionSources(builder.groups, null);

  const move = (index: number, delta: number) => {
    const ids = endings.map((e) => e.id);
    const to = index + delta;
    if (to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to]!, ids[index]!];
    void builder.reorderEndingIds(ids);
  };

  return (
    <section
      aria-labelledby="endings-heading"
      className="rounded-[24px] border border-neutral-400 bg-neutral-100 p-3 sm:p-5"
    >
      <h3
        id="endings-heading"
        className="text-lg font-semibold text-neutral-1000"
      >
        Ending
      </h3>
      <p className="mt-1 text-sm text-neutral-700">
        Pesan yang tampil setelah jawaban terkirim. Ending bersyarat dicek lebih
        dulu menurut urutan; bila tidak ada yang cocok, dipakai ending tanpa
        syarat, lalu ucapan terima kasih standar.
      </p>

      <ol className="mt-4 grid gap-3">
        {endings.map((ending, index) => (
          <li
            key={ending.id}
            className="grid gap-2 rounded-[20px] border border-neutral-400 bg-neutral-50 p-4"
          >
            <Input
              key={`${ending.id}:${ending.title}`}
              defaultValue={ending.title}
              aria-label={`Judul ending ${index + 1}`}
              maxLength={255}
              className="font-semibold"
              onBlur={(e) => {
                const value = e.currentTarget.value.trim();
                if (value && value !== ending.title) {
                  void builder.editEnding(ending.id, { title: value });
                } else {
                  e.currentTarget.value = ending.title;
                }
              }}
            />
            <Textarea
              key={`${ending.id}:d:${ending.description ?? ''}`}
              defaultValue={ending.description ?? ''}
              aria-label={`Isi ending ${index + 1}`}
              placeholder="Pesan untuk pengisi (opsional)"
              maxLength={2000}
              rows={2}
              onBlur={(e) => {
                const value = e.currentTarget.value.trim();
                if (value !== (ending.description ?? '')) {
                  void builder.editEnding(ending.id, {
                    description: value || null,
                  });
                }
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <ConditionEditor
                title={ending.title}
                value={ending.condition}
                sources={sources}
                onSave={(condition) =>
                  void builder.editEnding(ending.id, { condition })
                }
              />
              <div className="ml-auto flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Naikkan ending"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Turunkan ending"
                  disabled={index >= endings.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Hapus ending"
                  className="text-danger-dark hover:text-danger-dark"
                  onClick={() => void builder.removeEnding(ending.id)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-3">
        <Button
          variant="dark_blue_outline"
          onClick={() =>
            void builder.addEnding({
              title: endings.length === 0 ? 'Terima kasih!' : 'Ending baru',
              description: null,
            })
          }
        >
          <Plus /> Tambah ending
        </Button>
      </div>
    </section>
  );
}
