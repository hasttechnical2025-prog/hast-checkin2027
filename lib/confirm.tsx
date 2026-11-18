'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface ConfirmOpts {
  title?: string;
  message: string;
  okText?: string;
  danger?: boolean;
}

const Ctx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);

/** Hộp xác nhận in-app (thay window.confirm). Bọc app trong <ConfirmProvider>. */
export function useConfirm() {
  return useContext(Ctx);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ opts: ConfirmOpts; resolve: (v: boolean) => void } | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ opts, resolve })),
    [],
  );

  function done(v: boolean) {
    state?.resolve(v);
    setState(null);
  }

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {state && (
        <div className="cc-dlg-overlay" onClick={() => done(false)}>
          <div className="cc-dlg" style={{ maxWidth: 360, textAlign: 'left' }} onClick={(e) => e.stopPropagation()}>
            {state.opts.title && <h3 style={{ marginTop: 0 }}>{state.opts.title}</h3>}
            <p style={{ fontSize: 14, lineHeight: 1.5 }}>{state.opts.message}</p>
            <div className="cc-dlg-btns">
              <button
                className="btn"
                style={{ flex: 1, ...(state.opts.danger ? { background: 'var(--err)' } : {}) }}
                onClick={() => done(true)}
              >
                {state.opts.okText || 'Đồng ý'}
              </button>
              <button className="btn cc-btn-ghost" style={{ flex: 1 }} onClick={() => done(false)}>
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
