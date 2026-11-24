'use client';

import Image from 'next/image';
import TrashCan from 'public/icons/trash.svg';
import React, { useState } from 'react';
import { Button } from '~/components/ui/button';

// import { Dialog, DialogContent, DialogTrigger } from '~/components/ui/dialog';

type UploadState =
  | { status: 'initial' }
  | { status: 'uploading'; file: File; progress: number }
  | { status: 'complete'; file: File }
  | { status: 'success'; message: string; data?: any }
  | { status: 'error'; error: string };

interface CsvFormContentProps {
  importType:
    'kegiatan-anggota' | 'kegiatan-nilai' | 'lembaga-anggota' | 'lembaga-nilai';
  entityId: string;
  onImportSuccess?: (data: any) => void;
  triggerElement?: React.ReactNode;
}

const CsvFormContent = ({
  importType,
  entityId,
  onImportSuccess,
}: CsvFormContentProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'initial',
  });
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isUploadConfirmOpen, setIsUploadConfirmOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const handleFileUpload = async (file: File) => {
    setUploadState({ status: 'uploading', file: file, progress: 0 });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(getUploadEndpoint(), {
        method: 'POST',
        body: formData,
      });

      const result = (await response.json()) as {
        message?: string;
        data?: any;
        error?: string;
        details?: string;
      };

      if (response.ok) {
        setUploadState({
          status: 'success',
          message: result.message ?? 'File imported successfully',
          data: result.data,
        });
        onImportSuccess?.(result.data);
      } else {
        const errorMsg = result.error ?? result.details ?? 'Upload failed';
        setUploadState({
          status: 'error',
          error: errorMsg,
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Upload failed';
      setUploadState({
        status: 'error',
        error: errorMessage,
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type before showing confirmation
      if (!/\.(xlsx|xls)$/.exec(file.name)) {
        setUploadState({
          status: 'error',
          error: `Invalid file format. Please upload Excel file (.xlsx or .xls)`,
        });
        return;
      }
      setPendingFile(file);
      setIsUploadConfirmOpen(true);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsHovered(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      // Validate file type before showing confirmation
      if (!/\.(xlsx|xls)$/.exec(file.name)) {
        setUploadState({
          status: 'error',
          error: `Invalid file format. Please upload Excel file (.xlsx or .xls)`,
        });
        return;
      }
      setPendingFile(file);
      setIsUploadConfirmOpen(true);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsHovered(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsHovered(false);
  };

  const getImportTypeInfo = () => {
    switch (importType) {
      case 'kegiatan-anggota':
        return {
          title: 'Upload Daftar Anggota Kegiatan',
          worksheetName: 'Anggota Kegiatan',
        };
      case 'kegiatan-nilai':
        return {
          title: 'Upload Nilai Profil Kegiatan',
          worksheetName: 'Nilai Profil Kegiatan',
        };
      case 'lembaga-anggota':
        return {
          title: 'Upload Daftar Anggota Lembaga',
          worksheetName: 'Anggota Lembaga',
        };
      case 'lembaga-nilai':
        return {
          title: 'Upload Nilai Profil Lembaga',
          worksheetName: 'Nilai Profil Lembaga',
        };
    }
  };

  const getUploadEndpoint = () => {
    switch (importType) {
      case 'kegiatan-anggota':
        return `/api/lembaga/kegiatan/${entityId}/anggota`;
      case 'kegiatan-nilai':
        return `/api/lembaga/kegiatan/${entityId}/nilai`;
      case 'lembaga-anggota':
        return `/api/lembaga/${entityId}/anggota`;
      case 'lembaga-nilai':
        return `/api/lembaga/${entityId}/nilai`;
    }
  };

  const typeInfo = getImportTypeInfo();

  const handleDeleteClick = () => {
    setIsConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    setIsConfirmOpen(false);
    setUploadState({ status: 'initial' });
  };

  const handleCancelDelete = () => {
    setIsConfirmOpen(false);
  };

  const handleConfirmUpload = async () => {
    setIsUploadConfirmOpen(false);
    if (pendingFile) {
      await handleFileUpload(pendingFile);
      setPendingFile(null);
    }
  };

  const handleCancelUpload = () => {
    setIsUploadConfirmOpen(false);
    setPendingFile(null);
  };

  const renderContent = () => {
    switch (uploadState.status) {
      case 'initial':
        return (
          <div className="flex h-full flex-col">
            <h3 className="m-0 pb-[15px] text-[20px] font-semibold text-[#141718]">
              {typeInfo.title}
            </h3>

            <div className="mb-5 h-px w-full bg-black" />

            <div
              className={`group flex h-full max-h-[400px] flex-col items-center justify-center rounded-[10px] border-2 border-dashed bg-white p-[150px_20px] text-center font-normal ${isHovered ? 'border-[#00B7B7]' : 'border-[#C4CACE]'}`}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
            >
              <Image
                src={
                  isHovered
                    ? '/images/miscellaneous/add-csv-hover.svg'
                    : '/images/miscellaneous/add-csv.svg'
                }
                alt="Upload Icon"
                width={60}
                height={60}
                className="pointer-events-none pb-5"
              />

              <p className="pointer-events-none text-xl font-semibold text-[#636A6D] group-hover:text-[#00A5A5]">
                Select an Excel file to upload{' '}
              </p>
              <p className="text-md pointer-events-none pb-5 font-bold text-[#C7CCCF]">
                or drag and drop it here{' '}
              </p>

              <div className="upload-container pointer-events-none">
                <input
                  id="fileInput"
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <Button
                  onClick={() => {
                    const fileInput = document.getElementById('fileInput');
                    if (fileInput) {
                      fileInput.click();
                    }
                  }}
                  variant="light_blue"
                  className="pointer-events-auto pb-[7px] pt-[7px] text-[12px] font-semibold"
                >
                  + Unggah dokumen
                </Button>
              </div>
            </div>
          </div>
        );

      case 'uploading':
        return (
          <div className="flex h-full flex-col">
            <h3 className="m-0 pb-[15px] text-[20px] font-semibold text-[#141718]">
              {typeInfo.title}
            </h3>

            <div className="mb-5 h-px w-full bg-black" />

            <div className="group flex h-[400px] flex-col items-center justify-center rounded-[10px] border-2 border-dashed border-[#C4CACE] bg-white p-[150px_20px]">
              <div className="relative mb-5 h-[100px] w-[100px]">
                {/* progress circle */}
                <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#e5e5e5"
                    strokeWidth="2.5"
                  />

                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#00A5A5"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray={`${uploadState.progress}, 100`}
                  />
                </svg>

                {/* percentage text */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[20px] font-bold text-[#141718]">
                  {uploadState.progress}%
                </div>
              </div>

              <p className="text-[20px] font-semibold text-[#141718]">
                Uploading file...
              </p>

              <Button
                onClick={() => setUploadState({ status: 'initial' })}
                variant="warning_outline"
                className="mt-2.5 text-[14px] font-semibold"
              >
                Cancel
              </Button>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="flex h-full flex-col">
            <h3 className="m-0 pb-[15px] text-[20px] font-semibold text-[#141718]">
              {typeInfo.title}
            </h3>

            <div className="mb-5 h-px w-full bg-black" />

            <div className="group flex h-[400px] w-full flex-col justify-start">
              <div className="flex items-center gap-4 rounded-[8px] border border-[#C4CACE] p-[20px_16px]">
                <Image
                  src="/images/miscellaneous/excel.svg"
                  alt="File icon"
                  width={40}
                  height={40}
                />

                {/* container list file */}
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center justify-between pb-1">
                    <p className="m-0 text-[16px] font-medium text-[#141718]">
                      {uploadState.file.name}
                    </p>

                    <Image
                      src={TrashCan}
                      alt="Delete"
                      width={20}
                      height={20}
                      className="cursor-pointer"
                      onClick={handleDeleteClick}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="m-0 text-[10px] text-[#666] opacity-70">
                      200 KB
                    </p>

                    <p className="m-0 text-[10px] font-normal text-[#141718]">
                      Completed
                    </p>
                  </div>

                  <div className="h-2 w-full rounded bg-[#00A5A5]"> </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="flex h-full flex-col">
            <h3 className="m-0 pb-[15px] text-[20px] font-semibold text-[#141718]">
              {typeInfo.title}
            </h3>

            <div className="mb-5 h-px w-full bg-black" />

            <div className="group flex h-[400px] flex-col items-center justify-center rounded-[10px] border-2 border-[#00A5A5] bg-white p-[50px_20px]">
              <div className="mb-5 flex h-[80px] w-[80px] items-center justify-center rounded-full bg-[#00A5A5]">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                  <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
                </svg>
              </div>

              <p className="text-center text-[20px] font-semibold text-[#00A5A5]">
                {uploadState.message}
              </p>

              <Button
                onClick={() => setUploadState({ status: 'initial' })}
                variant="light_blue"
                className="mt-5 text-[14px] font-semibold"
              >
                Upload Another File
              </Button>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="flex h-full flex-col">
            <h3 className="m-0 pb-[15px] text-[20px] font-semibold text-[#141718]">
              {typeInfo.title}
            </h3>

            <div className="mb-5 h-px w-full bg-black" />

            <div className="group flex h-[400px] flex-col items-center justify-center rounded-[10px] border-2 border-[#FF4444] bg-white p-[50px_20px]">
              <div className="mb-5 flex h-[80px] w-[80px] items-center justify-center rounded-full bg-[#FF4444]">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </div>

              <p className="mb-2 text-center text-[20px] font-semibold text-[#FF4444]">
                Upload Failed
              </p>

              <p className="mb-5 text-center text-[14px] text-[#666]">
                {uploadState.error}
              </p>

              <Button
                onClick={() => setUploadState({ status: 'initial' })}
                variant="warning_outline"
                className="text-[14px] font-semibold"
              >
                Try Again
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex h-full flex-col">
      {renderContent()}

      {/* delete confirmation dialog */}
      {isConfirmOpen && (
        <>
          {/* bg hitam */}
          <div className="fixed left-1/2 top-1/2 z-[1000] h-screen w-screen -translate-x-1/2 -translate-y-1/2 bg-black/50" />
          <div className="fixed left-1/2 top-1/2 z-[1001] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-[20px] border border-[#ccc] bg-white p-5 shadow-[0_4px_8px_rgba(0,0,0,0.1)]">
            <p className="text-center">
              Apakah Anda yakin ingin menghapus file ini?
            </p>

            <div className="mt-3 flex flex-row justify-center gap-4">
              <Button
                onClick={handleCancelDelete}
                variant="warning"
                className="text-[12px] font-semibold"
              >
                BATAL
              </Button>

              <Button
                onClick={handleConfirmDelete}
                variant="dark_blue"
                className="text-[12px] font-semibold"
              >
                YAKIN
              </Button>
            </div>
          </div>
        </>
      )}

      {/* upload confirmation dialog */}
      {isUploadConfirmOpen && pendingFile && (
        <>
          {/* bg hitam */}
          <div className="fixed left-1/2 top-1/2 z-[1000] h-screen w-screen -translate-x-1/2 -translate-y-1/2 bg-black/50" />
          <div className="fixed left-1/2 top-1/2 z-[1001] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-[20px] border border-[#ccc] bg-white p-5 shadow-[0_4px_8px_rgba(0,0,0,0.1)]">
            <p className="mb-2 text-center text-[16px] font-semibold">
              Konfirmasi Upload
            </p>
            <p className="text-center text-[14px] text-[#666]">
              Apakah Anda yakin ingin mengunggah file:
            </p>
            <p className="mb-4 mt-1 text-center text-[14px] font-semibold">
              {pendingFile.name}
            </p>

            <div className="mt-3 flex flex-row justify-center gap-4">
              <Button
                onClick={handleCancelUpload}
                variant="warning"
                className="text-[12px] font-semibold"
              >
                BATAL
              </Button>

              <Button
                onClick={handleConfirmUpload}
                variant="dark_blue"
                className="text-[12px] font-semibold"
              >
                UPLOAD
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CsvFormContent;
