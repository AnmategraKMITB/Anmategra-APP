'use client';

import { skipToken } from '@tanstack/query-core';
import React, { useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { useToast } from '~/hooks/use-toast';
import { api } from '~/trpc/react';

export type Division = {
  name: string;
  candidates: string[];
};

export type Month = {
  value: string;
  label: string;
};

const months: Month[] = [
  { value: '01', label: 'Januari' },
  { value: '02', label: 'Februari' },
  { value: '03', label: 'Maret' },
  { value: '04', label: 'April' },
  { value: '05', label: 'Mei' },
  { value: '06', label: 'Juni' },
  { value: '07', label: 'Juli' },
  { value: '08', label: 'Agustus' },
  { value: '09', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Desember' },
];

function generateYears(startYear: number, endYear: number): string[] {
  const years: string[] = [];
  for (let year = startYear; year <= endYear; year++) {
    years.push(year.toString());
  }
  return years;
}

type PeriodSelectProps = {
  months: Month[];
  years: string[];
  selectTriggerBase: string;
  selectContentBase: string;
  selectItemBase: string;
  onChange: (data: {
    startMonth: string | null;
    startYear: string | null;
    endMonth: string | null;
    endYear: string | null;
  }) => void;
  initialValues?: {
    startMonth: string | null;
    startYear: string | null;
    endMonth: string | null;
    endYear: string | null;
  };
};

function PeriodSelect({
  months,
  years,
  selectTriggerBase,
  selectContentBase,
  selectItemBase,
  onChange,
  initialValues,
}: PeriodSelectProps) {
  const [startMonth, setStartMonth] = useState<string | null>(
    initialValues?.startMonth ?? null,
  );
  const [startYear, setStartYear] = useState<string | null>(
    initialValues?.startYear ?? null,
  );
  const [endMonth, setEndMonth] = useState<string | null>(
    initialValues?.endMonth ?? null,
  );
  const [endYear, setEndYear] = useState<string | null>(
    initialValues?.endYear ?? null,
  );

  React.useEffect(() => {
    if (initialValues) {
      setStartMonth(initialValues.startMonth);
      setStartYear(initialValues.startYear);
      setEndMonth(initialValues.endMonth);
      setEndYear(initialValues.endYear);
    }
  }, [initialValues]);

  const handleChange = (
    key: 'startMonth' | 'startYear' | 'endMonth' | 'endYear',
    value: string,
  ) => {
    const newState = {
      startMonth,
      startYear,
      endMonth,
      endYear,
      [key]: value,
    };
    if (key === 'startMonth') setStartMonth(value);
    if (key === 'startYear') setStartYear(value);
    if (key === 'endMonth') setEndMonth(value);
    if (key === 'endYear') setEndYear(value);
    onChange(newState);
  };

  return (
    <div className="flex w-full gap-4 mb-4 items-center">
      <Select
        onValueChange={(val) => handleChange('startMonth', val)}
        value={startMonth ?? undefined}
      >
        <SelectTrigger className={`${selectTriggerBase} flex-[2]`}>
          <SelectValue placeholder="Bulan" />
        </SelectTrigger>
        <SelectContent className={selectContentBase}>
          {months.map((m) => (
            <SelectItem
              key={m.value}
              value={m.value}
              className={selectItemBase}
            >
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        onValueChange={(val) => handleChange('startYear', val)}
        value={startYear ?? undefined}
      >
        <SelectTrigger className={`${selectTriggerBase} flex-[1]`}>
          <SelectValue placeholder="Tahun" />
        </SelectTrigger>
        <SelectContent className={selectContentBase}>
          {years.map((y) => (
            <SelectItem key={y} value={y} className={selectItemBase}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="self-center text-sm">s.d.</span>

      <Select
        onValueChange={(val) => handleChange('endMonth', val)}
        value={endMonth ?? undefined}
      >
        <SelectTrigger className={`${selectTriggerBase} flex-[2]`}>
          <SelectValue placeholder="Bulan" />
        </SelectTrigger>
        <SelectContent className={selectContentBase}>
          {months.map((m) => (
            <SelectItem
              key={m.value}
              value={m.value}
              className={selectItemBase}
            >
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        onValueChange={(val) => handleChange('endYear', val)}
        value={endYear ?? undefined}
      >
        <SelectTrigger className={`${selectTriggerBase} flex-[1]`}>
          <SelectValue placeholder="Tahun" />
        </SelectTrigger>
        <SelectContent className={selectContentBase}>
          {years.map((y) => (
            <SelectItem key={y} value={y} className={selectItemBase}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

type DivisionTableProps = {
  divisions: Division[];
  onSelect: (divisionName: string, staff: string) => void;
  onClear: (divisionName: string) => void;
  initialSelection?: Record<string, string>;
};

function DivisionTable({
  divisions,
  onSelect,
  onClear,
  initialSelection,
}: DivisionTableProps) {
  return (
    <div className="w-full max-w-[600px] max-h-[300px] sm:max-h-[420px] mx-auto overflow-y-auto p-1 space-y-3">
      <div className="flex gap-12 sticky top-0 bg-white z-10 py-2 font-semibold text-sm">
        <div className="w-[120px] sm:w-[140px]">Divisi</div>
        <div className="flex-1">Best Staff</div>
      </div>

      {divisions.map((divisi, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-[120px] sm:w-[140px] text-sm text-[#636A6D]">
            {divisi.name}
          </div>
          <div className="flex-1">
            <Select
              onValueChange={(val) => onSelect(divisi.name, val)}
              value={initialSelection?.[divisi.name] ?? undefined}
            >
              <SelectTrigger className="w-full h-[36px] rounded-xl text-sm text-[#636A6D] border border-[#C4CACE]">
                <SelectValue placeholder="Pilih anggota" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border border-[#C4CACE]">
                {divisi.candidates.map((staff, j) => (
                  <SelectItem
                    key={j}
                    value={staff}
                    className="py-2 px-3 text-sm text-[#636A6D] hover:bg-gray-100"
                  >
                    {staff}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {initialSelection?.[divisi.name] && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onClear(divisi.name)}
              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
              title="Hapus pilihan"
            >
              ✕
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

type BestStaffFormProps = {
  trigger?: React.ReactNode;
  lembagaId?: string;
  eventId?: string;
  mode: 'add' | 'edit';
  existingPeriode?: {
    start_date: string;
    end_date: string;
    best_staff_list: Array<{
      user_id: string;
      name: string;
      image: string | null;
      nim: string;
      jurusan: string;
      division: string;
    }>;
  };
};

const BestStaffForm = ({
  trigger,
  lembagaId,
  eventId,
  mode,
  existingPeriode,
}: BestStaffFormProps) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const utils = api.useUtils();

  const selectTriggerBase =
    'h-[40px] rounded-lg border border-[#636A6D] [&>span]:text-[#9DA4A8] [&>span]:text-xs';
  const selectContentBase =
    'border border-[#C4CACE] [&_[data-radix-select-viewport]]:p-0';
  const selectItemBase =
    'py-2.5 px-3 border-b last:border-0 border-[#636A6D] rounded-none text-xs text-[#636A6D] hover:bg-gray-100';

  const getInitialPeriodeValues = React.useCallback(() => {
    if (mode === 'edit' && existingPeriode) {
      const startDate = new Date(existingPeriode.start_date);
      const endDate = new Date(existingPeriode.end_date);
      return {
        startMonth: (startDate.getMonth() + 1).toString().padStart(2, '0'),
        startYear: startDate.getFullYear().toString(),
        endMonth: (endDate.getMonth() + 1).toString().padStart(2, '0'),
        endYear: endDate.getFullYear().toString(),
      };
    }
    return {
      startMonth: null as string | null,
      startYear: null as string | null,
      endMonth: null as string | null,
      endYear: null as string | null,
    };
  }, [mode, existingPeriode]);

  const [periode, setPeriode] = useState<{
    startMonth: string | null;
    startYear: string | null;
    endMonth: string | null;
    endYear: string | null;
  }>(() => getInitialPeriodeValues());

  const { data: eventData } = api.event.getByID.useQuery(
    eventId ? { id: eventId } : skipToken,
    { enabled: !!eventId },
  );

  const years = React.useMemo(() => {
    const currentYear = new Date().getFullYear();

    if (eventId && eventData) {
      const startYear = new Date(eventData.start_date).getFullYear();
      const endYear = eventData.end_date
        ? new Date(eventData.end_date).getFullYear()
        : currentYear;
      return generateYears(startYear, endYear);
    }

    return generateYears(2020, currentYear);
  }, [eventId, eventData]);

  const chooseBestStaffLembagaMutation =
    api.lembaga.chooseBestStaffLembaga.useMutation({
      onSuccess: async () => {
        toast({
          variant: 'default',
          title: 'Berhasil!',
          description: `Best Staff berhasil ${mode === 'add' ? 'ditambahkan' : 'diperbarui'}.`,
        });
        await utils.lembaga.getAllHistoryBestStaffLembaga.invalidate();
        setIsOpen(false);
      },
      onError: (err) => {
        console.error(err);
        toast({
          variant: 'destructive',
          title: 'Gagal menyimpan',
          description: 'Terjadi kesalahan saat menyimpan Best Staff.',
        });
      },
    });

  const chooseBestStaffKegiatanMutation =
    api.lembaga.chooseBestStaffKegiatan.useMutation({
      onSuccess: async () => {
        toast({
          variant: 'default',
          title: 'Berhasil!',
          description: `Best Staff berhasil ${mode === 'add' ? 'ditambahkan' : 'diperbarui'}.`,
        });
        await utils.lembaga.getAllHistoryBestStaffKegiatan.invalidate();
        setIsOpen(false);
      },
      onError: (err) => {
        console.error(err);
        toast({
          variant: 'destructive',
          title: 'Gagal menyimpan',
          description: 'Terjadi kesalahan saat menyimpan Best Staff.',
        });
      },
    });

  const getInitialStaffSelection = React.useCallback(() => {
    if (mode === 'edit' && existingPeriode) {
      const selection: Record<string, string> = {};
      existingPeriode.best_staff_list.forEach((staff) => {
        if (staff.name) {
          selection[staff.division] = staff.name;
        }
      });
      return selection;
    }
    return {};
  }, [mode, existingPeriode]);

  const [selectedStaff, setSelectedStaff] = useState<Record<string, string>>(
    () => getInitialStaffSelection(),
  );
  const [staffOptions, setStaffOptions] = useState<Record<string, string[]>>(
    {},
  );
  const [divisionDataMapping, setDivisionDataMapping] = useState<
    Record<string, { name: string; user_id: string }[]>
  >({});

  React.useEffect(() => {
    if (isOpen) {
      setPeriode(getInitialPeriodeValues());
      setSelectedStaff(getInitialStaffSelection());
    }
  }, [isOpen, getInitialPeriodeValues, getInitialStaffSelection]);

  const { data: divisionData } = eventId
    ? api.lembaga.getAllKegiatanDivision.useQuery(
        lembagaId ? { lembagaId, event_id: eventId } : skipToken,
        { enabled: !!eventId && !!lembagaId },
      )
    : api.lembaga.getAllLembagaDivision.useQuery(
        lembagaId ? { lembagaId } : skipToken,
        { enabled: !!lembagaId },
      );

  const { data: anggotaData } = eventId
    ? api.event.getAllAnggota.useQuery(
        { event_id: eventId },
        { enabled: !!eventId },
      )
    : api.lembaga.getAllAnggota.useQuery(
        lembagaId ? { lembagaId: lembagaId } : skipToken,
        { enabled: !!lembagaId },
      );

  useEffect(() => {
    if (!anggotaData) return;

    const fullMap: Record<string, { user_id: string; name: string }[]> = {};
    for (const a of anggotaData) {
      const div = a.divisi ?? 'Umum';
      if (!fullMap[div]) fullMap[div] = [];
      fullMap[div].push({ user_id: a.id, name: a.nama });
    }

    const optionsMap: Record<string, string[]> = {};
    for (const k of Object.keys(fullMap)) {
      const list = fullMap[k] ?? [];
      optionsMap[k] = list.map((u) => u.name);
    }

    setStaffOptions((prev) => ({ ...prev, ...optionsMap }));
    setDivisionDataMapping((prev) => ({ ...prev, ...fullMap }));
  }, [anggotaData]);

  const handleSubmit = () => {
    const { startMonth, startYear, endMonth, endYear } = periode;

    if ((startMonth && !startYear) || (!startMonth && startYear)) {
      toast({
        variant: 'destructive',
        title: 'Periode tidak lengkap',
        description: 'Bulan dan Tahun Awal harus dipilih berpasangan.',
      });
      return;
    }

    if ((endMonth && !endYear) || (!endMonth && endYear)) {
      toast({
        variant: 'destructive',
        title: 'Periode tidak lengkap',
        description: 'Bulan dan Tahun Akhir harus dipilih berpasangan.',
      });
      return;
    }

    if (!startMonth || !startYear || !endMonth || !endYear) {
      toast({
        variant: 'destructive',
        title: 'Data belum lengkap',
        description:
          'Bulan & Tahun Awal serta Bulan & Tahun Akhir wajib diisi.',
      });
      return;
    }

    const sYear = parseInt(startYear, 10);
    const eYear = parseInt(endYear, 10);
    const sMonth = parseInt(startMonth, 10);
    const eMonth = parseInt(endMonth, 10);

    if (isNaN(sYear) || isNaN(eYear) || isNaN(sMonth) || isNaN(eMonth)) {
      toast({
        variant: 'destructive',
        title: 'Format tidak valid',
        description: 'Bulan & Tahun harus berupa angka valid.',
      });
      return;
    }

    const startTotal = sYear * 12 + (sMonth - 1);
    const endTotal = eYear * 12 + (eMonth - 1);

    if (endTotal < startTotal) {
      toast({
        variant: 'destructive',
        title: 'Periode tidak valid',
        description: 'Periode akhir harus sama atau setelah periode awal.',
      });
      return;
    }

    const start_date = new Date(sYear, sMonth - 1, 1).toISOString();
    const end_date = new Date(eYear, eMonth - 1, 1).toISOString();

    const best_staff_list = Object.entries(selectedStaff)
      .filter(([_, userName]) => userName?.trim())
      .map(([division, userName]) => {
        const usersInDivision = divisionDataMapping[division] ?? [];
        const userObj = usersInDivision.find((s) => s.name === userName);
        return {
          user_id: userObj?.user_id ?? '',
          division,
        };
      });

    if (eventId) {
      const payload = {
        lembagaId: lembagaId ?? '',
        event_id: eventId,
        start_date,
        end_date,
        best_staff_list,
      };
      chooseBestStaffKegiatanMutation.mutate(payload);
    } else if (lembagaId) {
      const payload = {
        lembagaId,
        start_date,
        end_date,
        best_staff_list,
      };
      chooseBestStaffLembagaMutation.mutate(payload);
    } else {
      toast({
        variant: 'destructive',
        title: 'Kesalahan sistem',
        description: 'ID lembaga atau kegiatan tidak ditemukan.',
      });
      return;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen} key={isOpen ? 'open' : 'closed'}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="w-[191px] h-[50px] bg-[#00B7B7] rounded-2xl hover:bg-[#00A5A5] text-white text-[18px] font-semibold">
            {mode === 'add' ? 'Tambah' : 'Edit'} Best Staff
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-[724px] rounded-[20px] p-6 sm:p-10 [&>button[aria-label='Close']]:hidden max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl sm:text-[32px] font-bold">
            {mode === 'add' ? 'Tambah' : 'Edit'} Best Staff
          </DialogTitle>
          <DialogDescription className="text-sm font-medium text-[#636A6D]">
            Periode Penilaian
          </DialogDescription>
        </DialogHeader>

        <PeriodSelect
          months={months}
          years={years}
          selectTriggerBase={selectTriggerBase}
          selectContentBase={selectContentBase}
          selectItemBase={selectItemBase}
          onChange={setPeriode}
          initialValues={periode}
        />

        <DivisionTable
          divisions={
            divisionData?.divisions.map((div) => ({
              name: div,
              candidates: staffOptions[div] ?? [],
            })) ?? []
          }
          onSelect={(division, staff) =>
            setSelectedStaff((prev) => ({ ...prev, [division]: staff }))
          }
          onClear={(division) =>
            setSelectedStaff((prev) => {
              const newState = { ...prev };
              delete newState[division];
              return newState;
            })
          }
          initialSelection={selectedStaff}
        />

        <div className="flex justify-center gap-4 mt-6">
          <DialogClose asChild>
            <Button
              variant="outline"
              className="border-[#636A6D] text-[#636A6D] w-[100px] sm:w-[120px] h-[40px] rounded-xl"
            >
              Batal
            </Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            className="bg-[#00B7B7] text-white font-semibold w-[100px] sm:w-[120px] h-[40px] rounded-xl hover:bg-[#00A5A5]"
          >
            Simpan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BestStaffForm;
