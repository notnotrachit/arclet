import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getAddress, type Address } from 'viem';
import { loadContacts, removeContact, saveContact, type Contacts } from '@/lib/contacts';
import { shortAddress } from '@/lib/format';
import { useWallet } from './wallet';

export interface Contact {
  address: Address;
  name: string;
}

interface ContactsValue {
  contacts: Contacts;
  /** Saved contacts sorted by name. */
  list: Contact[];
  /** Display name: "You", a saved contact, a known group, or a short address. */
  label: (a: Address) => string;
  /** The saved contact name for an address, if any. */
  nameOf: (a: Address) => string | undefined;
  save: (a: Address, name: string) => Promise<void>;
  remove: (a: Address) => Promise<void>;
  /** Groups register their names here so activity rows can say "Goa Trip" instead of 0x…. */
  rememberGroup: (a: Address, name: string) => void;
}

const ContactsContext = createContext<ContactsValue | null>(null);

export function ContactsProvider({ children }: { children: ReactNode }) {
  const { address } = useWallet();
  const [contacts, setContacts] = useState<Contacts>({});
  const [groups, setGroups] = useState<Record<string, string>>({});

  useEffect(() => {
    loadContacts().then(setContacts);
  }, []);

  const list = useMemo(
    () =>
      Object.entries(contacts)
        .map(([a, name]) => ({ address: getAddress(a), name }))
        .sort((x, y) => x.name.localeCompare(y.name)),
    [contacts],
  );

  const nameOf = useCallback((a: Address) => contacts[a.toLowerCase()], [contacts]);

  const label = useCallback(
    (a: Address) => {
      const k = a.toLowerCase();
      if (address && k === address.toLowerCase()) return 'You';
      if (k === '0x0000000000000000000000000000000000000000') return 'Bridge / mint';
      return contacts[k] ?? (groups[k] ? `${groups[k]} (group)` : shortAddress(a));
    },
    [address, contacts, groups],
  );

  const save = useCallback(async (a: Address, name: string) => {
    setContacts(await saveContact(a, name));
  }, []);

  const remove = useCallback(async (a: Address) => {
    setContacts(await removeContact(a));
  }, []);

  const rememberGroup = useCallback((a: Address, name: string) => {
    setGroups((g) => (g[a.toLowerCase()] === name ? g : { ...g, [a.toLowerCase()]: name }));
  }, []);

  return (
    <ContactsContext.Provider value={{ contacts, list, label, nameOf, save, remove, rememberGroup }}>
      {children}
    </ContactsContext.Provider>
  );
}

export function useContacts() {
  const ctx = useContext(ContactsContext);
  if (!ctx) throw new Error('useContacts must be used inside ContactsProvider');
  return ctx;
}
