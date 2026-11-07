'use client';

import { useMemo, useState } from 'react';
import type { JSX } from 'react';
import { toast } from 'sonner';
import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Label } from '~/components/ui/label';
import { cn } from '~/lib/utils';

import {
  buildChartSvg,
  downloadBlob,
  exportFileStem,
  svgDataUri,
  svgToPngBlob,
} from './export-image';
import type { ChartImageOptions } from './export-image';
import { levelLabelFor, maxDepth } from './model';
import type { Draft, PlacementsByPosition } from './model';

type Format = 'png' | 'svg';

function Segmented<T extends string | number>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}): JSX.Element {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-neutral-1000">{props.label}</p>
      <div className="flex gap-2">
        {props.options.map((option) => (
          <Button
            key={String(option.value)}
            type="button"
            size="sm"
            variant={
              props.value === option.value ? 'light_blue' : 'dark_blue_outline'
            }
            aria-pressed={props.value === option.value}
            onClick={() => props.onChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function CheckRow(props: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}): JSX.Element {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-2">
        <Checkbox
          id={props.id}
          checked={props.checked}
          disabled={props.disabled}
          onCheckedChange={(value) => props.onChange(value === true)}
        />
        <Label
          htmlFor={props.id}
          className={cn(
            'text-sm font-normal text-neutral-1000',
            props.disabled && 'text-neutral-700',
          )}
        >
          {props.label}
        </Label>
      </div>
      {props.hint ? (
        <p className="pl-6 text-xs text-neutral-700">{props.hint}</p>
      ) : null}
    </div>
  );
}

export function ExportDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: Draft;
  placements: PlacementsByPosition;
}): JSX.Element {
  const { open, onOpenChange, draft, placements } = props;
  const deepest = Math.max(1, maxDepth(draft.units));
  const [format, setFormat] = useState<Format>('png');
  const [depth, setDepth] = useState(deepest);
  const [showPositions, setShowPositions] = useState(true);
  const [showPeople, setShowPeople] = useState(true);
  const [expandGroups, setExpandGroups] = useState(false);
  const [showTitle, setShowTitle] = useState(true);
  const [scale, setScale] = useState(2);
  const [busy, setBusy] = useState(false);

  const options: ChartImageOptions = {
    depthLimit: Math.min(depth, deepest),
    showPositions,
    showPeople: showPositions && showPeople,
    expandGroups: showPositions && expandGroups,
    showTitle,
  };

  const preview = useMemo(
    () => (open ? buildChartSvg(draft, placements, options) : null),
    // options dibangun dari state di bawah ini
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      open,
      draft,
      placements,
      depth,
      deepest,
      showPositions,
      showPeople,
      expandGroups,
      showTitle,
    ],
  );

  const download = async (): Promise<void> => {
    setBusy(true);
    const stem = exportFileStem(draft.name);
    const { svg, width, height } = buildChartSvg(draft, placements, options);
    const saveSvg = (): void =>
      downloadBlob(
        new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
        `${stem}.svg`,
      );
    try {
      if (format === 'svg') {
        saveSvg();
      } else {
        try {
          downloadBlob(
            await svgToPngBlob(svg, width, height, scale),
            `${stem}.png`,
          );
        } catch (error) {
          saveSvg();
          toast.error(
            `PNG gagal dibuat (${error instanceof Error ? error.message : 'tidak diketahui'}). SVG diunduh sebagai gantinya.`,
          );
          onOpenChange(false);
          return;
        }
      }
      toast.success('Gambar diunduh');
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ekspor bagan</DialogTitle>
          <DialogDescription>
            Gambar untuk publikasi atau dokumentasi. Tampilannya berbeda dari
            layar: latar putih, tanpa foto dan tombol.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[17rem_minmax(0,1fr)]">
          <div className="space-y-4">
            <Segmented
              label="Format"
              value={format}
              options={[
                { value: 'png', label: 'PNG' },
                { value: 'svg', label: 'SVG' },
              ]}
              onChange={setFormat}
            />

            <div className="space-y-2">
              <Label
                htmlFor="export-depth"
                className="text-sm font-medium text-neutral-1000"
              >
                Sampai kedalaman
              </Label>
              <select
                id="export-depth"
                value={Math.min(depth, deepest)}
                onChange={(event) => setDepth(Number(event.target.value))}
                className="h-9 w-full rounded-[8px] border border-neutral-400 bg-white px-3 text-sm text-neutral-1000"
              >
                {Array.from({ length: deepest }, (_, index) => index + 1).map(
                  (level) => (
                    <option key={level} value={level}>
                      {level === deepest
                        ? 'Seluruh struktur'
                        : `Sampai ${levelLabelFor(level, draft.levelLabels)} (tingkat ${level})`}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-neutral-1000">Isi bagan</p>
              <CheckRow
                id="export-positions"
                label="Tampilkan jabatan"
                checked={showPositions}
                onChange={setShowPositions}
              />
              <CheckRow
                id="export-people"
                label="Tampilkan nama orang"
                hint="Nama orang menempel pada jabatan."
                checked={showPositions && showPeople}
                disabled={!showPositions}
                onChange={setShowPeople}
              />
              <CheckRow
                id="export-groups"
                label="Buka daftar kelompok jabatan"
                checked={showPositions && expandGroups}
                disabled={!showPositions}
                onChange={setExpandGroups}
              />
              <CheckRow
                id="export-title"
                label="Sertakan judul"
                checked={showTitle}
                onChange={setShowTitle}
              />
            </div>

            {format === 'png' ? (
              <Segmented
                label="Ketajaman"
                value={scale}
                options={[1, 2, 3].map((value) => ({
                  value,
                  label: `${value}×`,
                }))}
                onChange={setScale}
              />
            ) : null}
          </div>

          <div className="min-w-0 space-y-2">
            <p className="text-sm font-medium text-neutral-1000">Pratinjau</p>
            <div className="max-h-[60vh] overflow-auto rounded-[8px] border border-neutral-400 bg-white">
              {preview && preview.nodeCount > 0 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={svgDataUri(preview.svg)}
                  alt="Pratinjau hasil ekspor"
                  className="block h-auto w-full"
                />
              ) : (
                <p className="p-6 text-sm text-neutral-700">
                  Tidak ada bagian yang bisa diekspor.
                </p>
              )}
            </div>
            {preview ? (
              <p className="text-sm tabular-nums text-neutral-700">
                {preview.nodeCount} bagian, {preview.width} × {preview.height}{' '}
                px
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="dark_blue_outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="light_blue"
            disabled={busy || preview?.nodeCount === 0}
            onClick={() => void download()}
          >
            {busy ? 'Menyiapkan' : 'Unduh'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
