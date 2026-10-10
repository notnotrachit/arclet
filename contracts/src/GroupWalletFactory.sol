// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {GroupWallet, IGroupRegistry} from "./GroupWallet.sol";

/// @title GroupWalletFactory
/// @notice Deploys GroupWallets and keeps a per-member index so apps can discover a user's groups
///         without scanning logs. The index is append-only; check GroupWallet.isMember() for status.
contract GroupWalletFactory is IGroupRegistry {
    IERC20 public immutable usdc;

    address[] private _allGroups;
    mapping(address => bool) public isGroup;
    mapping(address => address[]) private _groupsOf;
    mapping(address => mapping(address => bool)) private _indexed;

    event GroupCreated(address indexed group, address indexed creator, string name);
    event MemberIndexed(address indexed group, address indexed member);

    error UnknownGroup();

    constructor(IERC20 usdc_) {
        usdc = usdc_;
    }

    function createGroup(string calldata name, address[] calldata members, uint256 memberSpendLimit)
        external
        returns (address group)
    {
        GroupWallet g = new GroupWallet(usdc, name, msg.sender, members, memberSpendLimit);
        group = address(g);
        isGroup[group] = true;
        _allGroups.push(group);
        emit GroupCreated(group, msg.sender, name);

        _index(group, msg.sender);
        for (uint256 i = 0; i < members.length; i++) {
            _index(group, members[i]);
        }
    }

    /// @inheritdoc IGroupRegistry
    function onMemberAdded(address member) external {
        if (!isGroup[msg.sender]) revert UnknownGroup();
        _index(msg.sender, member);
    }

    function groupsOf(address member) external view returns (address[] memory) {
        return _groupsOf[member];
    }

    function groupCount() external view returns (uint256) {
        return _allGroups.length;
    }

    function groupAt(uint256 index) external view returns (address) {
        return _allGroups[index];
    }

    function _index(address group, address member) private {
        if (_indexed[group][member]) return;
        _indexed[group][member] = true;
        _groupsOf[member].push(group);
        emit MemberIndexed(group, member);
    }
}
