'use client';

import { Download } from 'lucide-react';
import { type Session } from 'next-auth';
import React, { useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';
import { Table, TableBody } from '~/components/ui/table';
import { useToast } from '~/hooks/use-toast';
import { api } from '~/trpc/react';

import Pagination from '../layout/pagination-comp';
import { SearchBar } from '../placeholder/search-bar';
import DeleteProfilDialog from './delete-profil-dialog';
import EditNilaiButton from './edit-nilai-button';
import FormProfilKegiatan from './form-profil-kegiatan';
import { ImportDialog } from './import-dialog';
import LinkButton from './link-button';
import RaporTableHeader from './rapor-table-header';
import RaporTableRow from './rapor-table-row';
import TambahProfilButton from './tambah-profil-button';

type Anggota = { nama: string; nim: string; profil: string[] };
type ProfilData = {
  id: string;
  label: string;
  deskripsi: string;
  pemetaan: string[];
};

type ApiMahasiswaData = {
  user_id: string;
  name: string;
  nim: string;
  nilai: { profil_id: string; nilai: number }[];
};

interface ProfilItem {
  id: string;
  name: string;
  description: string;
  profil_km_id: string[];
}

interface TableProps {
  session: Session | null;
  event_id?: string;
  lembaga_id?: string;
  /** Tautan ke halaman profil; bawaan rute Owner. */
  profilHref?: string;
  selectOptions: { value: string; label: string }[];
  type: 'event' | 'lembaga';
}

export default function RaporTable({
  session,
  event_id,
  lembaga_id,
  profilHref,
  selectOptions,
  type,
}: TableProps) {
  const { toast } = useToast();

  // API Queries
  const eventQuery = api.rapor.getAllNilaiProfilKegiatan.useQuery(
    { lembagaId: lembaga_id!, event_id: event_id! },
    { enabled: type === 'event' && !!event_id && !!lembaga_id },
  );

  const lembagaQuery = api.rapor.getAllNilaiProfilLembaga.useQuery(
    { lembagaId: lembaga_id! },
    { enabled: type === 'lembaga' && !!lembaga_id },
  );

  const lembagaProfilsQuery = api.profil.getAllProfilLembaga.useQuery(
    { lembaga_id: lembaga_id! },
    { enabled: type === 'lembaga' && !!lembaga_id },
  );

  const kegiatanProfilsQuery = api.profil.getAllProfilKegiatan.useQuery(
    { event_id: event_id! },
    { enabled: type === 'event' && !!event_id },
  );

  const profilsQuery =
    type === 'lembaga' ? lembagaProfilsQuery : kegiatanProfilsQuery;

  // Mutations
  const eventUpsertMutation =
    api.rapor.upsertNilaiMahasiswaKegiatan.useMutation();
  const lembagaUpsertMutation =
    api.rapor.upsertNilaiMahasiswaLembaga.useMutation();
  const createLembagaProfilMutation =
    api.profil.createProfilLembaga.useMutation();
  const createKegiatanProfilMutation =
    api.profil.createProfilKegiatan.useMutation();
  const editLembagaProfilMutation = api.profil.editProfilLembaga.useMutation();
  const editKegiatanProfilMutation =
    api.profil.editProfilKegiatan.useMutation();
  const deleteLembagaProfilMutation =
    api.profil.deleteProfilLembaga.useMutation();
  const deleteKegiatanProfilMutation =
    api.profil.deleteProfilKegiatan.useMutation();
  // Use appropriate query/mutation based on type
  const raporData = type === 'event' ? eventQuery.data : lembagaQuery.data;
  const isLoading =
    type === 'event' ? eventQuery.isLoading : lembagaQuery.isLoading;
  const refetch = type === 'event' ? eventQuery.refetch : lembagaQuery.refetch;
  const upsertMutation =
    type === 'event' ? eventUpsertMutation : lembagaUpsertMutation;

  // State
  const [data, setData] = useState<Anggota[]>([]);
  const [profilHeaders, setProfilHeaders] = useState<ProfilData[]>([]);
  const [apiMahasiswaData, setApiMahasiswaData] = useState<ApiMahasiswaData[]>(
    [],
  );
  const [profilIdMap, setProfilIdMap] = useState<string[]>([]);
  const [menu, setMenu] = useState<{ row: number; col: number } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'tambah' | 'edit'>('tambah');
  const [editColIdx, setEditColIdx] = useState<number | null>(null);
  const [profil, setProfil] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [pemetaan, setPemetaan] = useState<string[]>([]);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteColIdx, setDeleteColIdx] = useState<number | null>(null);
  const [editNilaiMode, setEditNilaiMode] = useState(false);
  const [editedData, setEditedData] = useState<Anggota[] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  const pageSize = 6;

  // Initialize data when queries complete
  useEffect(() => {
    if (raporData?.mahasiswa && raporData.mahasiswa.length > 0) {
      setApiMahasiswaData(raporData.mahasiswa);

      if (profilsQuery?.data) {
        let profils: ProfilItem[] = [];

        if (type === 'lembaga' && 'profil_lembaga' in profilsQuery.data) {
          profils = profilsQuery.data.profil_lembaga as ProfilItem[];
        } else if (type === 'event' && 'profil_kegiatan' in profilsQuery.data) {
          profils = profilsQuery.data.profil_kegiatan as ProfilItem[];
        }

        if (profils.length > 0) {
          const finalProfilIds = profils.map((p) => p.id);
          const profilData = profils.map((profil) => ({
            id: profil.id,
            label: profil.name,
            deskripsi: profil.description ?? '',
            pemetaan: profil.profil_km_id ?? [],
          }));

          setProfilIdMap(finalProfilIds);
          setProfilHeaders(profilData);

          const anggotaData = raporData.mahasiswa.map((mahasiswa) => ({
            nama: mahasiswa.name,
            nim: mahasiswa.nim,
            profil: finalProfilIds.map((profilId) => {
              const nilai = mahasiswa.nilai.find(
                (n) => n.profil_id === profilId,
              );
              return nilai ? nilai.nilai.toString() : '0';
            }),
          }));

          setData(anggotaData);
        }
      }
    } else if (profilsQuery?.data) {
      // Handle case with no students but existing profils
      let profils: ProfilItem[] = [];

      if (type === 'lembaga' && 'profil_lembaga' in profilsQuery.data) {
        profils = profilsQuery.data.profil_lembaga as ProfilItem[];
      } else if (type === 'event' && 'profil_kegiatan' in profilsQuery.data) {
        profils = profilsQuery.data.profil_kegiatan as ProfilItem[];
      }

      if (profils.length > 0) {
        const finalProfilIds = profils.map((p) => p.id);
        const profilData = profils.map((profil) => ({
          id: profil.id,
          label: profil.name,
          deskripsi: profil.description ?? '',
          pemetaan: profil.profil_km_id ?? [],
        }));

        setProfilIdMap(finalProfilIds);
        setProfilHeaders(profilData);
        setData([
          {
            nama: 'No students found',
            nim: '',
            profil: finalProfilIds.map(() => '0'),
          },
        ]);
        setApiMahasiswaData([]);
      }
    }
  }, [raporData, profilsQuery?.data, type]);

  // Loading states
  if ((type === 'event' && !event_id) || (type === 'lembaga' && !lembaga_id)) {
    return (
      <div className="p-4 text-red-600">
        Error: {type === 'event' ? 'event_id' : 'lembaga_id'} is required
      </div>
    );
  }

  // Error states
  const queryError = type === 'event' ? eventQuery.error : lembagaQuery.error;
  const profilError = profilsQuery.error;

  if (queryError) {
    return (
      <div className="p-4 text-red-600">
        Error loading rapor data: {queryError.message}
      </div>
    );
  }

  if (profilError) {
    return (
      <div className="p-4 text-red-600">
        Error loading profil data: {profilError.message}
      </div>
    );
  }

  if (isLoading || profilsQuery.isLoading) {
    return <div className="p-4">Loading rapor data...</div>;
  }

  // Filter data based on search query and track original indices
  const sourceData = editNilaiMode ? (editedData ?? data) : data;
  const filteredDataWithIndices = sourceData
    .map((row, originalIdx) => ({ row, originalIdx }))
    .filter(({ row }) => {
      const searchLower = searchQuery.toLowerCase();
      return (
        row.nama.toLowerCase().includes(searchLower) ||
        row.nim.toLowerCase().includes(searchLower)
      );
    });

  const totalPages = Math.ceil(filteredDataWithIndices.length / pageSize);
  const paginatedData = filteredDataWithIndices.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  // HANDLERS
  const handleTambahProfil = () => {
    setModalType('tambah');
    setProfil('');
    setDeskripsi('');
    setPemetaan([]);
    setModalOpen(true);
  };

  const handleEditProfil = (colIdx: number) => {
    const profilHeader = profilHeaders[colIdx];
    if (!profilHeader) return;

    setModalType('edit');
    setProfil(profilHeader.label);
    setDeskripsi(profilHeader.deskripsi);

    // Find matching pemetaan option
    const currentProfil =
      profilsQuery?.data && 'profil_lembaga' in profilsQuery.data
        ? profilsQuery.data.profil_lembaga[colIdx]
        : profilsQuery?.data && 'profil_kegiatan' in profilsQuery.data
          ? profilsQuery.data.profil_kegiatan[colIdx]
          : null;

    if (currentProfil?.profil_km_id && currentProfil.profil_km_id.length > 0) {
      setPemetaan(currentProfil.profil_km_id ?? []);
    } else {
      setPemetaan([]);
    }

    setModalOpen(true);
    setMenu(null);
    setEditColIdx(colIdx);
  };

  const handleDeleteProfil = (colIdx: number) => {
    setDeleteColIdx(colIdx);
    setConfirmDeleteOpen(true);
    setMenu(null);
  };

  const handleConfirmDelete = () => {
    if (deleteColIdx === null) return;

    const profilIdToDelete = profilIdMap[deleteColIdx];
    if (!profilIdToDelete) return;

    const mutation =
      type === 'lembaga'
        ? deleteLembagaProfilMutation
        : deleteKegiatanProfilMutation;

    mutation.mutate(
      { profil_id: profilIdToDelete, lembagaId: lembaga_id! },
      {
        onSuccess: () => {
          setProfilHeaders((prev) => prev.filter((_, i) => i !== deleteColIdx));
          setData((prev) =>
            prev.map((row) => ({
              ...row,
              profil: row.profil.filter((_, i) => i !== deleteColIdx),
            })),
          );
          setProfilIdMap((prev) => prev.filter((_, i) => i !== deleteColIdx));
          setDeleteColIdx(null);
          setConfirmDeleteOpen(false);

          void profilsQuery.refetch();

          toast({
            title: 'Profil berhasil dihapus',
          });
        },
        onError: (error) => {
          toast({
            title: 'Gagal menghapus profil',
            description: error.message,
            variant: 'destructive',
          });
        },
      },
    );
  };

  const handleCancelDelete = () => {
    setDeleteColIdx(null);
    setConfirmDeleteOpen(false);
  };

  const handleSimpanTambah = () => {
    if (!profil.trim()) {
      toast({
        title: 'Gagal menyimpan',
        description: 'Nama profil tidak boleh kosong',
        variant: 'destructive',
      });
      return;
    }

    if (type === 'lembaga') {
      createLembagaProfilMutation.mutate(
        {
          lembagaId: lembaga_id!,
          name: profil,
          description: deskripsi,
          profil_km_id: pemetaan,
        },
        {
          onSuccess: () => {
            setModalOpen(false);
            setProfil('');
            setDeskripsi('');
            setPemetaan([]);

            void profilsQuery.refetch();

            toast({
              title: 'Profil berhasil ditambahkan',
              description: `Profil "${profil}" telah ditambahkan ke database`,
            });
          },
          onError: (error) => {
            toast({
              title: 'Gagal membuat profil',
              description: error.message,
              variant: 'destructive',
            });
          },
        },
      );
    } else {
      createKegiatanProfilMutation.mutate(
        {
          lembagaId: lembaga_id!,
          event_id: event_id!,
          name: profil,
          description: deskripsi,
          profil_km_id: pemetaan,
        },
        {
          onSuccess: () => {
            setModalOpen(false);
            setProfil('');
            setDeskripsi('');
            setPemetaan([]);

            void profilsQuery.refetch();

            toast({
              title: 'Profil berhasil ditambahkan',
              description: `Profil "${profil}" telah ditambahkan ke database`,
            });
          },
          onError: (error) => {
            toast({
              title: 'Gagal membuat profil',
              description: error.message,
              variant: 'destructive',
            });
          },
        },
      );
    }
  };

  const handleSimpanEdit = () => {
    if (!profil.trim()) {
      toast({
        title: 'Gagal menyimpan',
        description: 'Nama profil tidak boleh kosong',
        variant: 'destructive',
      });
      return;
    }

    if (editColIdx === null) return;

    const profilIdToUpdate = profilIdMap[editColIdx];
    if (!profilIdToUpdate) {
      toast({
        title: 'Error',
        description: 'Profil ID tidak ditemukan',
        variant: 'destructive',
      });
      return;
    }

    const mutation =
      type === 'lembaga'
        ? editLembagaProfilMutation
        : editKegiatanProfilMutation;
    const payload = {
      profil_id: profilIdToUpdate,
      lembagaId: lembaga_id!,
      name: profil,
      description: deskripsi,
      profil_km_id: pemetaan,
    };

    mutation.mutate(payload, {
      onSuccess: () => {
        setProfilHeaders((prev) =>
          prev.map((header, idx) =>
            idx === editColIdx
              ? {
                  id: profilIdToUpdate,
                  label: profil,
                  deskripsi: deskripsi,
                  pemetaan: pemetaan,
                }
              : header,
          ),
        );

        setModalOpen(false);

        void Promise.all([profilsQuery.refetch(), refetch()]);

        toast({
          title: 'Profil berhasil diperbarui',
          description: `Profil "${profil}" telah diperbarui di database`,
        });
      },
      onError: (error) => {
        toast({
          title: 'Gagal memperbarui profil',
          description: error.message,
          variant: 'destructive',
        });
      },
    });
  };

  const handleSaveNilai = () => {
    if (!editedData || apiMahasiswaData.length === 0) {
      toast({
        title: 'Error: No data',
        description: 'No data to save. Please refresh the page.',
        variant: 'destructive',
      });
      return;
    }

    if (editedData.length !== apiMahasiswaData.length) {
      toast({
        title: 'Error: Data mismatch',
        description: 'Student data is out of sync. Please refresh the page.',
        variant: 'destructive',
      });
      return;
    }

    const changedMahasiswa: {
      user_id: string;
      nilai: { profil_id: string; nilai: number }[];
    }[] = [];

    editedData.forEach((editedRow, rowIndex) => {
      const originalRow = data[rowIndex];
      const mahasiswaApiData = apiMahasiswaData[rowIndex];

      if (
        !originalRow ||
        !mahasiswaApiData ||
        editedRow.nama !== mahasiswaApiData.name
      ) {
        return;
      }

      const changedNilai: { profil_id: string; nilai: number }[] = [];

      editedRow.profil.forEach((newValue, colIndex) => {
        const originalValue = (originalRow.profil[colIndex] ?? '0').toString();
        const newValueStr = newValue.toString();

        if (newValueStr !== originalValue) {
          const profilId = profilIdMap[colIndex];
          if (profilId) {
            changedNilai.push({
              profil_id: profilId,
              nilai: parseInt(newValueStr) || 0,
            });
          }
        }
      });

      if (changedNilai.length > 0) {
        changedMahasiswa.push({
          user_id: mahasiswaApiData.user_id,
          nilai: changedNilai,
        });
      }
    });

    if (changedMahasiswa.length === 0) {
      toast({
        title: 'No changes to save',
        description: 'Make some changes to the scores before saving',
        variant: 'default',
      });
      setEditNilaiMode(false);
      setEditedData(null);
      return;
    }

    if (type === 'event') {
      eventUpsertMutation.mutate(
        {
          lembagaId: lembaga_id!,
          event_id: event_id!,
          mahasiswa: changedMahasiswa,
        },
        {
          onSuccess: () => {
            toast({
              title: 'Nilai berhasil disimpan',
              description: `${changedMahasiswa.length} mahasiswa updated`,
            });
            setEditNilaiMode(false);
            setEditedData(null);
            setData(editedData);
            void refetch();
          },
          onError: (error) => {
            toast({
              title: 'Gagal menyimpan nilai',
              description: error.message,
              variant: 'destructive',
            });
          },
        },
      );
    } else {
      lembagaUpsertMutation.mutate(
        { lembagaId: lembaga_id!, mahasiswa: changedMahasiswa },
        {
          onSuccess: () => {
            toast({
              title: 'Nilai berhasil disimpan',
              description: `${changedMahasiswa.length} mahasiswa updated`,
            });
            setEditNilaiMode(false);
            setEditedData(null);
            setData(editedData);
            void refetch();
          },
          onError: (error) => {
            toast({
              title: 'Gagal menyimpan nilai',
              description: error.message,
              variant: 'destructive',
            });
          },
        },
      );
    }
  };

  const handleExportRapor = async () => {
    try {
      const exportHref =
        type === 'event'
          ? `/api/lembaga/kegiatan/${event_id}/nilai`
          : `/api/lembaga/${lembaga_id}/nilai`;
      const response = await fetch(exportHref);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rapor-${type === 'event' ? 'kegiatan' : 'lembaga'}-${type === 'event' ? event_id : lembaga_id}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast({
          title: 'Rapor berhasil diekspor',
        });
      } else {
        const result = (await response.json()) as {
          message?: string;
          data?: any;
          error?: string;
          details?: string;
        };
        toast({
          title: 'Gagal mengekspor rapor',
          description: result.error,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Gagal mengekspor rapor',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  const linkHref =
    type === 'event'
      ? (profilHref ?? `/kegiatan/${event_id}/profil`)
      : (profilHref ?? '/profil');

  return (
    <>
      <div className="mb-4" />
      <SearchBar
        placeholder="Cari nama panitia"
        value={searchQuery}
        onChange={(value: string) => {
          setSearchQuery(value);
          setCurrentPage(1); // Reset to first page when searching
        }}
      />
      <div className="mb-6" />
      <div className="flex flex-col flex-1">
        <div className="flex-1">
          {/* Action buttons - responsive layout */}
          <div className="flex flex-col sm:flex-row sm:justify-between gap-4 mb-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-x-5">
              <TambahProfilButton onClick={handleTambahProfil}>
                Tambah Profil {type === 'event' ? 'Kegiatan' : 'Lembaga'}
              </TambahProfilButton>
              <LinkButton href={linkHref}>
                Profil {type === 'event' ? 'Kegiatan' : 'Lembaga'}
              </LinkButton>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-x-5">
              <ImportDialog
                session={session}
                lembagaId={lembaga_id}
                isLembaga={type === 'lembaga'}
              />
              <Button onClick={handleExportRapor} variant={'dark_blue'}>
                <Download size={24} />
                Unduh
              </Button>
              <EditNilaiButton
                editNilaiMode={editNilaiMode}
                setEditNilaiMode={setEditNilaiMode}
                editedData={editedData}
                setData={setData}
                setEditedData={setEditedData}
                data={data}
                onSave={handleSaveNilai}
                isSaving={upsertMutation.isPending}
              />
            </div>
          </div>

          {/* Desktop Table View - hidden on mobile */}
          <div className="hidden md:block w-full overflow-x-auto">
            <Table className="min-w-max">
              <RaporTableHeader
                profilHeaders={profilHeaders}
                menu={menu}
                setMenu={setMenu}
                handleEditProfil={handleEditProfil}
                handleDeleteProfil={handleDeleteProfil}
              />
              <TableBody>
                {profilHeaders.length === 0 ? (
                  <tr>
                    <td colSpan={100} className="text-center py-12">
                      <div className="text-neutral-500">
                        <p className="text-lg mb-2">
                          Belum ada profil{' '}
                          {type === 'lembaga' ? 'lembaga' : 'kegiatan'}
                        </p>
                        <p className="text-sm">
                          Klik tombol &quot;Tambah Profil{' '}
                          {type === 'lembaga' ? 'Lembaga' : 'Kegiatan'}&quot;
                          untuk memulai
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedData.map(({ row, originalIdx }) => {
                    return (
                      <RaporTableRow
                        key={`${originalIdx}-${row.nama}`}
                        row={row}
                        editNilaiMode={editNilaiMode}
                        editedData={editedData}
                        setEditedData={setEditedData}
                        absoluteRowIdx={originalIdx}
                      />
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View - shown only on mobile */}
          <div className="md:hidden space-y-4">
            {profilHeaders.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg border">
                <div className="text-neutral-500">
                  <p className="text-lg mb-2">
                    Belum ada profil{' '}
                    {type === 'lembaga' ? 'lembaga' : 'kegiatan'}
                  </p>
                  <p className="text-sm">
                    Klik tombol &quot;Tambah Profil{' '}
                    {type === 'lembaga' ? 'Lembaga' : 'Kegiatan'}&quot; untuk
                    memulai
                  </p>
                </div>
              </div>
            ) : (
              paginatedData.map(({ row, originalIdx }) => {
                const displayData = editNilaiMode
                  ? (editedData?.[originalIdx] ?? row)
                  : row;

                return (
                  <div
                    key={`card-${originalIdx}-${row.nama}`}
                    className="bg-white rounded-lg border p-4 shadow-sm"
                  >
                    {/* Header - Name and NIM */}
                    <div className="mb-4 pb-3 border-b">
                      <h3 className="font-semibold text-lg text-neutral-700">
                        {displayData.nama}
                      </h3>
                      <p className="text-sm text-neutral-500">
                        {displayData.nim}
                      </p>
                    </div>

                    {/* Profils Grid */}
                    <div className="space-y-3">
                      {profilHeaders.map((header, colIdx) => {
                        const value = displayData.profil[colIdx] ?? '0';
                        return (
                          <div
                            key={`${originalIdx}-${colIdx}`}
                            className="flex justify-between items-center py-2"
                          >
                            <div className="flex-1 mr-3">
                              <span className="text-sm font-medium text-neutral-700 block">
                                {header.label}
                              </span>
                            </div>
                            <div className="flex-shrink-0">
                              {editNilaiMode ? (
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  className="w-20 px-2 py-1 border rounded text-center"
                                  value={value}
                                  onChange={(e) => {
                                    const newValue = e.target.value;
                                    setEditedData((prev) => {
                                      if (!prev) return prev;
                                      const updated = [...prev];
                                      if (updated[originalIdx]) {
                                        updated[originalIdx] = {
                                          ...updated[originalIdx],
                                          profil: [
                                            ...updated[originalIdx].profil,
                                          ],
                                        };
                                        updated[originalIdx].profil[colIdx] =
                                          newValue;
                                      }
                                      return updated;
                                    });
                                  }}
                                />
                              ) : (
                                <span className="text-base font-semibold text-neutral-700 bg-neutral-100 px-3 py-1 rounded">
                                  {value}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* <ProfilDialog
          open={modalOpen}
          setOpen={setModalOpen}
          modalType={modalType}
          profil={profil}
          setProfil={setProfil}
          deskripsi={deskripsi}
          setDeskripsi={setDeskripsi}
          pemetaan={pemetaan}
          setPemetaan={setPemetaan}
          handleSimpanTambah={handleSimpanTambah}
          handleSimpanEdit={handleSimpanEdit}
          handleBatal={() => setModalOpen(false)}
          selectOptions={selectOptions}
        /> */}
          <FormProfilKegiatan
            open={modalOpen}
            setOpen={setModalOpen}
            modalType={modalType}
            profil={profil}
            setProfil={setProfil}
            deskripsi={deskripsi}
            setDeskripsi={setDeskripsi}
            pemetaan={pemetaan}
            setPemetaan={setPemetaan}
            handleSimpanTambah={handleSimpanTambah}
            handleSimpanEdit={handleSimpanEdit}
            handleBatal={() => setModalOpen(false)}
            selectOptions={selectOptions}
          />

          <DeleteProfilDialog
            open={confirmDeleteOpen}
            onCancel={handleCancelDelete}
            onConfirm={handleConfirmDelete}
          />
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          setCurrentPage={setCurrentPage}
        />
      </div>
    </>
  );
}
