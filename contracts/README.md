# Arclet contracts

- `src/GroupWallet.sol`: shared USDC pool (deposit / pay with notes, per-member spend limit) and a split ledger (expenses, USDC settlement, offchain settlement).
- `src/GroupWalletFactory.sol`: deploys groups and indexes `groupsOf(member)` so the app can discover them.

```bash
arc-forge test                                                            # unit + fuzz tests (mock USDC)
arc-forge test --match-contract ArcForkTest --fork-url https://rpc.testnet.arc.io   # real Arc predeploys
../scripts/deploy.sh testnet                                              # deploy + verify + sync ABIs to app
```

The fork suite checks the Arc-specific paths the app depends on:
- `Memo` keeps the user as the sender for USDC transfers and for `GroupWallet.pay`.
- `Multicall3From` batches approve and deposit into one transaction.
- EIP-7708 native `Transfer` logs are emitted at 18 decimals.
- Plain native sends to a group revert.
