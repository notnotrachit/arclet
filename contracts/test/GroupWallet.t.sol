// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {GroupWallet} from "../src/GroupWallet.sol";
import {GroupWalletFactory} from "../src/GroupWalletFactory.sol";

/// @dev 6-decimal stand-in for Arc's USDC ERC-20 interface.
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract GroupWalletTest is Test {
    MockUSDC usdc;
    GroupWalletFactory factory;
    GroupWallet group;

    address alice = makeAddr("alice"); // creator / admin
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address dave = makeAddr("dave"); // outsider
    address shop = makeAddr("shop");

    uint256 constant USDC = 1e6;

    function setUp() public {
        usdc = new MockUSDC();
        factory = new GroupWalletFactory(usdc);

        address[] memory initial = new address[](2);
        initial[0] = bob;
        initial[1] = carol;
        vm.prank(alice);
        group = GroupWallet(factory.createGroup("Goa Trip", initial, 50 * USDC));

        address[4] memory people = [alice, bob, carol, dave];
        for (uint256 i = 0; i < people.length; i++) {
            usdc.mint(people[i], 1_000 * USDC);
            vm.prank(people[i]);
            usdc.approve(address(group), type(uint256).max);
        }
    }

    // ------------------------------------------------------------------ setup / factory

    function test_CreateGroupSetsMembersAndIndex() public view {
        assertEq(group.name(), "Goa Trip");
        assertEq(group.memberCount(), 3);
        assertTrue(group.isAdmin(alice));
        assertFalse(group.isAdmin(bob));
        assertTrue(factory.isGroup(address(group)));
        assertEq(factory.groupsOf(bob)[0], address(group));
        assertEq(factory.groupCount(), 1);
        assertEq(group.memberSpendLimit(), 50 * USDC);
    }

    function test_CreateGroupToleratesDuplicateMembers() public {
        address[] memory initial = new address[](3);
        initial[0] = bob;
        initial[1] = bob;
        initial[2] = alice;
        vm.prank(alice);
        GroupWallet g = GroupWallet(factory.createGroup("Dupes", initial, 0));
        assertEq(g.memberCount(), 2);
        assertEq(factory.groupsOf(bob).length, 2);
    }

    function test_RevertWhen_EmptyName() public {
        vm.expectRevert(GroupWallet.InvalidName.selector);
        factory.createGroup("", new address[](0), 0);
    }

    function test_RevertWhen_OnMemberAddedFromNonGroup() public {
        vm.expectRevert(GroupWalletFactory.UnknownGroup.selector);
        factory.onMemberAdded(dave);
    }

    // ------------------------------------------------------------------ pool

    function test_DepositTracksContribution() public {
        vm.expectEmit(true, false, false, true, address(group));
        emit GroupWallet.Deposited(bob, 100 * USDC, "my share");
        vm.prank(bob);
        group.deposit(100 * USDC, "my share");

        assertEq(group.balance(), 100 * USDC);
        assertEq(group.memberInfo(bob).contributed, 100 * USDC);
    }

    function test_RevertWhen_OutsiderDeposits() public {
        vm.prank(dave);
        vm.expectRevert(GroupWallet.NotMember.selector);
        group.deposit(1 * USDC, "");
    }

    function test_MemberPaysWithinLimit() public {
        vm.prank(bob);
        group.deposit(200 * USDC, "");

        vm.expectEmit(true, true, false, true, address(group));
        emit GroupWallet.Paid(carol, shop, 40 * USDC, "dinner");
        vm.prank(carol);
        group.pay(shop, 40 * USDC, "dinner");

        assertEq(usdc.balanceOf(shop), 40 * USDC);
        assertEq(group.memberInfo(carol).spent, 40 * USDC);
        assertEq(group.balance(), 160 * USDC);
    }

    function test_RevertWhen_MemberExceedsLimit() public {
        vm.prank(bob);
        group.deposit(200 * USDC, "");
        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(GroupWallet.OverSpendLimit.selector, 50 * USDC));
        group.pay(shop, 51 * USDC, "");
    }

    function test_AdminIgnoresLimit_AndZeroLimitIsUnlimited() public {
        vm.prank(bob);
        group.deposit(300 * USDC, "");
        vm.prank(alice);
        group.pay(shop, 100 * USDC, "hotel");

        vm.prank(alice);
        group.setMemberSpendLimit(0);
        vm.prank(carol);
        group.pay(shop, 150 * USDC, "boat");
        assertEq(usdc.balanceOf(shop), 250 * USDC);
    }

    function test_RevertWhen_PayToZeroOrSelf() public {
        vm.prank(bob);
        group.deposit(10 * USDC, "");
        vm.startPrank(alice);
        vm.expectRevert(GroupWallet.InvalidAddress.selector);
        group.pay(address(0), 1 * USDC, "");
        vm.expectRevert(GroupWallet.InvalidAddress.selector);
        group.pay(address(group), 1 * USDC, "");
        vm.stopPrank();
    }

    function test_RevertWhen_NoteTooLong() public {
        bytes memory long = new bytes(281);
        vm.prank(bob);
        vm.expectRevert(GroupWallet.NoteTooLong.selector);
        group.deposit(1 * USDC, string(long));
    }

    // ------------------------------------------------------------------ splits

    function _three() internal view returns (address[] memory p) {
        p = new address[](3);
        p[0] = alice;
        p[1] = bob;
        p[2] = carol;
    }

    function test_EqualSplitWithRemainder() public {
        // 100.000001 USDC split 3 ways: 33.333334 / 33.333334 / 33.333333
        uint256 amount = 100 * USDC + 1;
        vm.prank(alice);
        uint256 id = group.addExpense(alice, amount, _three(), new uint256[](0), "villa");

        assertEq(id, 1);
        assertEq(group.memberInfo(alice).net, int256(amount) - 33_333_334);
        assertEq(group.memberInfo(bob).net, -33_333_334);
        assertEq(group.memberInfo(carol).net, -33_333_333);
        _assertLedgerBalanced();
    }

    function test_CustomShares() public {
        uint256[] memory shares = new uint256[](3);
        shares[0] = 10 * USDC;
        shares[1] = 20 * USDC;
        shares[2] = 30 * USDC;
        vm.prank(bob);
        group.addExpense(bob, 60 * USDC, _three(), shares, "groceries");

        assertEq(group.memberInfo(bob).net, int256(40 * USDC));
        assertEq(group.memberInfo(alice).net, -int256(10 * USDC));
        assertEq(group.memberInfo(carol).net, -int256(30 * USDC));
    }

    function test_RevertWhen_SharesDontSum() public {
        uint256[] memory shares = new uint256[](3);
        shares[0] = 10 * USDC;
        vm.prank(bob);
        vm.expectRevert(GroupWallet.SharesMismatch.selector);
        group.addExpense(bob, 60 * USDC, _three(), shares, "");
    }

    function test_RevertWhen_ParticipantIsOutsiderOrDuplicate() public {
        address[] memory p = new address[](2);
        p[0] = bob;
        p[1] = dave;
        vm.prank(bob);
        vm.expectRevert(GroupWallet.InvalidParticipants.selector);
        group.addExpense(bob, 10 * USDC, p, new uint256[](0), "");

        p[1] = bob;
        vm.prank(bob);
        vm.expectRevert(GroupWallet.InvalidParticipants.selector);
        group.addExpense(bob, 10 * USDC, p, new uint256[](0), "");
    }

    function test_RevertWhen_MemberRecordsExpenseForSomeoneElse() public {
        vm.prank(bob);
        vm.expectRevert(GroupWallet.NotAuthorized.selector);
        group.addExpense(carol, 10 * USDC, _three(), new uint256[](0), "");

        // admins may record on behalf of others
        vm.prank(alice);
        group.addExpense(carol, 9 * USDC, _three(), new uint256[](0), "");
        assertEq(group.memberInfo(carol).net, int256(6 * USDC));
    }

    function test_SettleTransfersAndClearsDebt() public {
        vm.prank(alice);
        group.addExpense(alice, 90 * USDC, _three(), new uint256[](0), "villa");

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.expectEmit(true, true, false, true, address(group));
        emit GroupWallet.Settled(bob, alice, 30 * USDC, false, "thanks!");
        vm.prank(bob);
        group.settle(alice, 30 * USDC, "thanks!");

        assertEq(usdc.balanceOf(alice) - aliceBefore, 30 * USDC);
        assertEq(group.memberInfo(bob).net, 0);
        assertEq(group.memberInfo(alice).net, int256(30 * USDC));
        _assertLedgerBalanced();
    }

    function test_RevertWhen_SettleMoreThanOwed() public {
        vm.prank(alice);
        group.addExpense(alice, 90 * USDC, _three(), new uint256[](0), "");
        vm.prank(bob);
        vm.expectRevert(GroupWallet.SettlementTooLarge.selector);
        group.settle(alice, 31 * USDC, "");

        // carol is owed nothing, so bob can't "settle" with carol
        vm.prank(bob);
        vm.expectRevert(GroupWallet.SettlementTooLarge.selector);
        group.settle(carol, 1 * USDC, "");
    }

    function test_CreditorRecordsCashSettlement() public {
        vm.prank(alice);
        group.addExpense(alice, 90 * USDC, _three(), new uint256[](0), "");
        uint256 bobBefore = usdc.balanceOf(bob);

        vm.prank(alice);
        group.recordOffchainSettlement(bob, 30 * USDC, "paid cash");

        assertEq(group.memberInfo(bob).net, 0);
        assertEq(usdc.balanceOf(bob), bobBefore); // no token movement
    }

    // ------------------------------------------------------------------ membership

    function test_AddMemberIndexesInFactory_NoDuplicateOnReAdd() public {
        vm.prank(alice);
        group.addMember(dave);
        assertTrue(group.isMember(dave));
        assertEq(factory.groupsOf(dave).length, 1);

        vm.prank(dave);
        group.removeMember(dave); // leave
        assertFalse(group.isMember(dave));

        vm.prank(alice);
        group.addMember(dave);
        assertEq(factory.groupsOf(dave).length, 1);
        (address[] memory accounts,) = group.members();
        assertEq(accounts.length, 4);
    }

    function test_RevertWhen_NonAdminAddsMember() public {
        vm.prank(bob);
        vm.expectRevert(GroupWallet.NotAdmin.selector);
        group.addMember(dave);
    }

    function test_RevertWhen_RemovingMemberWithOpenBalance() public {
        vm.prank(alice);
        group.addExpense(alice, 90 * USDC, _three(), new uint256[](0), "");
        vm.prank(alice);
        vm.expectRevert(GroupWallet.OutstandingBalance.selector);
        group.removeMember(bob);
    }

    function test_RevertWhen_RemovingLastAdmin() public {
        vm.prank(alice);
        vm.expectRevert(GroupWallet.LastAdmin.selector);
        group.removeMember(alice);

        vm.prank(alice);
        vm.expectRevert(GroupWallet.LastAdmin.selector);
        group.setAdmin(alice, false);
    }

    function test_AdminHandoff() public {
        vm.startPrank(alice);
        group.setAdmin(bob, true);
        group.removeMember(alice);
        vm.stopPrank();
        assertEq(group.adminCount(), 1);
        assertTrue(group.isAdmin(bob));
        assertFalse(group.isMember(alice));
    }

    function test_RevertWhen_PlainNativeSendToGroup() public {
        vm.deal(dave, 1 ether);
        vm.prank(dave);
        (bool ok,) = address(group).call{value: 1}("");
        assertFalse(ok);
    }

    // ------------------------------------------------------------------ fuzz

    function testFuzz_LedgerAlwaysNetsToZero(uint96[5] memory amounts, uint8[5] memory payers) public {
        address[3] memory people = [alice, bob, carol];
        for (uint256 i = 0; i < amounts.length; i++) {
            uint256 amount = bound(uint256(amounts[i]), 1, 1_000_000 * USDC);
            address payer = people[payers[i] % 3];
            vm.prank(payer);
            group.addExpense(payer, amount, _three(), new uint256[](0), "");
        }
        _assertLedgerBalanced();
    }

    function _assertLedgerBalanced() internal view {
        (, GroupWallet.Member[] memory info) = group.members();
        int256 sum;
        for (uint256 i = 0; i < info.length; i++) {
            sum += info[i].net;
        }
        assertEq(sum, 0);
    }
}
