"use client";

import { useRouter } from "next/navigation";
import { HardDrive } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useStorageQuotaStore } from "@/store/storageQuotaStore";
import { useTranslation } from "@/hooks/useTranslation";

export function StorageQuotaExceededDialog() {
  const router = useRouter();
  const { t } = useTranslation();
  const showStorageQuotaDialog = useStorageQuotaStore(
    (s) => s.showStorageQuotaDialog,
  );
  const setShowStorageQuotaDialog = useStorageQuotaStore(
    (s) => s.setShowStorageQuotaDialog,
  );

  const handleClose = () => {
    setShowStorageQuotaDialog(false);
  };

  const handleGoToCourses = () => {
    setShowStorageQuotaDialog(false);
    router.push("/course");
  };

  const title = t("course.storageQuotaExceededTitle");
  const description = t("course.storageQuotaExceededDescription");

  return (
    <AlertDialog
      open={showStorageQuotaDialog}
      onOpenChange={setShowStorageQuotaDialog}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <HardDrive className="w-5 h-5 text-amber-600" />
            </div>
            <span>{title}</span>
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base pt-2">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <AlertDialogAction onClick={handleClose} className="w-full sm:w-auto">
            {t("common.ok")}
          </AlertDialogAction>
          <AlertDialogAction
            onClick={handleGoToCourses}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
            {t("course.goToCourseManagement")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
