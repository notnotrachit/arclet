import { useCallback } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatUsdc } from '@/lib/format';
import { NETWORKS } from '@/lib/networks';
import { useGroups } from '@/state/groups';
import { useReadyWallet } from '@/state/wallet';
import { Banner, Button, Card, Empty, ListRow, PageIntro, Screen } from '@/ui/components';
import { spacing, useTheme } from '@/ui/theme';

export default function Groups() {
  const { colors, type } = useTheme();
  const { network } = useReadyWallet();
  const { groups, loading, refresh, available } = useGroups();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  if (!available) {
    return (
      <Screen edges={[]}>
        <Banner tone="warning">Group wallets aren’t deployed on {NETWORKS[network].label} yet. Switch networks in Settings.</Banner>
      </Screen>
    );
  }

  return (
    <Screen
      edges={[]}
      refreshing={loading}
      onRefresh={refresh}
      footer={<Button title="Create a group" icon="add" onPress={() => router.push('/group/new')} />}>
      <PageIntro eyebrow="Better together" title="One group. Less figuring out." body="Pool money for plans, or split expenses after someone pays." />
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
        <Card style={{ flex: 1 }}><Text style={type.small}>SHARED WALLETS</Text><Text style={[type.title, { marginTop: spacing.sm }]}>{groups.length}</Text></Card>
        <Card style={{ flex: 1 }}><Text style={type.small}>POOLED USDC</Text><Text style={[type.title, { marginTop: spacing.sm }]} adjustsFontSizeToFit numberOfLines={1}>${formatUsdc(groups.reduce((total, group) => total + group.balance, 0n))}</Text></Card>
      </View>
      <Text style={[type.muted, { marginBottom: spacing.md }]} accessible={false}>
        Shared wallets for trips, home, and everything in between.
      </Text>
      <Card style={{ paddingVertical: spacing.xs }}>
        {groups.length === 0 ? (
          <Empty icon="people-outline" title="Good plans start with your people" body="Create a group, add friends, and keep shared money and expenses in one place." />
        ) : (
          groups.map((g) => (
            <ListRow
              key={g.address}
              left={
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: colors.accentSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Ionicons name="people" size={18} color={colors.accent} />
                </View>
              }
              title={g.name}
              subtitle={`${g.memberCount} members${g.isAdmin ? ' · admin' : ''}`}
              right={`$${formatUsdc(g.balance)}`}
              rightSub={
                g.myNet === 0n ? 'settled' : g.myNet > 0n ? `owed $${formatUsdc(g.myNet)}` : `you owe $${formatUsdc(-g.myNet)}`
              }
              onPress={() => router.push({ pathname: '/group/[address]', params: { address: g.address } })}
            />
          ))
        )}
      </Card>
    </Screen>
  );
}
