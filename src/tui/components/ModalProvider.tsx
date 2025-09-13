import { createContext, useContext, type ReactNode } from "react";
import { useKeys, parseKeys } from "../keys/index.js";

type ModalType = "help" | null;

type ModalContextType = {
  currentModal: ModalType;
  showModal: (type: ModalType) => void;
  hideModal: () => void;
};

const ModalContext = createContext<ModalContextType | null>(null);

type ModalProviderProps = {
  modalState: ModalType;
  setModalState: (state: ModalType) => void;
  children: ReactNode;
};

export function ModalProvider({
  modalState,
  setModalState,
  children,
}: ModalProviderProps) {
  // Use keybindings to close modal (modal scope has higher priority)
  useKeys((key) => {
    if (modalState === null) return false;
    return parseKeys(key, 'modal.close', () => setModalState(null), 'modal');
  }, { scope: 'modal', enabled: () => modalState !== null });

  const showModal = (type: ModalType) => {
    setModalState(type);
  };

  const hideModal = () => {
    setModalState(null);
  };

  const contextValue: ModalContextType = {
    currentModal: modalState,
    showModal,
    hideModal,
  };

  return (
    <ModalContext.Provider value={contextValue}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModalState(): ModalContextType {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModalState must be used within a ModalProvider");
  }
  return context;
}
