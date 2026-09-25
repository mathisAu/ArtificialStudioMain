"use client";

import {
  useState,
  useTransition,
  type Dispatch,
  type SetStateAction,
} from "react";

export interface BaseActionState {
  error?: string;
  success?: string;
  id?: string;
}

/**
 * Formulier dat een server action aanroept en daarna iets in de UI doet:
 * een toast tonen, de modal sluiten, doorschakelen naar de nieuwe pagina.
 *
 * Bewust géén `useActionState` met een `useEffect` erachter. Dat patroon roept
 * setState aan vanuit een effect, wat cascaderende renders veroorzaakt (en
 * terecht door de React Compiler wordt afgekeurd). Door de action binnen een
 * transition af te wachten, gebeurt alles in één doorlopende handeling.
 */
export function useActionForm<S extends BaseActionState>(
  action: (prev: S, formData: FormData) => Promise<S>,
  onSuccess?: (state: S) => void,
) {
  const [error, setError] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(undefined);

    startTransition(async () => {
      const result = await action({} as S, formData);

      if (result?.error) {
        setError(result.error);
        return;
      }

      onSuccess?.(result);
    });
  }

  return { submit, pending, error, clearError: () => setError(undefined) };
}

/**
 * De officiële React-manier om state bij te stellen wanneer een prop verandert:
 * tijdens de render, niet in een effect.
 *
 *   const [status, setStatus] = useSyncedState(props.status);
 */
export function useSyncedState<T>(
  value: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [current, setCurrent] = useState(value);
  const [previous, setPrevious] = useState(value);

  if (previous !== value) {
    setPrevious(value);
    setCurrent(value);
  }

  return [current, setCurrent];
}
