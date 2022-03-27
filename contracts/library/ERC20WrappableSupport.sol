// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IERC20Wrappable.sol";
import "./Revertable.sol";

contract ERC20WrappableSupport is Revertable {
    modifier withWrap(address payable wToken) {
        require(_bundleWrap(wToken), "failed to wrap");
        _;
    }

    modifier withUnwrap(address payable wToken, uint256 amount) {
        _;
        _unwrap(wToken, amount);
    }

    modifier _underlyingTokenRequired(address payable wToken) {
        require(wToken != address(0), "underlying token not set");
        _;
    }

    /// @dev execute wrap transaction along the process and transfer wETH into original msg.sender account
    function _bundleWrap(address payable wToken)
        internal
        _underlyingTokenRequired(wToken)
        returns (bool)
    {
        // Note:
        // There exists a special variant of a message `call`,
        // named `delegatecall` which is identical to a message call
        // apart from the fact that the code at the target address
        // is executed in the context of the calling contract
        // and msg.sender and msg.value do not change their values.
        (bool deposited, bytes memory rawReason) = wToken.call{
            value: msg.value
        }(abi.encodeWithSignature("deposit()"));

        if (!deposited) {
            revert(_getRevertReason(rawReason));
        }

        IERC20(wToken).transferFrom(address(this), msg.sender, msg.value);

        // @todo: figure out how to bundle this in this method
        // (bool approved, ) = wToken.call(
        //     abi.encodeWithSignature("approve(address,uint256)", this, msg.value)
        // );
        // require(approved, "failed to approve");
        return true;
    }

    function _unwrap(address payable wToken, uint256 wad)
        internal
        _underlyingTokenRequired(wToken)
        returns (bool)
    {
        // this statement needs an approval in prior
        // transfer fund from user account to the current contract
        require(
            IERC20(wToken).transferFrom(msg.sender, address(this), wad),
            "wERC20: failed to transfer to calling contract"
        );

        // here we will withdraw transfered wETH in the contract to ETH
        // then transfer it again to the recipient (msg.sender)
        // execution operated by this contract
        IERC20Wrappable(wToken).withdraw(wad);
        (bool withdrawn, bytes memory rawReason) = msg.sender.call{value: wad}(
            ""
        );

        if (!withdrawn) {
            revert(_getRevertReason(rawReason));
        }

        return withdrawn;
    }

    receive() external payable {}
}
