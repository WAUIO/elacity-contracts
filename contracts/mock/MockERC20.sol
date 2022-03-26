// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../library/IERC20Wrappable.sol";

contract MockERC20 is ERC20 {
    constructor(
        string memory name,
        string memory symbol,
        uint256 supply
    ) public ERC20(name, symbol) {
        _mint(msg.sender, supply);
    }

    function mint(address _to, uint256 _amount) public {
        _mint(_to, _amount);
    }
}

// grabbed from wELA codes, similar to wETH
// https://eth.elastos.io/address/0x517E9e5d46C1EA8aB6f78677d6114Ef47F71f6c4/contracts
contract WETH9 {
    string public name = "Wrapped Token";
    string public symbol = "WTOK";
    uint8 public decimals = 18;

    event Approval(address indexed src, address indexed guy, uint256 wad);
    event Transfer(address indexed src, address indexed dst, uint256 wad);
    event Deposit(address indexed dst, uint256 wad);
    event Withdrawal(address indexed src, uint256 wad);

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function deposit() public payable {
        balanceOf[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 wad) public {
        require(
            balanceOf[msg.sender] >= wad,
            "WETH.withdraw: insufficient balance"
        );
        balanceOf[msg.sender] -= wad;

        // msg.sender.transfer(wad);
        emit Withdrawal(msg.sender, wad);

        // bool success;
        // bytes memory returnedValue;

        // (success, returnedValue) = payable(msg.sender).call{value: wad}("");
        // if (success) {
        //     emit Withdrawal(msg.sender, wad);
        // } else {
        //     assembly {
        //         returnedValue := add(returnedValue, 0x04)
        //     }

        //     string memory revertReason = abi.decode(returnedValue, (string));
        //     revert(revertReason);
        // }
    }

    function totalSupply() public view returns (uint256) {
        return address(this).balance;
    }

    function approve(address guy, uint256 wad) public returns (bool) {
        allowance[msg.sender][guy] = wad;
        emit Approval(msg.sender, guy, wad);
        return true;
    }

    function transfer(address dst, uint256 wad) public returns (bool) {
        return transferFrom(msg.sender, dst, wad);
    }

    function transferFrom(
        address src,
        address dst,
        uint256 wad
    ) public returns (bool) {
        require(
            balanceOf[src] >= wad,
            "WETH.transferFrom: insufficient balance"
        );

        if (src != msg.sender && allowance[src][msg.sender] != uint256(-1)) {
            require(allowance[src][msg.sender] >= wad, "WETH: under allowance");
            allowance[src][msg.sender] -= wad;
        }

        balanceOf[src] -= wad;
        balanceOf[dst] += wad;

        emit Transfer(src, dst, wad);

        return true;
    }
}
