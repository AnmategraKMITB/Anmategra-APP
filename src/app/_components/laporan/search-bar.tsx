import { Search } from 'lucide-react';

export const SearchBar = () => {
  return (
    <div className="relative mb-6">
      <input
        type="text"
        placeholder="Cari laporan"
        className="w-full rounded-md border px-4 py-2 pl-10"
      />
      <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 transform text-gray-400" />
    </div>
  );
};
