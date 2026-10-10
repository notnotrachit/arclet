// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, Vm} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {GroupWallet} from "../src/GroupWallet.sol";
import {GroupWalletFactory} from "../src/GroupWalletFactory.sol";

interface IMemo {
    function memo(address target, bytes calldata data, bytes32 memoId, bytes calldata memoData) external;
}

interface IMulticall3From {
    struct Call3 {
        address target;
        bool allowFailure;
        bytes callData;
    }

    struct Result {
        bool success;
        bytes returnData;
    }

    function aggregate3(Call3[] calldata calls) external returns (Result[] memory);
}

/// @notice Exercises the exact Arc predeploy flows the app relies on, against a fork of Arc Testnet.
/// Run with: arc-forge test --match-contract ArcForkTest --fork-url https://rpc.testnet.arc.io
/// Skipped automatically when not forking Arc.
contract ArcForkTest is Test {
    IERC20 constant USDC = IERC20(0x3600000000000000000000000000000000000000);
    IMemo constant MEMO = IMemo(0x5294E9927c3306DcBaDb03fe70b92e01cCede505);
    IMulticall3From constant MULTICALL3_FROM = IMulticall3From(0x522fAf9A91c41c443c66765030741e4AaCe147D0);
    address constant NATIVE_EMITTER = 0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE;
    bytes32 constant TRANSFER_TOPIC = keccak256("Transfer(address,address,uint256)");
    bytes32 constant MEMO_TOPIC = keccak256("Memo(address,address,bytes32,bytes32,bytes,uint256)");

    address alice = makeAddr("arclet-alice");
    address bob = makeAddr("arclet-bob");
    GroupWalletFactory factory;
    GroupWallet group;

    modifier onlyArc() {
        if (block.chainid != 5042002 && block.chainid != 5042) {
            vm.skip(true);
        }
        _;
    }

    function setUp() public {
        if (block.chainid != 5042002 && block.chainid != 5042) return;
        // Native USDC is 18 decimals; this gives alice 100 USDC (100e6 in the ERC-20 view).
        vm.deal(alice, 100 ether);
        factory = new GroupWalletFactory(USDC);
        address[] memory members = new address[](1);
        members[0] = bob;
        vm.prank(alice);
        group = GroupWallet(factory.createGroup("Fork Trip", members, 0));
    }

    function test_NativeAndErc20ViewsShareBalance() public onlyArc {
        assertEq(USDC.balanceOf(alice), 100e6);
        assertEq(alice.balance, 100 ether);
    }

    function test_MemoWrappedTransferKeepsSenderAndEmitsMemo() public onlyArc {
        bytes32 memoId = keccak256("arclet:test-ref");
        bytes memory transfer = abi.encodeCall(IERC20.transfer, (bob, 2_500000));

        vm.recordLogs();
        vm.prank(alice, alice);
        MEMO.memo(address(USDC), transfer, memoId, bytes("pizza"));

        assertEq(USDC.balanceOf(bob), 2_500000);
        assertEq(USDC.balanceOf(alice), 97_500000);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool sawMemo;
        bool sawNative;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(MEMO) && logs[i].topics[0] == MEMO_TOPIC) {
                assertEq(logs[i].topics[1], bytes32(uint256(uint160(alice)))); // sender preserved
                assertEq(logs[i].topics[3], memoId);
                sawMemo = true;
            }
            if (logs[i].emitter == NATIVE_EMITTER && logs[i].topics[0] == TRANSFER_TOPIC) {
                assertEq(logs[i].topics[1], bytes32(uint256(uint160(alice))));
                assertEq(abi.decode(logs[i].data, (uint256)), 2.5 ether); // 18-decimal native view
                sawNative = true;
            }
        }
        assertTrue(sawMemo, "Memo event");
        assertTrue(sawNative, "EIP-7708 native Transfer");
    }

    function test_Multicall3FromBatchesApproveAndDeposit() public onlyArc {
        IMulticall3From.Call3[] memory calls = new IMulticall3From.Call3[](2);
        calls[0] = IMulticall3From.Call3(address(USDC), false, abi.encodeCall(IERC20.approve, (address(group), 10e6)));
        calls[1] = IMulticall3From.Call3(address(group), false, abi.encodeCall(GroupWallet.deposit, (10e6, "my share")));

        vm.prank(alice, alice);
        MULTICALL3_FROM.aggregate3(calls);

        assertEq(group.balance(), 10e6);
        assertEq(group.memberInfo(alice).contributed, 10e6);
    }

    function test_MemoWrappedGroupPayAttributesMember() public onlyArc {
        vm.startPrank(alice, alice);
        USDC.approve(address(group), 20e6);
        group.deposit(20e6, "");
        bytes memory pay = abi.encodeCall(GroupWallet.pay, (bob, 3e6, "taxi"));
        MEMO.memo(address(group), pay, keccak256("arclet:group-ref"), bytes("taxi"));
        vm.stopPrank();

        assertEq(USDC.balanceOf(bob), 3e6);
        assertEq(group.memberInfo(alice).spent, 3e6);
    }

    function test_PlainNativeSendToGroupReverts() public onlyArc {
        vm.prank(alice);
        (bool ok,) = address(group).call{value: 1 ether}("");
        assertFalse(ok);
    }
}
