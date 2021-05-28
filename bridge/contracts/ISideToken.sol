// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;

interface ISideToken {
    function mint(address account, uint256 amount, bytes calldata userData, bytes calldata operatorData) external;
}