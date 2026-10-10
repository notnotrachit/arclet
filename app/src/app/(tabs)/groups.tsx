import { useCallback } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatUsdc } from '@/lib/format';
import { NETWORKS } from '@/lib/networks';
import { useGroups } from '@/state/groups';
import { useReadyWallet } from '@/state/wallet';
import { Banner, Button, Card, Empty, ListRow, Screen } from '@/ui/components';
import { colors, spacing, type } from '@/ui/theme';

export default function Groups() {
  const { network } = useReadyWallet();
  const { groups, loading, refresh, available } = useGroups();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  if (!available) {
    return (
      <Screen>
        <Banner tone="warning">Group wallets aren’t deployed on {NETWORKS[network].label} yet. Switch networks in Settings.</Banner>
      </Screen>
    );
  }

  return (
    <Screen
      refreshing={loading}
      onRefresh={refresh}
      footer={<Button title="New group" icon="add" onPress={() => router.push('/group/new')} />}>
      <Text style={[type.muted, { marginBottom: spacing.md }]}>
        A group wallet is a shared USDC pot on Arc. Members add money and pay from it, and you can split
        expenses someone paid for out of pocket.
      </Text>
      <Card style={{ paddingVertical: spacing.xs }}>
        {groups.length === 0 ? (
          <Empty icon="people-outline" title="No groups yet" body="Create one for a trip, a flat, or a team." />
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
