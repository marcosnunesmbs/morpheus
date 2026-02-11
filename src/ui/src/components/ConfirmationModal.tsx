import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './Dialog';
import { Button } from './dashboard/Button';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmJson?: string; // Optional custom text for confirm button
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
}

export function ConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm,
  title,
  description,
  confirmJson = 'Confirm',
  variant = 'default'
}: ConfirmationModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-md bg-azure-surface dark:bg-black border-azure-border dark:border-matrix-primary/30"
      >
        <DialogHeader>
          <DialogTitle className="text-azure-primary dark:text-matrix-highlight flex items-center gap-2">
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-azure-text-secondary dark:text-matrix-secondary">
            {description}
          </p>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            <Button
              variant="outline"
              onClick={onClose}
              className="dark:border-matrix-primary/30 dark:text-matrix-secondary dark:hover:bg-matrix-primary/20"
            >
              Cancel
            </Button>
            <Button
              variant={variant}
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={variant === 'destructive' 
                ? "dark:bg-red-900/50 dark:text-red-200 dark:hover:bg-red-800/60" 
                : "dark:bg-matrix-primary dark:text-black dark:hover:bg-matrix-highlight"}
            >
              {confirmJson}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
