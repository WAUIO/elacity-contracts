// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IERC20Wrappable is IERC20 {
    function deposit() external payable;

    function withdraw(uint256 wad) external;
}
