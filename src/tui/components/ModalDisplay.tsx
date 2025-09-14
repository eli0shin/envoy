import { HelpModal } from './HelpModal.js';
import { useModalState } from './ModalProvider.js';

export function ModalDisplay() {
  const { currentModal } = useModalState();

  if (currentModal === 'help') {
    return <HelpModal />;
  }

  return null;
}
