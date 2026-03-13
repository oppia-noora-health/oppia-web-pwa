import { create } from "zustand";

interface StorageQuotaState {
  showStorageQuotaDialog: boolean;
  setShowStorageQuotaDialog: (show: boolean) => void;
}

export const useStorageQuotaStore = create<StorageQuotaState>((set) => ({
  showStorageQuotaDialog: false,
  setShowStorageQuotaDialog: (show) => set({ showStorageQuotaDialog: show }),
}));
