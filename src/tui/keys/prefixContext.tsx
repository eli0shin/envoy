import {
  createContext,
  use,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

// Module-level state for non-React code - using object for stable reference
const moduleState = {
  activePrefix: null as string | null,
};

type PrefixContextValue = {
  activePrefix: string | null;
  setActivePrefixState: (name: string | null) => void;
};

const PrefixContext = createContext<PrefixContextValue | null>(null);

// Module-level functions for non-React code (read-only from module perspective)
export function getActivePrefix(): string | null {
  return moduleState.activePrefix;
}

export function setActivePrefix(name: string): void {
  moduleState.activePrefix = name;
}

export function clearPrefix(): void {
  moduleState.activePrefix = null;
}

export function togglePrefix(name: string): void {
  if (moduleState.activePrefix === name) moduleState.activePrefix = null;
  else moduleState.activePrefix = name;
}

export function KeysProvider({ children }: { children: ReactNode }) {
  const [activePrefix, setActivePrefix] = useState<string | null>(null);

  // Enhanced setter that updates both module and React state
  const setActivePrefixState = useCallback((name: string | null) => {
    moduleState.activePrefix = name;
    setActivePrefix(name);
  }, []);

  const contextValue = useMemo(
    () => ({ activePrefix, setActivePrefixState }),
    [activePrefix, setActivePrefixState]
  );

  return <PrefixContext value={contextValue}>{children}</PrefixContext>;
}

export function usePrefixState(): PrefixContextValue {
  const ctx = use(PrefixContext);
  if (!ctx) throw new Error('usePrefixState must be used within KeysProvider');
  return ctx;
}
