import type { Address } from 'viem';
import { readJson, writeJson } from './storage';

/** Local-only address book (names never go onchain). */
const KEY = 'contacts:v1';
export const MAX_CONTACT_NAME = 32;

export type Contacts = Record<string, string>; // lowercase address -> name

export const loadContacts = () => readJson<Contacts>(KEY, {});

/** Saves (or renames) a contact. An empty name removes it. */
export async function saveContact(address: Address, name: string): Promise<Contacts> {
  const all = await loadContacts();
  const trimmed = name.trim().slice(0, MAX_CONTACT_NAME);
  if (trimmed) all[address.toLowerCase()] = trimmed;
  else delete all[address.toLowerCase()];
  await writeJson(KEY, all);
  return all;
}

export const removeContact = (address: Address) => saveContact(address, '');
