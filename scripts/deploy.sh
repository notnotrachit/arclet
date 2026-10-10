#!/usr/bin/env bash
# Deploys GroupWalletFactory to Arc, verifies it on the Arc explorer (Blockscout), and syncs the
# address + ABIs into the app.  Usage: scripts/deploy.sh testnet|mainnet
set -euo pipefail

NETWORK="${1:-testnet}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FORGE="${ARC_FORGE:-$HOME/.local/bin/arc-forge}"

case "$NETWORK" in
  testnet) RPC="https://rpc.testnet.arc.io"; VERIFIER_URL="https://explorer.testnet.arc.io/api/" ;;
  mainnet) RPC="https://rpc.mainnet.arc.io"; VERIFIER_URL="https://explorer.arc.io/api/" ;;
  *) echo "usage: $0 testnet|mainnet" >&2; exit 1 ;;
esac

cd "$ROOT/contracts"
set -a; source .env; set +a
: "${DEPLOYER_PRIVATE_KEY:?Set DEPLOYER_PRIVATE_KEY in contracts/.env}"

if [[ "$NETWORK" == "mainnet" ]]; then
  read -r -p "Deploy to Arc MAINNET with ${DEPLOYER_ADDRESS:-the configured key}? Type 'mainnet' to continue: " ok
  [[ "$ok" == "mainnet" ]] || { echo "aborted"; exit 1; }
fi

"$FORGE" test
"$FORGE" script script/Deploy.s.sol:Deploy \
  --rpc-url "$RPC" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --broadcast \
  --verify --verifier blockscout --verifier-url "$VERIFIER_URL" \
  || {
    echo "Deploy or verification failed. If only verification failed, the broadcast still landed; re-run verification with arc-forge verify-contract." >&2
  }

node "$ROOT/scripts/sync-contracts.mjs"
