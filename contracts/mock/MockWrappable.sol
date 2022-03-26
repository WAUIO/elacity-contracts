// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../library/ERC20WrappableSupport.sol";

contract TestWrap is Ownable, ERC20WrappableSupport {
    address payable public wToken;

    function pay() external payable {
        require(_bundleWrap(wToken), "failed to bundle actions");
    }

    function refundMe(uint256 amount) external {
        require(_unwrap(wToken, amount), "failed to withdraw");
    }

    function setWToken(address _wToken) public onlyOwner {
        wToken = payable(_wToken);
    }
}
