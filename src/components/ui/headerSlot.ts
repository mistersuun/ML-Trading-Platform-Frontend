import { createContext } from 'react';

/** The element in the app shell's 40px header bar that PageHeader portals into. */
export const HeaderSlotContext = createContext<HTMLElement | null>(null);
