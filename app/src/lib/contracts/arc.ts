import { parseAbi, type Address } from 'viem';

/**
 * Arc predeploys. Same addresses on testnet and mainnet (see docs.arc.io contract-addresses).
 */
export const USDC: Address = '0x3600000000000000000000000000000000000000'; // ERC-20 interface, 6 decimals
export const MEMO: Address = '0x5294E9927c3306DcBaDb03fe70b92e01cCede505';
export const MULTICALL3_FROM: Address = '0x522fAf9A91c41c443c66765030741e4AaCe147D0';
/** Emits an EIP-7708 Transfer (18 decimals) for every USDC movement, native or ERC-20. */
export const NATIVE_TRANSFER_EMITTER: Address = '0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE';

export const USDC_DECIMALS = 6;
/** Native (18-dec) to ERC-20 (6-dec) unit ratio. */
export const NATIVE_TO_USDC = 10n ** 12n;

export const memoAbi = parseAbi([
  'function memo(address target, bytes data, bytes32 memoId, bytes memoData)',
  'event BeforeMemo(uint256 indexed memoIndex)',
  'event Memo(address indexed sender, address indexed target, bytes32 callDataHash, bytes32 indexed memoId, bytes memo, uint256 memoIndex)',
  'error MemoFailed(bytes)',
]);

export const multicall3FromAbi = parseAbi([
  'struct Call3 { address target; bool allowFailure; bytes callData; }',
  'struct Result { bool success; bytes returnData; }',
  'function aggregate3(Call3[] calls) returns (Result[] returnData)',
]);

export const transferEventAbi = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);
