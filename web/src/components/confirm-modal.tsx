import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  textContent: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  isConfirming?: boolean;
}

export function ConfirmModal({
  isOpen,
  onOpenChange,
  title,
  textContent,
  onConfirm,
  onCancel,
  confirmText = "Yes",
  cancelText = "No",
  isConfirming = false,
}: ConfirmModalProps) {
  const handleCancel = () => {
    if (onCancel) onCancel();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover border sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="pt-2">{textContent}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={handleCancel} disabled={isConfirming} className="cursor-pointer">
            {cancelText}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isConfirming} className="cursor-pointer">
            {confirmText}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
