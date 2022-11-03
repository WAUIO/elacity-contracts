// SPDX-License-Identifier: MIT
pragma solidity >=0.6.12;

pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract FiatToken is
    Initializable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    PausableUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    uint8 private _decimals = 6;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __ERC20_init("USD Coin - Elacity Impl", "USDC");
        __ERC20Burnable_init();
        __Pausable_init();
        __Ownable_init();
        __UUPSUpgradeable_init();
        _decimals = 6;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyOwner
    {}

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
}
