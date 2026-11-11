import {
  FILE_PROVIDER_IDS,
  type FileAnswerItem,
  type FileProviderId,
} from './file-answer';

export type FileUploadContext = {
  formId: string;
  fieldId: string;
  folder?: string;
};

export type FormFileProvider = {
  id: FileProviderId;
  label: string;
  upload: (file: File, context: FileUploadContext) => Promise<FileAnswerItem>;
};

export const FILE_PROVIDER_LABELS: Record<FileProviderId, string> = {
  uploadthing: 'UploadThing',
  'google-drive': 'Google Drive',
  onedrive: 'OneDrive',
};

export function resolveFileProvider(value: string | undefined): FileProviderId {
  return FILE_PROVIDER_IDS.includes(value as FileProviderId)
    ? (value as FileProviderId)
    : 'uploadthing';
}
