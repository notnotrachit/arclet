// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {GroupWalletFactory} from "../src/GroupWalletFactory.sol";

/// @notice Deploys GroupWalletFactory against Arc's USDC ERC-20 interface (same address on testnet and mainnet).
contract Deploy is Script {
    address constant ARC_USDC = 0x3600000000000000000000000000000000000000;

    function run() external returns (GroupWalletFactory factory) {
        vm.startBroadcast();
        factory = new GroupWalletFactory(IERC20(ARC_USDC));
        vm.stopBroadcast();
        console2.log("GroupWalletFactory:", address(factory));
    }
}
