import { Dialog, DialogContent, DialogHeader, DialogTitle } from './Dialog';
import { Button } from '../components/dashboard/Button';

interface RestartConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function RestartConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm 
}: RestartConfirmationModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-md bg-azure-surface dark:bg-black border-azure-border dark:border-matrix-primary"
      >
        <DialogHeader>
          <DialogTitle className="text-azure-primary dark:text-matrix-highlight flex items-center gap-2">
            Confirm Restart
          </DialogTitle>
        </DialogHeader>
        
        <div>
          <p className="text-azure-text-secondary dark:text-matrix-secondary mb-6">
            Are you sure you want to restart the Morpheus agent? This will temporarily disconnect all services and channels.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <Button
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onConfirm();
                onClose();
              }}
            >
              Confirm Restart
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}