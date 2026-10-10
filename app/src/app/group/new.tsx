import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Address } from 'viem';
import { confirmWithBiometrics } from '@/lib/auth';
import { parseUsdcInput, shortAddress } from '@/lib/format';
import { createGroup } from '@/lib/groups';
import { friendlyError } from '@/lib/tx';
import { useContacts } from '@/state/contacts';
import { useGroups } from '@/state/groups';
import { useReadyWallet } from '@/state/wallet';
import { AddressPicker } from '@/ui/AddressPicker';
import { Avatar, Banner, Button, Card, Field, ListRow, Screen, SectionTitle } from '@/ui/components';
import { colors, spacing, type } from '@/ui/theme';

export default function NewGroup() {
  const { account, address, network } = useReadyWallet();
  const { label } = useContacts();
  const { refresh } = useGroups();
  const [name, setName] = useState('');
  const [members, setMembers] = useState<Address[]>([]);
  const [limit, setLimit] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const limitUnits = limit ? parseUsdcInput(limit) : 0n;
  const valid = name.trim().length > 0 && name.trim().length <= 64 && limitUnits !== null;

  const addMember = (a: Address) => {
    if (a.toLowerCase() === address.toLowerCase()) return;
    setMembers((m) => (m.some((x) => x.toLowerCase() === a.toLowerCase()) ? m : [...m, a]));
  };

  const onCreate = async () => {
    setError(undefined);
    if (!(await confirmWithBiometrics('Create group wallet'))) return;
    setBusy(true);
    try {
      const { group } = await createGroup({
        network,
        account,
        name: name.trim(),
        members,
        memberSpendLimit: limitUnits ?? 0n,
      });
      await refresh();
      if (group) router.replace({ pathname: '/group/[address]', params: { address: group } });
      else router.back();
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button title="Create group" onPress={onCreate} loading={busy} disabled={!valid} />}>
      <Field label="Group name" placeholder="Goa trip, Flat 4B, Team lunch…" value={name} onChangeText={setName} maxLength={64} />

      <SectionTitle>Members</SectionTitle>
      <Text style={[type.small, { marginBottom: spacing.sm }]}>
        Add each person’s Arclet address (they can show it from Request → QR). You can add more later.
      </Text>
      <AddressPicker onAdd={addMember} exclude={[address, ...members]} />
      <Card style={{ paddingVertical: spacing.xs }}>
        <ListRow left={<Avatar address={address} name="You" />} title="You" subtitle="Admin" />
        {members.map((m) => (
          <ListRow
            key={m}
            left={<Avatar address={m} name={label(m)} />}
            title={label(m)}
            subtitle={shortAddress(m)}
            right={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${label(m)}`}
                onPress={() => setMembers((all) => all.filter((x) => x !== m))}>
                <Ionicons name="close-circle" size={22} color={colors.textFaint} />
              </Pressable>
            }
          />
        ))}
      </Card>

      <Field
        label="Per-payment limit for members (USDC)"
        placeholder="No limit"
        value={limit}
        onChangeText={setLimit}
        keyboardType="decimal-pad"
        hint="Members can pay up to this much per payment from the group wallet. Admins are not limited."
        error={limitUnits === null ? 'Enter a valid amount' : undefined}
      />
      <Banner>Creating a group deploys a small contract on Arc. The fee is paid in USDC (a few cents).</Banner>
      {error ? <Banner tone="error">{error}</Banner> : null}
    </Screen>
  );
}
