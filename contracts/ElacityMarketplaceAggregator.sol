// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./ElacityMulticall.sol";

interface INFTContract {
    function mint(address _beneficiary, string calldata _tokenUri)
        external
        payable
        returns (uint256);

    function isApprovedForAll(address _owner, address _operator)
        external
        view
        returns (bool isOperator);

    function setApprovalForAll(address _operator, bool approved) external;

    function totalSupply() external view returns (uint256);
}

interface IMarketplace {
    function pipeRegisterRoyalty(
        address _nftAddress,
        uint256 _tokenId,
        uint16 _royalty
    ) external;

    function pipeListItem(
        address _nftAddress,
        uint256 _tokenId,
        uint256 _quantity,
        address _payToken,
        uint256 _pricePerItem,
        uint256 _startingTime
    ) external;
}

interface IFactory {
    function exists(address) external view returns (bool);
}

interface IAuction {
    function pipeCreateAuction(
        address _nftAddress,
        uint256 _tokenId,
        address _payToken,
        uint256 _reservePrice,
        uint256 _startTimestamp,
        bool minBidReserve,
        uint256 _endTimestamp
    ) external;

    function pipeUpdateAuctionReservePrice(
        address _nftAddress,
        uint256 _tokenId,
        uint256 _reservePrice
    ) external;

    function pipeUpdateAuctionStartTime(
        address _nftAddress,
        uint256 _tokenId,
        uint256 _startTime
    ) external;

    function pipeUpdateAuctionEndTime(
        address _nftAddress,
        uint256 _tokenId,
        uint256 _endTimestamp
    ) external;
}

interface IAddressRegistry {
    function artion() external view returns (address);

    function marketplace() external view returns (address);

    function auction() external view returns (address);

    function factory() external view returns (address);

    function privateFactory() external view returns (address);

    function artFactory() external view returns (address);

    function privateArtFactory() external view returns (address);
}

