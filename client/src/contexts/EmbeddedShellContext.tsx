import { createContext, useContext, type ReactNode } from 'react';

const EmbeddedShellContext = createContext<boolean>(false);

export function EmbeddedShellProvider({ children }: { children: ReactNode }) {
  return (
    <EmbeddedShellContext.Provider value={true}>
      {children}
    </EmbeddedShellContext.Provider>
  );
}

export function useIsEmbeddedShell(): boolean {
  return useContext(EmbeddedShellContext);
}
