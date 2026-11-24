'use client';

import { Plus } from 'lucide-react';
import * as React from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { Textarea } from '~/components/ui/textarea';

// interface FormProfilKegiatanProps {
//   profilId?: string;
//   lembagaId?: string;
//   isTambah?: boolean;
//   customClassName?: string;
//   isOpen?: boolean;
//   onClose?: () => void;
//   defaultName?: string;
//   defaultDescription?: string;
//   defaultProfilKM?: string[];
// }

type SelectOption = { value: string; label: string };

export default function FormProfilKegiatan({
  open,
  setOpen,
  modalType,
  profil,
  setProfil,
  deskripsi,
  setDeskripsi,
  pemetaan,
  setPemetaan,
  handleSimpanTambah,
  handleSimpanEdit,
  handleBatal,
  selectOptions,
  // title,
  saveButtonText = 'Simpan Perubahan',
  cancelButtonText = 'Batal',
  customClassName,
}: {
  open: boolean;
  setOpen: (val: boolean) => void;
  modalType: 'tambah' | 'edit';
  profil: string;
  setProfil: (val: string) => void;
  deskripsi: string;
  setDeskripsi: (val: string) => void;
  pemetaan: string[];
  setPemetaan: (val: string[]) => void;
  handleSimpanTambah: () => void;
  handleSimpanEdit: () => void;
  handleBatal: () => void;
  selectOptions: SelectOption[];
  title?: string;
  saveButtonText?: string;
  cancelButtonText?: string;
  customClassName?: string;
}) {
  const [selects, setSelects] = React.useState<number[]>(
    pemetaan.length ? pemetaan.map((_, i) => i) : [0],
  );
  const addSelect = () => setSelects([...selects, selects.length]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className={`flex h-auto max-h-screen w-[907px] max-w-none flex-col gap-[21px] overflow-auto rounded-[26.1px] border-[0.82px] border-[#C4CACE] bg-white px-9 py-6 text-[#141718] ${customClassName}`}
        aria-describedby={undefined}
      >
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-2xl font-semibold">
            {modalType === 'tambah'
              ? 'Tambah Profil Kegiatan'
              : 'Edit Profil Kegiatan'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <label className="text-xl">Profil</label>
          <Input
            id="profil"
            value={profil}
            onChange={(e) => setProfil(e.target.value)}
            placeholder="Masukkan nama profil"
            className="h-[48px] rounded-xl px-6 text-[20px]"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xl">Deskripsi Profil</label>
          <Textarea
            value={deskripsi}
            onChange={(e) => setDeskripsi(e.target.value)}
            placeholder="Jelaskan tentang profil ini ..."
            className="min-h-[152px] resize-none rounded-xl px-6 py-4 !text-[20px]"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xl">Pemetaan dengan Profil KM ITB</label>
          <div className="flex flex-col gap-[10px] overflow-y-auto">
            {selects.map((id) => (
              <div
                className="flex flex-row justify-between gap-[16px]"
                key={id}
              >
                <Select
                  onValueChange={(value) => {
                    const newPemetaan = [...pemetaan];
                    newPemetaan[id] = value;
                    setPemetaan(newPemetaan);
                  }}
                  value={pemetaan[id] ?? ''}
                >
                  <SelectTrigger className="flex h-[48px] max-w-[759px] rounded-xl px-6 text-[20px] text-[#636A6D]">
                    <SelectValue
                      placeholder="Pilih Profil KM ITB"
                      className="whitespace-normal break-words"
                    />
                  </SelectTrigger>
                  <SelectContent side="bottom" className="max-w-[759px]">
                    {selectOptions
                      .filter((option) => {
                        const isAlreadySelected = pemetaan.some(
                          (selectedValue, index) =>
                            index !== id && selectedValue === option.value,
                        );
                        return !isAlreadySelected;
                      })
                      .map((profil) => (
                        <SelectItem key={profil.value} value={profil.value}>
                          {profil.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  onClick={addSelect}
                  variant="outline"
                  className="flex h-[48px] w-[54px] items-center justify-center rounded-xl border border-[#C4CACE] px-6 py-3 text-[#444444]"
                >
                  <Plus className="h-6 w-6" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center gap-4 pt-4">
          <Button
            variant="warning"
            className="h-[40px] w-[120px] rounded-xl bg-[#F16350] px-6 py-3 text-[14px] font-bold"
            onClick={handleBatal}
          >
            {cancelButtonText}
          </Button>
          <Button
            onClick={
              modalType === 'tambah' ? handleSimpanTambah : handleSimpanEdit
            }
            className="h-[40px] w-[196px] rounded-xl bg-[#2B6282] px-6 py-3 text-[14px] font-bold hover:bg-[#1a4a5c]"
          >
            {saveButtonText}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
