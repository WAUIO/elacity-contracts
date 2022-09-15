// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

contract ElacityMulticall {
    struct Call {
        address target;
        bytes data;
    }

    /**
     * method that check wether an address is a contract or not
     */
    function _isContract(address addr) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(addr)
        }
        return size > 0;
    }

    /**
     * @notice call a set of contract methods and arguments sequentially in view mode
     */
    function multistaticcall(Call[] calldata calls)
        external
        view
        returns (bytes[] memory returnData)
    {
        returnData = new bytes[](calls.length);

        for (uint256 i = 0; i < calls.length; i++) {
            (bool success, bytes memory ret) = calls[i].target.staticcall(
                calls[i].data
            );
            require(success);
            returnData[i] = ret;
        }
    }

    /**
     * @notice call a set of contract methods and arguments sequentially
     */
    function multicall(Call[] calldata calls)
        external
        returns (bytes[] memory returnData)
    {
        returnData = new bytes[](calls.length);

        for (uint256 i = 0; i < calls.length; i++) {
            (bool success, bytes memory ret) = calls[i].target.call(
                calls[i].data
            );
            require(success);
            returnData[i] = ret;
        }
    }

    // https://github.com/InstaDApp/dsa-contracts/blob/7e70b926cb33263783f621612157f49f785daa0a/contracts/account.sol#L91
    function _delegateCall(address _target, bytes memory _data)
        internal
        returns (bool)
    {
        require(_isContract(_target), "invalid target");
        assembly {
            let succeeded := delegatecall(
                gas(),
                _target,
                add(_data, 0x20),
                mload(_data),
                0,
                0
            )

            returndatacopy(0, 0, returndatasize())
            switch succeeded
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    // @dev: get selector from call raw argument
    function _getSelector(bytes memory rawData)
        internal
        pure
        returns (bytes4 selector)
    {
        assembly {
            selector := mload(add(rawData, 32))
        }
    }
}
