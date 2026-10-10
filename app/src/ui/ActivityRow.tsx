import { Linking, Text } from 'react-native';
import { router } from 'expo-router';
import type { ActivityItem } from '@/lib/activity';
import { formatUsdc, timeAgo } from '@/lib/format';
import { txUrl, type NetworkId } from '@/lib/networks';
import { useContacts } from '@/state/contacts';
import { useGroups } from '@/state/groups';
import { Avatar, ListRow } from './components';
import { colors } from './theme';

/** Tap: open the person (or group). Long-press: open the transaction on the explorer. */
export function ActivityRow({ item, network }: { item: ActivityItem; network: NetworkId }) {
  const { label } = useContacts();
  const { groups } = useGroups();
  const who = label(item.counterparty);
  const incoming = item.direction === 'in';
  const isGroup = groups.some((g) => g.address.toLowerCase() === item.counterparty.toLowerCase());
  const isMint = /^0x0{40}$/i.test(item.counterparty);
  const subtitleParts = [item.note ? `“${item.note}”` : null, item.timestamp ? timeAgo(item.timestamp) : null].filter(Boolean);
  return (
    <ListRow
      left={<Avatar address={item.counterparty} name={who} />}
      title={incoming ? `From ${who}` : `To ${who}`}
      subtitle={subtitleParts.join(' · ') || undefined}
      right={
        <Text style={{ color: incoming ? colors.positive : colors.text, fontWeight: '700', fontSize: 15 }}>
          {incoming ? '+' : '−'}
          {formatUsdc(item.amount)}
        </Text>
      }
      onPress={() =>
        isMint
          ? Linking.openURL(txUrl(network, item.txHash))
          : isGroup
            ? router.push({ pathname: '/group/[address]', params: { address: item.counterparty } })
            : router.push({ pathname: '/contact/[address]', params: { address: item.counterparty } })
      }
      onLongPress={() => Linking.openURL(txUrl(network, item.txHash))}
    />
  );
}
