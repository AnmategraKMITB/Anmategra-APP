'use client';

import { X } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Dropzone } from '~/components/ui/shadcn-io/dropzone/index';
import { useUploadThing } from '~/utils/uploadthing';

interface CustomDropzoneProps {
  onFileChange: (url: string) => void;
  label: string;
  initialValue?: string;
}

const CustomDropzone = ({
  onFileChange,
  initialValue,
}: CustomDropzoneProps) => {
  const [files, setFiles] = useState<File[] | undefined>();
  const [filePreview, setFilePreview] = useState<string | undefined>(
    initialValue,
  );
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Use UploadThing hook
  const { startUpload } = useUploadThing('imageUploader', {
    onClientUploadComplete: (res) => {
      if (res?.[0]?.url) {
        const uploadedUrl = res[0].url;
        setFilePreview(uploadedUrl);
        onFileChange(uploadedUrl);
        setUploadProgress(100);
        setTimeout(() => {
          setIsUploading(false);
        }, 500);
      }
    },
    onUploadError: (error: Error) => {
      console.error('Upload error:', error);
      setIsUploading(false);
      setUploadProgress(0);
      alert(`Upload failed: ${error.message}`);
    },
    onUploadProgress: (progress: number) => {
      setUploadProgress(progress);
    },
  });

  const handleDrop = async (droppedFiles: File[]) => {
    if (droppedFiles.length === 0) return;

    setFiles(droppedFiles);
    setIsUploading(true);
    setUploadProgress(0);

    // Create preview immediately using FileReader
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === 'string') {
        setFilePreview(e.target?.result);
      }
    };
    reader.readAsDataURL(droppedFiles[0]!);

    // Upload to UploadThing
    try {
      await startUpload(droppedFiles);
    } catch (error) {
      console.error('Upload failed:', error);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleCancel = () => {
    setIsUploading(false);
    setUploadProgress(0);
    setFiles(undefined);
  };

  const handleChange = () => {
    setFilePreview(undefined);
    setFiles(undefined);
    setUploadProgress(0);
    onFileChange('');
  };

  return (
    <Dropzone
      accept={{ 'image/*': ['.png', '.jpg', '.jpeg'] }}
      onDrop={handleDrop}
      onError={console.error}
      className="group"
    >
      <div
        className={`relative h-44 w-full rounded-xl border-2 p-4 transition-all ${filePreview && !isUploading ? 'border-solid border-[#00B7B7]' : 'border-dashed border-gray-300 group-hover:border-[#00B7B7]'}`}
      >
        {!files && !isUploading && !filePreview && (
          <div className="flex h-full flex-col items-center justify-center gap-3 transition-colors group-hover:text-[#00B7B7]">
            <div className="relative h-12 w-12">
              <Image
                src="/images/miscellaneous/upload.svg"
                alt="Upload icon"
                width={50}
                height={50}
                className="absolute inset-0 transition-opacity group-hover:opacity-0"
              />
              <Image
                src="/images/miscellaneous/upload-blue.svg"
                alt="Upload icon hover"
                width={50}
                height={50}
                className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
              />
            </div>
            <div className="-mt-2 flex flex-col text-center">
              <p className="text-base font-medium text-gray-700 transition-colors group-hover:text-[#00B7B7]">
                Select image to upload
              </p>
              <p className="text-sm text-gray-500">or drag to drop it here</p>
            </div>
            <Button
              type="button"
              variant="light_blue"
              className="border-gray-300 hover:border-[#00B7B7]"
            >
              + Unggah
            </Button>
          </div>
        )}

        {isUploading && (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <div className="relative h-20 w-20">
              <svg className="h-20 w-20 -rotate-90 transform">
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="#e5e7eb"
                  strokeWidth="8"
                  fill="none"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="#3b82f6"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 36}`}
                  strokeDashoffset={`${2 * Math.PI * 36 * (1 - uploadProgress / 100)}`}
                  strokeLinecap="round"
                  className="transition-all duration-300"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-semibold text-[#00b7b7]">
                  {uploadProgress}%
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-600">Uploading file...</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="border-red-300 text-red-600 hover:bg-red-50"
            >
              <X className="mr-1 h-4 w-4" />
              Cancel
            </Button>
          </div>
        )}

        {filePreview && !isUploading && (
          <div className="absolute inset-0 h-full w-full overflow-hidden rounded-lg">
            <Image
              alt="Preview"
              className="h-full w-full object-cover"
              src={filePreview}
              fill
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
              <Button
                type="button"
                variant={'outline'}
                onClick={handleChange}
                className="border border-neutral-700 bg-white text-gray-900 hover:bg-gray-100"
              >
                Ubah File
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dropzone>
  );
};

export default CustomDropzone;
