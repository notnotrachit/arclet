import { Touch } from '@/ui/motion';
import { useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Address } from 'viem';
import { confirmWithBiometrics } from '@/lib/auth';
import { formatUsdc, parseUsdcInput, shortAddress, usdcToDecimal } from '@/lib/format';
import { addMember, removeMember, setAdmin, setSpendLimit } from '@/lib/groups';
import { friendlyError } from '@/lib/tx';
import { useContacts } from '@/state/contacts';
import { useGroups } from '@/state/groups';
import { useGroup } from '@/state/useGroup';
import { useToast } from '@/state/toast';
import { useReadyWallet } from '@/state/wallet';
import { AddressPicker } from '@/ui/AddressPicker';
import { Avatar, Banner, Button, Card, Field, ListRow, PageIntro, Empty, Screen, SectionTitle } from '@/ui/components';
import { spacing, useTheme } from '@/ui/theme';

export default function Members() {
  const { colors, type } = useTheme();
  const { address: param } = useLocalSearchParams<{ address: string }>();
  const { account, network } = useReadyWallet();
  const { label, nameOf } = useContacts();
  const { refresh: refreshGroups } = useGroups();
  const toast = useToast();
  const { address, detail, refresh, me, error: loadError, loading } = useGroup(param);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [limit, setLimit] = useState<string | null>(null);

  if (!address || !detail) return <Screen refreshing={loading} onRefresh={refresh}>{loadError ? <><Banner tone="error">{loadError}</Banner><Button title="Try again" onPress={refresh} /></> : <Empty icon="people-outline" title="Loading members…" />}</Screen>;
  const isAdmin = detail.isAdmin;

  const run = async (key: string, prompt: string, fn: () => Promise<unknown>, done?: string) => {
    setError(undefined);
    if (!(await confirmWithBiometrics(prompt))) return;
    setBusy(key);
    try {
      await fn();
      await refresh();
      refreshGroups();
      if (done) toast({ title: done, tone: 'success' });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const onAdd = (a: Address) =>
    run('add', 'Add member', () => addMember({ network, account, group: address, member: a }), `${label(a)} added`);

  const confirm = (title: string, body: string, action: () => void) => {
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(`${title}\n\n${body}`)) action();
      return;
    }
    Alert.alert(title, body, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: action },
    ]);
  };

  const limitUnits = limit !== null ? (limit === '' ? 0n : parseUsdcInput(limit)) : null;

  return (
    <Screen>
      <PageIntro eyebrow="Group members" title="The people behind the plans." body="Manage who shares this wallet and what members can spend." />
      {isAdmin ? (
        <>
          <SectionTitle>Add a member</SectionTitle>
          <AddressPicker onAdd={onAdd} exclude={detail.members.map((m) => m.address)} />
        </>
      ) : (
        <Banner>Only admins can add members or change limits.</Banner>
      )}

      <SectionTitle>{detail.members.length} members</SectionTitle>
      <Card style={{ paddingVertical: spacing.xs }}>
        {detail.members.map((m) => {
          const isMe = m.address.toLowerCase() === me.toLowerCase();
          return (
            <View key={m.address} style={{ paddingVertical: spacing.xs }}>
              <ListRow
                left={<Avatar address={m.address} name={label(m.address)} />}
                title={`${label(m.address)}${m.admin ? ' · admin' : ''}`}
                subtitle={shortAddress(m.address)}
                right={
                  !isMe ? (
                    <Touch
                      accessibilityRole="button"
                      accessibilityLabel={nameOf(m.address) ? `Edit contact ${label(m.address)}` : 'Save as contact'}
                      hitSlop={8}
                      onPress={() => router.push({ pathname: '/contact/new', params: { address: m.address } })}>
                      <Ionicons
                        name={nameOf(m.address) ? 'create-outline' : 'person-add-outline'}
                        size={20}
                        color={colors.accent}
                      />
                    </Touch>
                  ) : undefined
                }
              />
              {isAdmin && !isMe ? (
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
                  <Button
                    title={m.admin ? 'Remove admin' : 'Make admin'}
                    variant="secondary"
                    style={{ flex: 1 }}
                    disabled={!!busy}
                    loading={busy === `admin-${m.address}`}
                    onPress={() => run(`admin-${m.address}`, 'Change admin', () => setAdmin({ network, account, group: address, member: m.address, admin: !m.admin }))}
                  />
                  <Button
                    title="Remove"
                    variant="danger"
                    style={{ flex: 1 }}
                    loading={busy === `rm-${m.address}`}
                    disabled={!!busy || m.net !== 0n}
                    onPress={() =>
                      confirm('Remove member?', `${label(m.address)} will lose access to the group wallet.`, () =>
                        run(`rm-${m.address}`, 'Remove member', () => removeMember({ network, account, group: address, member: m.address })),
                      )
                    }
                  />
                </View>
              ) : null}
              {m.net !== 0n && isAdmin && !isMe ? (
                <Text style={type.small}>Has an open split balance (${formatUsdc(m.net < 0n ? -m.net : m.net)}), settle before removing.</Text>
              ) : null}
            </View>
          );
        })}
      </Card>

      {isAdmin ? (
        <>
          <SectionTitle>Member spend limit</SectionTitle>
          <Field
            label="Max per payment for non-admins (USDC)"
            placeholder="No limit"
            keyboardType="decimal-pad"
            value={limit ?? (detail.memberSpendLimit ? usdcToDecimal(detail.memberSpendLimit) : '')}
            onChangeText={setLimit}
            error={limit !== null && limitUnits === null ? 'Enter a valid amount' : undefined}
          />
          <Button
            title="Save limit"
            variant="secondary"
            disabled={!!busy || limit === null || limitUnits === null}
            loading={busy === 'limit'}
            onPress={() => run('limit', 'Update spend limit', () => setSpendLimit({ network, account, group: address, limit: limitUnits ?? 0n }), 'Limit updated')}
          />
        </>
      ) : null}

      <SectionTitle>Leave</SectionTitle>
      <Button
        title="Leave group"
        variant="danger"
        disabled={!!busy || detail.myNet !== 0n}
        loading={busy === 'leave'}
        onPress={() =>
          confirm('Leave this group?', 'You’ll lose access to the group wallet.', () =>
            run('leave', 'Leave group', async () => {
              await removeMember({ network, account, group: address, member: me });
              router.dismissAll();
            }),
          )
        }
      />
      {detail.myNet !== 0n ? <Text style={type.small}>Settle your split balance before leaving.</Text> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
    </Screen>
  );
}
