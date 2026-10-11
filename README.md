# Arclet

A mobile USDC wallet for [Arc](https://docs.arc.io). Pay people by tapping phones (NFC) or scanning a QR code, get notified the moment money lands, and share money with friends through group wallets and expense splits.

Arc settles in under a second and charges gas in USDC, so a payment is final by the time the receiver's screen turns green, and nobody needs a second token for fees.

| | |
|---|---|
| **App** | Expo / React Native (Android, iOS, web) in [`app/`](app) |
| **Contracts** | `GroupWallet` + `GroupWalletFactory` (Solidity, Arc Foundry) in [`contracts/`](contracts) |
| **Network** | Arc Testnet and Arc Mainnet (see [Deployments](#deployments)) |

## Features

- **Self-custodial wallet.** Keys are generated on the phone and stored in the iOS Keychain / Android Keystore, with biometric approval for every payment. The wallet is a plain EOA because Arc's `Memo` and `Multicall3From` predeploys only accept EOAs.
- **Tap to pay (NFC).** The receiver's Android phone emulates an NFC Type 4 tag carrying an `arclet://pay?...` request, implemented in a local Expo module ([`app/modules/arclet-hce`](app/modules/arclet-hce)). The payer reads it on Android or iPhone, confirms with biometrics, and pays. NFC only carries the request; the payment itself is a signed Arc transaction.
- **QR codes.** There are two formats: Arclet's own request format, which carries the amount, note, and reference, and a standard EIP-681 USDC request so MetaMask and other wallets can pay too.
- **Instant notifications.** The app watches Arc's EIP-7708 native `Transfer` logs and shows an in-app banner plus a local notification with the sender and note. The Request screen turns green when the matching payment lands.
- **Notes on every payment.** Personal and group payments go through Arc's [`Memo`](https://docs.arc.io/arc/concepts/transaction-memos) predeploy, which keeps your wallet as `msg.sender`. Each request has a `memoId` so the receiver can match the exact payment.
- **Group wallets.** A shared USDC pot. Members add money (approve and deposit are batched into one transaction through `Multicall3From` when possible) and pay anyone from the pot, including by tap or scan. Admins set a per-payment limit for members, and every deposit and payment records who did it and why.
- **Splits.** Record expenses someone paid out of pocket, split equally or by custom amounts. The contract tracks each member's net balance. The app suggests the fewest payments needed to settle, and debtors can settle in USDC, or creditors can mark a cash repayment as received.

## How it uses Arc

| Arc feature | Where |
|---|---|
| USDC as gas, 18-dec native and 6-dec ERC-20 views of one balance | Balance display, fee reserve, `nativeToUsdc` ([`format.ts`](app/src/lib/format.ts)) |
| Sub-second deterministic finality | One receipt means final; the Request screen confirms without waiting for extra confirmations |
| `Memo` predeploy (`0x5294…e505`) | Notes and request matching ([`payments.ts`](app/src/lib/payments.ts)) |
| `Multicall3From` predeploy (`0x522f…47D0`) | Approve and deposit/settle in one transaction ([`groups.ts`](app/src/lib/groups.ts)) |
| EIP-7708 system `Transfer` logs (`0xffff…FfFE`) | Activity feed and notifications, with each movement counted once ([`activity.ts`](app/src/lib/activity.ts)) |
| 20 gwei base-fee floor, `-32014` lagging-backend errors, 10k-block `eth_getLogs` cap | [`clients.ts`](app/src/lib/clients.ts), [`logs.ts`](app/src/lib/logs.ts) |
| No-receive contracts revert on plain native sends | `GroupWallet` has no `receive()`, so money can only arrive through `deposit()` and is always attributed |

## Repo layout

```
contracts/   Foundry project (arc-forge). src/, test/ (26 tests incl. fuzz), script/Deploy.s.sol
app/         Expo app. src/app = screens (expo-router), src/lib = Arc logic, modules/arclet-hce = NFC HCE
website/     Responsive Arclet landing page with a real device screenshot; plain HTML, CSS and JS
scripts/     deploy.sh (deploy + verify + sync), sync-contracts.mjs (ABIs + addresses -> app)
```

Preview the landing page locally with `python3 -m http.server 4173 --directory website`, then open `http://localhost:4173`.

## Run it

Prerequisites: Node 22+, [Arc Foundry](https://docs.arc.io/arc/tutorials/install-arc-foundry), Android SDK (for local builds), or an Expo account (for EAS builds).

```bash
# Contracts
cd contracts && arc-forge test

# Deploy to Arc Testnet (fund DEPLOYER_ADDRESS from https://faucet.circle.com first)
cp .env.example .env   # set DEPLOYER_PRIVATE_KEY / DEPLOYER_ADDRESS
../scripts/deploy.sh testnet   # deploys, verifies on explorer, writes app/src/lib/contracts/generated.ts

# App (needs a dev build because of NFC and the camera; Expo Go won't work)
cd ../app && npm install
npx expo run:android          # or: npx eas-cli build --profile preview --platform android
npm run web                   # web demo: QR, send, groups, splits (no NFC)
```

To try tap to pay: install the APK on two Android phones. On phone A, open **Request** and enter an amount. On phone B, tap **Tap** and hold the phones back to back. Phone B then shows a prefilled payment to approve.

## Deployments

| Network | GroupWalletFactory |
|---|---|
| Arc Testnet (5042002) | [`0x7d65F93502853207c947CCB6A87048CBbC00dA08`](https://explorer.testnet.arc.io/address/0x7d65F93502853207c947CCB6A87048CBbC00dA08) (verified) |
| Arc Mainnet (5042) | `0x7d65f93502853207c947ccb6a87048cbbc00da08` (deployed at block `25260072`) |

## Security notes

This is unaudited hackathon software, so keep balances small.

- Keys never leave the device and are excluded from backups. The web build stores keys in `localStorage` and is for demos only.
- Notes are public onchain, and the app says so wherever you type one.
- `GroupWallet` uses OpenZeppelin `SafeERC20` and `ReentrancyGuard` and has custom errors for every rejected path.
- There is no backend, so nothing to authenticate against. Everything is reads from the Arc RPC/explorer plus signed transactions.

## License

MIT