contract ElacityMarketplaceAggregator is
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    ElacityMulticall
{
    //bytes4 private constant SELECTOR_LIST_ITEM = 0x3fc1cc26;
    bytes4 private constant SELECTOR_LIST_ITEM = 0x035f3ebb;
    //bytes4 private constant SELECTOR_CREATE_AUCTION = 0xab2870e2;
    bytes4 private constant SELECTOR_CREATE_AUCTION = 0xc86b1af7;
    //bytes4 private constant SELECTOR_REGISTER_ROYALTY = 0xf3880b6e;
    bytes4 private constant SELECTOR_REGISTER_ROYALTY = 0x64070ca7;

    /// @notice Address registry
    IAddressRegistry public addressRegistry;

    event Warning(address addr, string message);

    /// @notice Contract initializer
    function initialize(address _addressRegistry) public initializer {
        addressRegistry = IAddressRegistry(_addressRegistry);

        __Ownable_init();
        __ReentrancyGuard_init();
    }

    /// @notice Check whether an address is supported
    function _isValidAddress(address addr) internal view returns (bool) {
        return
            addressRegistry.artion() == addr ||
            addressRegistry.marketplace() == addr ||
            addressRegistry.auction() == addr ||
            IFactory(addressRegistry.factory()).exists(addr) ||
            IFactory(addressRegistry.privateFactory()).exists(addr) ||
            IFactory(addressRegistry.artFactory()).exists(addr) ||
            IFactory(addressRegistry.privateArtFactory()).exists(addr);
    }

    /// @notice Check whether an address is a valid NFT contract address
    function _isValidNFTAddress(address addr) internal view returns (bool) {
        return
            addressRegistry.artion() == addr ||
            IFactory(addressRegistry.factory()).exists(addr) ||
            IFactory(addressRegistry.privateFactory()).exists(addr) ||
            IFactory(addressRegistry.artFactory()).exists(addr) ||
            IFactory(addressRegistry.privateArtFactory()).exists(addr);
    }

    function _requireApproval(
        address _nftAddress,
        address _owner,
        address _operator
    ) internal view {
        require(
            INFTContract(_nftAddress).isApprovedForAll(_owner, _operator),
            "sender is not approved for target"
        );
    }

    /**
     * @dev Mint and pipe another actions to the ElacityMulticall contract
     * @dev Note that when we send data into pipe call, we injected _tokenId as a placeholder
     * @dev So we need to parse the data and replace the placeholder with the real tokenId outputed by the mint function
     * @dev https://github.com/ethereum/solidity/issues/10382
     * @dev see also https://stackoverflow.com/questions/70693335/delegatecall-for-multi-transaction-for-minting-approving-and-putting-on-a-marke
     */
    function mintAndPipe(
        address _nftAddress,
        string calldata _tokenUri,
        Call[] calldata calls
    ) external payable returns (uint256 tokenId) {
        // verify _nftAddress is ERC721 contract and is supported in the platform
        require(_isValidNFTAddress(_nftAddress), "invalid NFT address");

        (bool minted, ) = payable(_nftAddress).call{value: msg.value}(
            abi.encodeWithSelector(
                INFTContract(_nftAddress).mint.selector,
                _msgSender(),
                _tokenUri
            )
        );
        require(minted, "Failed to mint token");

        // no need it here anymore as there is no way to get it accurately
        // instead, it should be set in calldata of the pipeline calls
        // tokenId = INFTContract(_nftAddress).totalSupply();

        // now we will setup pipeline according to request
        // 1. register royalty
        // 2. list item OR create auction

        for (uint256 i = 0; i < calls.length; i++) {
            // only proceed when target address are trusted, otherwise we will skip and emit a warning
            if (_isValidAddress(calls[i].target)) {
                // for each calls parameter we will retrieve the method ID and arguments passed in
                bytes4 methodId = _getSelector(calls[i].data);
                if (
                    methodId == SELECTOR_REGISTER_ROYALTY &&
                    calls[i].target == addressRegistry.marketplace()
                ) {
                    // 1. register royalty
                    (
                        address nftAddress,
                        uint256 _tokenId,
                        uint16 royaltyValue
                    ) = abi.decode(
                            calls[i].data[4:],
                            (address, uint256, uint16)
                        );
                    if (royaltyValue > 0) {
                        // only process royalty registration when its value is greater than 0
                        tokenId = _tokenId;
                        IMarketplace(addressRegistry.marketplace())
                            .pipeRegisterRoyalty(
                                nftAddress,
                                tokenId,
                                royaltyValue
                            );
                    }
                } else if (
                    methodId == SELECTOR_CREATE_AUCTION &&
                    calls[i].target == addressRegistry.auction()
                ) {
                    // 2. create auction
                    _requireApproval(
                        _nftAddress,
                        _msgSender(),
                        calls[i].target
                    );
                    (
                        address nftAddress,
                        uint256 _tokenId,
                        address payToken,
                        uint256 pricePerItem,
                        uint256 startTime,
                        bool minBidReserve,
                        uint256 endTime
                    ) = abi.decode(
                            calls[i].data[4:],
                            (
                                address,
                                uint256,
                                address,
                                uint256,
                                uint256,
                                bool,
                                uint256
                            )
                        );
                    tokenId = _tokenId;
                    IAuction(addressRegistry.auction()).pipeCreateAuction(
                        nftAddress,
                        tokenId,
                        payToken,
                        pricePerItem,
                        startTime,
                        minBidReserve,
                        endTime
                    );
                } else if (
                    methodId == SELECTOR_LIST_ITEM &&
                    calls[i].target == addressRegistry.marketplace()
                ) {
                    // 2. list item
                    _requireApproval(
                        _nftAddress,
                        _msgSender(),
                        calls[i].target
                    );
                    (
                        address nftAddress,
                        uint256 _tokenId,
                        uint256 qt,
                        address payToken,
                        uint256 pricePerItem,
                        uint256 startTime
                    ) = abi.decode(
                            calls[i].data[4:],
                            (
                                address,
                                uint256,
                                uint256,
                                address,
                                uint256,
                                uint256
                            )
                        );
                    tokenId = _tokenId;
                    IMarketplace(addressRegistry.marketplace()).pipeListItem(
                        nftAddress,
                        tokenId,
                        qt,
                        payToken,
                        pricePerItem,
                        startTime
                    );
                } else {
                    // make normal call as sent by the user
                    (bool ok, bytes memory returndata) = calls[i].target.call(
                        calls[i].data
                    );
                    if (!ok) {
                        if (returndata.length > 0) {
                            assembly {
                                let returndata_sz := mload(returndata)
                                revert(add(32, returndata), returndata_sz)
                            }
                        } else {
                            revert("Failed to call target");
                        }
                    }
                }
            } else {
                emit Warning(calls[i].target, "unknown address, skipped");
            }
        }
    }

    /**
     @notice Update FantomAddressRegistry contract
     @dev Only admin
     */
    function updateAddressRegistry(address _registry) external onlyOwner {
        addressRegistry = IAddressRegistry(_registry);
    }
}
