import React, { createContext, useContext, useRef, useState } from 'react';

interface ModalOpts {
  message: string;
  withInput?: boolean;
  defaultValue?: string;
  okLabel?: string;
  cancelLabel?: string;
  hideCancel?: boolean;
}

interface ModalApi {
  nrDialog: (opts: ModalOpts) => Promise<string | boolean | null>;
  nrPrompt: (message: string, defaultValue?: string) => Promise<string | null>;
  nrConfirm: (message: string) => Promise<boolean>;
  nrAlert: (message: string) => Promise<void>;
}

const ModalContext = createContext<ModalApi | null>(null);

interface ModalState extends ModalOpts {
  isOpen: boolean;
}

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<ModalState>({ isOpen: false, message: '' });
  const [inputValue, setInputValue] = useState('');
  const resolveRef = useRef<((v: string | boolean | null) => void) | null>(null);

  const nrDialog = (opts: ModalOpts): Promise<string | boolean | null> =>
    new Promise((resolve) => {
      resolveRef.current = resolve;
      setInputValue(opts.defaultValue ?? '');
      setModal({ isOpen: true, ...opts });
    });

  const nrPrompt = (message: string, defaultValue = '') =>
    nrDialog({ message, withInput: true, defaultValue }).then(
      (v) => (v === false || v === null ? null : String(v))
    );

  const nrConfirm = (message: string) =>
    nrDialog({ message, withInput: false }).then(Boolean);

  const nrAlert = (message: string) =>
    nrDialog({ message, withInput: false, hideCancel: true }).then(() => undefined);

  const handleOk = () => {
    const result = modal.withInput ? inputValue : true;
    resolveRef.current?.(result);
    setModal((m) => ({ ...m, isOpen: false }));
  };

  const handleCancel = () => {
    resolveRef.current?.(modal.withInput ? null : false);
    setModal((m) => ({ ...m, isOpen: false }));
  };

  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !modal.hideCancel) handleCancel();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !modal.hideCancel) handleCancel();
    else if (e.key === 'Enter' && (modal.withInput || document.activeElement?.id === 'nr-modal-ok'))
      handleOk();
  };

  return (
    <ModalContext.Provider value={{ nrDialog, nrPrompt, nrConfirm, nrAlert }}>
      {children}
      <div
        id="nr-modal"
        className="nr-modal-overlay"
        hidden={!modal.isOpen}
        onClick={handleOverlay}
        onKeyDown={handleKey}
      >
        <div className="nr-modal" role="dialog" aria-modal="true" aria-labelledby="nr-modal-message">
          <p id="nr-modal-message" className="nr-modal-message">{modal.message}</p>
          {modal.withInput && (
            <input
              id="nr-modal-input"
              className="nr-modal-input"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              autoFocus
            />
          )}
          <div className="nr-modal-actions">
            {!modal.hideCancel && (
              <button type="button" id="nr-modal-cancel" className="btn-secondary" onClick={handleCancel}>
                {modal.cancelLabel ?? 'Annuler'}
              </button>
            )}
            <button type="button" id="nr-modal-ok" className="btn-primary" onClick={handleOk} autoFocus={!modal.withInput}>
              {modal.okLabel ?? 'OK'}
            </button>
          </div>
        </div>
      </div>
    </ModalContext.Provider>
  );
}

export const useModal = (): ModalApi => {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used inside <ModalProvider>');
  return ctx;
};
