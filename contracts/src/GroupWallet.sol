// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// @notice Callback surface the factory exposes so groups can index new members for discovery.
interface IGroupRegistry {
    function onMemberAdded(address member) external;
}

/// @title GroupWallet
/// @notice A shared USDC wallet for a small group on Arc, plus a Splitwise-style expense ledger.
///
/// Two independent features live in one contract:
///  1. Pool: members deposit USDC into the contract and can pay anyone from the pooled balance.
///     Every deposit and payment carries a plain-text note, so the group sees who paid what.
///  2. Splits: members record expenses they paid personally. The contract tracks each member's
///     net position (positive = is owed, negative = owes) and lets debtors settle in USDC directly
///     to creditors, or lets a creditor acknowledge an offchain (cash) settlement.
///
/// Arc notes:
///  - Uses the USDC ERC-20 interface (6 decimals). On Arc this shares one balance with native USDC.
///  - The contract has no receive/fallback, so plain native sends to it revert by design; use deposit().
///  - Notes are stored in events only and are public onchain.
contract GroupWallet is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    uint256 public constant MAX_MEMBERS = 50;
    uint256 public constant MAX_NOTE_BYTES = 280;
    uint256 public constant MAX_NAME_BYTES = 64;

    struct Member {
        bool active;
        bool admin;
        uint256 contributed; // total deposited into the pool
        uint256 spent; // total paid out of the pool by this member
        int256 net; // split ledger: >0 is owed money, <0 owes money
    }

    IERC20 public immutable usdc;
    IGroupRegistry public immutable registry;
    /// @notice Lets clients start event scans at the group's creation instead of genesis.
    uint256 public immutable createdAtBlock;
    string public name;

    /// @notice Max amount a non-admin member can pay from the pool per transaction. 0 = unlimited.
    uint256 public memberSpendLimit;
    uint256 public memberCount;
    uint256 public adminCount;
    uint256 public expenseCount;

    mapping(address => Member) private _members;
    mapping(address => bool) private _listed;
    address[] private _memberList;

    event Deposited(address indexed member, uint256 amount, string note);
    event Paid(address indexed member, address indexed to, uint256 amount, string note);
    event ExpenseAdded(
        uint256 indexed id,
        address indexed paidBy,
        address indexed createdBy,
        uint256 amount,
        address[] participants,
        uint256[] shares,
        string note
    );
    event Settled(address indexed debtor, address indexed creditor, uint256 amount, bool offchain, string note);
    event MemberAdded(address indexed member, address indexed by);
    event MemberRemoved(address indexed member, address indexed by);
    event AdminUpdated(address indexed member, bool isAdmin);
    event SpendLimitUpdated(uint256 limit);

    error NotMember();
    error NotAdmin();
    error ZeroAmount();
    error InvalidAddress();
    error NoteTooLong();
    error InvalidName();
    error TooManyMembers();
    error AlreadyMember();
    error OverSpendLimit(uint256 limit);
    error NotAuthorized();
    error InvalidParticipants();
    error SharesMismatch();
    error SettlementTooLarge();
    error OutstandingBalance();
    error LastAdmin();

    modifier onlyMember() {
        if (!_members[msg.sender].active) revert NotMember();
        _;
    }

    modifier onlyAdmin() {
        if (!_members[msg.sender].admin) revert NotAdmin();
        _;
    }

    modifier validNote(string calldata note) {
        if (bytes(note).length > MAX_NOTE_BYTES) revert NoteTooLong();
        _;
    }

    /// @dev Deployed by GroupWalletFactory. The factory indexes the initial members after deployment.
    constructor(
        IERC20 usdc_,
        string memory name_,
        address creator,
        address[] memory initialMembers,
        uint256 memberSpendLimit_
    ) {
        uint256 nameLen = bytes(name_).length;
        if (nameLen == 0 || nameLen > MAX_NAME_BYTES) revert InvalidName();
        if (address(usdc_) == address(0) || creator == address(0)) revert InvalidAddress();

        usdc = usdc_;
        registry = IGroupRegistry(msg.sender);
        createdAtBlock = block.number;
        name = name_;
        memberSpendLimit = memberSpendLimit_;

        _addMember(creator, creator);
        _members[creator].admin = true;
        adminCount = 1;
        emit AdminUpdated(creator, true);

        for (uint256 i = 0; i < initialMembers.length; i++) {
            address m = initialMembers[i];
            if (m == creator || _members[m].active) continue; // tolerate duplicates in input
            _addMember(m, creator);
        }
        emit SpendLimitUpdated(memberSpendLimit_);
    }

    // ---------------------------------------------------------------------
    // Pool
    // ---------------------------------------------------------------------

    /// @notice Move USDC from the caller into the group pool. Requires a prior USDC approval.
    function deposit(uint256 amount, string calldata note) external onlyMember validNote(note) nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _members[msg.sender].contributed += amount;
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount, note);
    }

    /// @notice Pay anyone from the group pool.
    function pay(address to, uint256 amount, string calldata note)
        external
        onlyMember
        validNote(note)
        nonReentrant
    {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0) || to == address(this)) revert InvalidAddress();
        Member storage m = _members[msg.sender];
        uint256 limit = memberSpendLimit;
        if (!m.admin && limit != 0 && amount > limit) revert OverSpendLimit(limit);
        m.spent += amount;
        usdc.safeTransfer(to, amount);
        emit Paid(msg.sender, to, amount, note);
    }

    // ---------------------------------------------------------------------
    // Splits
    // ---------------------------------------------------------------------

    /// @notice Record an expense that `paidBy` paid personally, split across `participants`.
    /// @param shares Empty for an equal split (remainder units go to the first participants),
    ///        or one entry per participant summing exactly to `amount`.
    /// @dev Only the payer or an admin can record an expense on the payer's behalf.
    function addExpense(
        address paidBy,
        uint256 amount,
        address[] calldata participants,
        uint256[] calldata shares,
        string calldata note
    ) external onlyMember validNote(note) returns (uint256 id) {
        if (amount == 0) revert ZeroAmount();
        if (msg.sender != paidBy && !_members[msg.sender].admin) revert NotAuthorized();
        if (!_members[paidBy].active) revert NotMember();

        uint256[] memory finalShares = _debitParticipants(amount, participants, shares);
        _members[paidBy].net += amount.toInt256();

        id = ++expenseCount;
        emit ExpenseAdded(id, paidBy, msg.sender, amount, participants, finalShares, note);
    }

    /// @dev Validates participants, resolves each share, and debits it from the participant's net.
    function _debitParticipants(uint256 amount, address[] calldata participants, uint256[] calldata shares)
        private
        returns (uint256[] memory finalShares)
    {
        uint256 n = participants.length;
        if (n == 0 || n > MAX_MEMBERS) revert InvalidParticipants();
        bool equal = shares.length == 0;
        if (!equal && shares.length != n) revert SharesMismatch();

        finalShares = new uint256[](n);
        uint256 total;
        for (uint256 i = 0; i < n; i++) {
            address p = participants[i];
            if (!_members[p].active) revert InvalidParticipants();
            for (uint256 j = 0; j < i; j++) {
                if (participants[j] == p) revert InvalidParticipants();
            }
            // Equal split: remainder base units go to the first participants.
            uint256 share = equal ? amount / n + (i < amount % n ? 1 : 0) : shares[i];
            finalShares[i] = share;
            total += share;
            _members[p].net -= share.toInt256();
        }
        if (total != amount) revert SharesMismatch();
    }

    /// @notice Pay a creditor in USDC to reduce your debt. Requires a prior USDC approval.
    function settle(address creditor, uint256 amount, string calldata note)
        external
        onlyMember
        validNote(note)
        nonReentrant
    {
        _applySettlement(msg.sender, creditor, amount);
        usdc.safeTransferFrom(msg.sender, creditor, amount);
        emit Settled(msg.sender, creditor, amount, false, note);
    }

    /// @notice Creditor acknowledges they were repaid outside the contract (cash, bank, etc.).
    function recordOffchainSettlement(address debtor, uint256 amount, string calldata note)
        external
        onlyMember
        validNote(note)
    {
        _applySettlement(debtor, msg.sender, amount);
        emit Settled(debtor, msg.sender, amount, true, note);
    }

    function _applySettlement(address debtor, address creditor, uint256 amount) private {
        if (amount == 0) revert ZeroAmount();
        if (debtor == creditor) revert InvalidAddress();
        if (!_members[debtor].active || !_members[creditor].active) revert NotMember();
        int256 a = amount.toInt256();
        Member storage d = _members[debtor];
        Member storage c = _members[creditor];
        if (d.net > -a || c.net < a) revert SettlementTooLarge();
        d.net += a;
        c.net -= a;
    }

    // ---------------------------------------------------------------------
    // Membership
    // ---------------------------------------------------------------------

    function addMember(address member) external onlyAdmin {
        if (_members[member].active) revert AlreadyMember();
        _addMember(member, msg.sender);
        registry.onMemberAdded(member);
    }

    /// @notice Admins can remove anyone; members can remove themselves (leave).
    /// @dev A member with an open split balance can't be removed, so the ledger always nets to zero.
    function removeMember(address member) external {
        if (msg.sender != member && !_members[msg.sender].admin) revert NotAdmin();
        Member storage m = _members[member];
        if (!m.active) revert NotMember();
        if (m.net != 0) revert OutstandingBalance();
        if (m.admin) {
            if (adminCount == 1) revert LastAdmin();
            m.admin = false;
            adminCount--;
            emit AdminUpdated(member, false);
        }
        m.active = false;
        memberCount--;
        emit MemberRemoved(member, msg.sender);
    }

    function setAdmin(address member, bool isAdmin_) external onlyAdmin {
        Member storage m = _members[member];
        if (!m.active) revert NotMember();
        if (m.admin == isAdmin_) return;
        if (!isAdmin_ && adminCount == 1) revert LastAdmin();
        m.admin = isAdmin_;
        adminCount = isAdmin_ ? adminCount + 1 : adminCount - 1;
        emit AdminUpdated(member, isAdmin_);
    }

    function setMemberSpendLimit(uint256 limit) external onlyAdmin {
        memberSpendLimit = limit;
        emit SpendLimitUpdated(limit);
    }

    function _addMember(address member, address by) private {
        if (member == address(0) || member == address(this)) revert InvalidAddress();
        if (memberCount >= MAX_MEMBERS) revert TooManyMembers();
        Member storage m = _members[member];
        m.active = true;
        memberCount++;
        if (!_listed[member]) {
            _listed[member] = true;
            _memberList.push(member);
        }
        emit MemberAdded(member, by);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function balance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function isMember(address account) external view returns (bool) {
        return _members[account].active;
    }

    function isAdmin(address account) external view returns (bool) {
        return _members[account].admin;
    }

    function memberInfo(address account) external view returns (Member memory) {
        return _members[account];
    }

    /// @notice Active members and their state, in join order.
    function members() external view returns (address[] memory accounts, Member[] memory info) {
        accounts = new address[](memberCount);
        info = new Member[](memberCount);
        uint256 k;
        for (uint256 i = 0; i < _memberList.length; i++) {
            address a = _memberList[i];
            if (_members[a].active) {
                accounts[k] = a;
                info[k] = _members[a];
                k++;
            }
        }
    }
}
