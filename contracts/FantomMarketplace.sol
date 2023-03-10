// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./library/ERC20WrappableSupport.sol";

interface IFantomAddressRegistry {
    function artion() external view returns (address);

    function bundleMarketplace() external view returns (address);

    function auction() external view returns (address);

    function factory() external view returns (address);

    function privateFactory() external view returns (address);

    function artFactory() external view returns (address);

    function privateArtFactory() external view returns (address);

    function tokenRegistry() external view returns (address);

    function priceFeed() external view returns (address);
}

interface IFantomAuction {
    function auctions(address, uint256)
        external
        view
        returns (
            address,
            address,
            uint256,
            uint256,
            uint256,
            bool
        );
}

interface IFantomBundleMarketplace {
    function validateItemSold(
        address,
        uint256,
        uint256
    ) external;
}

interface IFantomNFTFactory {
    function exists(address) external view returns (bool);
}

interface IFantomTokenRegistry {
    function enabled(address) external view returns (bool);
}

interface IFantomPriceFeed {
    function wFTM() external view returns (address);

    function getPrice(address) external view returns (int256, uint8);
}

contract FantomMarketplace is
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    ERC20WrappableSupport
{
    using SafeMath for uint256;
    using AddressUpgradeable for address payable;
    using SafeERC20 for IERC20;

    /// @notice Events for the contract
    event ItemListed(
        address indexed owner,
        address indexed nft,
        uint256 tokenId,
        uint256 quantity,
        address payToken,
        uint256 pricePerItem,
        uint256 startingTime
    );
    event ItemSold(
        address indexed seller,
        address indexed buyer,
        address indexed nft,
        uint256 tokenId,
        uint256 quantity,
        address payToken,
        int256 unitPrice,
        uint256 pricePerItem
    );
    event ItemUpdated(
        address indexed owner,
        address indexed nft,
        uint256 tokenId,
        address payToken,
        uint256 newPrice
    );
    event ItemCanceled(
        address indexed owner,
        address indexed nft,
        uint256 tokenId
    );
    event OfferCreated(
        address indexed creator,
        address indexed nft,
        uint256 tokenId,
        uint256 quantity,
        address payToken,
        uint256 pricePerItem,
        uint256 deadline
    );
    event OfferCanceled(
        address indexed creator,
        address indexed nft,
        uint256 tokenId
    );
    event UpdatePlatformFee(uint16 platformFee);
    event UpdatePlatformFeeRecipient(address payable platformFeeRecipient);

    /// @notice Structure for listed items
    struct Listing {
        uint256 quantity;
        address payToken;
        uint256 pricePerItem;
        uint256 startingTime;
    }

    /// @notice Structure for offer
    struct Offer {
        IERC20 payToken;
        uint256 quantity;
        uint256 pricePerItem;
        uint256 deadline;
    }

    struct CollectionRoyalty {
        uint16 royalty;
        address creator;
        address feeRecipient;
    }

    bytes4 private constant INTERFACE_ID_ERC721 = 0x80ac58cd;
    bytes4 private constant INTERFACE_ID_ERC1155 = 0xd9b67a26;

    /// @notice NftAddress -> Token ID -> Minter
    mapping(address => mapping(uint256 => address)) public minters;

    /// @notice NftAddress -> Token ID -> Royalty
    mapping(address => mapping(uint256 => uint16)) public royalties;

    /// @notice NftAddress -> Token ID -> Owner -> Listing item
    mapping(address => mapping(uint256 => mapping(address => Listing)))
        public listings;

    /// @notice NftAddress -> Token ID -> Offerer -> Offer
    mapping(address => mapping(uint256 => mapping(address => Offer)))
        public offers;

    /// @notice Platform fee
    uint16 public platformFee;

    /// @notice Platform fee receipient
    address payable public feeReceipient;

    /// @notice NftAddress -> Royalty
    mapping(address => CollectionRoyalty) public collectionRoyalties;

    /// @notice Address registry
    IFantomAddressRegistry public addressRegistry;

    modifier onlyMarketplace() {
        require(
            address(addressRegistry.bundleMarketplace()) == _msgSender(),
            "sender must be bundle marketplace"
        );
        _;
    }

    modifier isListed(
        address _nftAddress,
        uint256 _tokenId,
        address _owner
    ) {
        Listing memory listing = listings[_nftAddress][_tokenId][_owner];
        require(listing.quantity > 0, "not listed item");
        _;
    }

    modifier notListed(
        address _nftAddress,
        uint256 _tokenId,
        address _owner
    ) {
        Listing memory listing = listings[_nftAddress][_tokenId][_owner];
        require(listing.quantity == 0, "already listed");
        _;
    }

    modifier validListing(
        address _nftAddress,
        uint256 _tokenId,
        address _owner
    ) {
        Listing memory listedItem = listings[_nftAddress][_tokenId][_owner];

        _validOwner(_nftAddress, _tokenId, _owner, listedItem.quantity);

        require(_getNow() >= listedItem.startingTime, "item not buyable");
        _;
    }

    modifier offerExists(
        address _nftAddress,
        uint256 _tokenId,
        address _creator
    ) {
        Offer memory offer = offers[_nftAddress][_tokenId][_creator];
        require(
            offer.quantity > 0 && offer.deadline > _getNow(),
            "offer not exists or expired"
        );
        _;
    }

    modifier offerNotExists(
        address _nftAddress,
        uint256 _tokenId,
        address _creator
    ) {
        Offer memory offer = offers[_nftAddress][_tokenId][_creator];
        require(
            offer.quantity == 0 || offer.deadline <= _getNow(),
            "offer already created"
        );
        _;
    }

    modifier supportedNFTContract(address _nftAddress) {
        require(
            IERC165(_nftAddress).supportsInterface(INTERFACE_ID_ERC721) ||
                IERC165(_nftAddress).supportsInterface(INTERFACE_ID_ERC1155),
            "invalid nft address"
        );
        _;
    }

    /// v1.2 Additional tweaks
    event NFTRoyaltySet(
        address by,
        address nftAddress,
        uint256 tokenId,
        uint16 royalty
    );

    event CollectionRoyaltySet(
        address by,
        address nftAddress,
        address creator,
        address feeRecipient,
        uint16 royalty
    );

    address payable public wToken;

    // updates from 1.3
    mapping(address => bool) public isAggregator;

    modifier onlyAggregator() {
        require(
            isAggregator[_msgSender()],
            "restricted to aggregator contract"
        );
        _;
    }

    /// @notice Contract initializer
    function initialize(address payable _feeRecipient, uint16 _platformFee)
        public
        initializer
    {
        platformFee = _platformFee;
        feeReceipient = _feeRecipient;

        __Ownable_init();
        __ReentrancyGuard_init();
    }

    /// @notice Method for listing NFT
    /// @param _nftAddress Address of NFT contract
    /// @param _tokenId Token ID of NFT
    /// @param _quantity token amount to list (needed for ERC-1155 NFTs, set as 1 for ERC-721)
    /// @param _payToken Paying token
    /// @param _pricePerItem sale price for each iteam
    /// @param _startingTime scheduling for a future sale
    function listItem(
        address _nftAddress,
        uint256 _tokenId,
        uint256 _quantity,
        address _payToken,
        uint256 _pricePerItem,
        uint256 _startingTime
    ) external {
        _listItemBy(
            _msgSender(),
            _nftAddress,
            _tokenId,
            _quantity,
            _payToken,
            _pricePerItem,
            _startingTime
        );
    }

    /// @notice Method for canceling listed NFT
    function cancelListing(address _nftAddress, uint256 _tokenId)
        external
        nonReentrant
        isListed(_nftAddress, _tokenId, _msgSender())
    {
        _cancelListing(_nftAddress, _tokenId, _msgSender());
    }

    /// @notice Method for updating listed NFT
    /// @param _nftAddress Address of NFT contract
    /// @param _tokenId Token ID of NFT
    /// @param _payToken payment token
    /// @param _newPrice New sale price for each iteam
    function updateListing(
        address _nftAddress,
        uint256 _tokenId,
        address _payToken,
        uint256 _newPrice
    ) external nonReentrant isListed(_nftAddress, _tokenId, _msgSender()) {
        Listing storage listedItem = listings[_nftAddress][_tokenId][
            _msgSender()
        ];

        _validOwner(_nftAddress, _tokenId, _msgSender(), listedItem.quantity);

        _validPayToken(_payToken);

        listedItem.payToken = _payToken;
        listedItem.pricePerItem = _newPrice;
        emit ItemUpdated(
            _msgSender(),
            _nftAddress,
            _tokenId,
            _payToken,
            _newPrice
        );
    }

    /// @notice Methdod to process a payment
    /// @param _payToken the token address to pay with
    /// @param recipient the payee recipient
    /// @param amount the amunt to pay
    function _pay(
        address _payToken,
        address recipient,
        uint256 amount
    ) private returns (bool) {
        if (_payToken == address(0)) {
            // payment with native token
            (bool succeeded, ) = payable(recipient).call{value: amount}("");
            return succeeded;
        } else {
            // payment with ERC20
            IERC20(_payToken).safeTransferFrom(_msgSender(), recipient, amount);
            return true;
        }
    }

    /// @notice Method for buying listed NFT
    /// @param _nftAddress NFT contract address
    /// @param _tokenId TokenId
    function buyItem(
        address _nftAddress,
        uint256 _tokenId,
        address _payToken,
        address _owner
    )
        external
        nonReentrant
        isListed(_nftAddress, _tokenId, _owner)
        validListing(_nftAddress, _tokenId, _owner)
    {
        Listing memory listedItem = listings[_nftAddress][_tokenId][_owner];
        require(listedItem.payToken == _payToken, "invalid pay token");

        _buyItem(_nftAddress, _tokenId, _payToken, _owner);
    }

    /// @notice Method for buying listed NFT (using Native token)
    /// @param _nftAddress NFT contract address
    /// @param _tokenId TokenId
    /// @param _tokenId TokenId
    function buyItem(
        address _nftAddress,
        uint256 _tokenId,
        address _owner
    )
        external
        payable
        nonReentrant
        isListed(_nftAddress, _tokenId, _owner)
        validListing(_nftAddress, _tokenId, _owner)
    {
        Listing memory listedItem = listings[_nftAddress][_tokenId][_owner];
        require(
            listedItem.payToken == address(0) || listedItem.payToken == wToken,
            "invalid pay token"
        );
        require(
            msg.value >= listedItem.pricePerItem.mul(listedItem.quantity),
            "insufficient balance"
        );

        if (listedItem.payToken == wToken) {
            require(_bundleWrap(wToken), "failed to swap");
            _buyItem(_nftAddress, _tokenId, wToken, _owner);
        } else {
            _buyItem(_nftAddress, _tokenId, address(0), _owner);
        }
    }

    function _buyItem(
        address _nftAddress,
        uint256 _tokenId,
        address _payToken,
        address _owner
    ) private {
        Listing memory listedItem = listings[_nftAddress][_tokenId][_owner];

        uint256 price = listedItem.pricePerItem.mul(listedItem.quantity);
        uint256 feeAmount = price.mul(platformFee).div(1e3);

        require(_pay(_payToken, feeReceipient, feeAmount), "failed to pay fee");

        address minter = minters[_nftAddress][_tokenId];
        uint16 royalty = royalties[_nftAddress][_tokenId];
        if (minter != address(0) && royalty != 0) {
            uint256 royaltyFee = price.sub(feeAmount).mul(royalty).div(10000);

            require(
                _pay(_payToken, minter, royaltyFee),
                "failed to pay royalty"
            );

            feeAmount = feeAmount.add(royaltyFee);
        } else {
            minter = collectionRoyalties[_nftAddress].feeRecipient;
            royalty = collectionRoyalties[_nftAddress].royalty;
            if (minter != address(0) && royalty != 0) {
                uint256 royaltyFee = price.sub(feeAmount).mul(royalty).div(
                    10000
                );

                require(
                    _pay(_payToken, minter, royaltyFee),
                    "failed to pay royalty"
                );

                feeAmount = feeAmount.add(royaltyFee);
            }
        }

        require(
            _pay(_payToken, _owner, price.sub(feeAmount)),
            "failed to pay seller"
        );

        // Transfer NFT to buyer
        if (IERC165(_nftAddress).supportsInterface(INTERFACE_ID_ERC721)) {
            IERC721(_nftAddress).safeTransferFrom(
                _owner,
                _msgSender(),
                _tokenId
            );
        } else {
            IERC1155(_nftAddress).safeTransferFrom(
                _owner,
                _msgSender(),
                _tokenId,
                listedItem.quantity,
                bytes("")
            );
        }
        IFantomBundleMarketplace(addressRegistry.bundleMarketplace())
            .validateItemSold(_nftAddress, _tokenId, listedItem.quantity);

        emit ItemSold(
            _owner,
            _msgSender(),
            _nftAddress,
            _tokenId,
            listedItem.quantity,
            _payToken,
            getPrice(_payToken),
            price.div(listedItem.quantity)
        );
        delete (listings[_nftAddress][_tokenId][_owner]);
    }

    function _createOffer(
        address _nftAddress,
        uint256 _tokenId,
        IERC20 _payToken,
        uint256 _quantity,
        uint256 _pricePerItem,
        uint256 _deadline
    ) private {
        IFantomAuction auction = IFantomAuction(addressRegistry.auction());

        (, , , uint256 startTime, , bool resulted) = auction.auctions(
            _nftAddress,
            _tokenId
        );

        require(
            startTime == 0 || resulted == true,
            "cannot place an offer if auction is going on"
        );

        require(_deadline > _getNow(), "invalid expiration");

        _validPayToken(address(_payToken));

        offers[_nftAddress][_tokenId][_msgSender()] = Offer(
            _payToken,
            _quantity,
            _pricePerItem,
            _deadline
        );

        emit OfferCreated(
            _msgSender(),
            _nftAddress,
            _tokenId,
            _quantity,
            address(_payToken),
            _pricePerItem,
            _deadline
        );
    }

    /// @notice Method for offering item
    /// @param _nftAddress NFT contract address
    /// @param _tokenId TokenId
    /// @param _payToken Paying token
    /// @param _quantity Quantity of items
    /// @param _pricePerItem Price per item
    /// @param _deadline Offer expiration
    function createOffer(
        address _nftAddress,
        uint256 _tokenId,
        IERC20 _payToken,
        uint256 _quantity,
        uint256 _pricePerItem,
        uint256 _deadline
    )
        external
        nonReentrant
        offerNotExists(_nftAddress, _tokenId, _msgSender())
        supportedNFTContract(_nftAddress)
    {
        _createOffer(
            _nftAddress,
            _tokenId,
            _payToken,
            _quantity,
            _pricePerItem,
            _deadline
        );
    }

    /// @notice Method for offering item
    /// @param _nftAddress NFT contract address
    /// @param _tokenId TokenId
    /// @param _quantity Quantity of items
    /// @param _deadline Offer expiration
    function createOffer(
        address _nftAddress,
        uint256 _tokenId,
        uint256 _quantity,
        uint256 _deadline
    )
        external
        payable
        nonReentrant
        offerNotExists(_nftAddress, _tokenId, _msgSender())
        supportedNFTContract(_nftAddress)
        withWrap(wToken)
    {
        _createOffer(
            _nftAddress,
            _tokenId,
            IERC20(wToken),
            _quantity,
            msg.value.div(_quantity),
            _deadline
        );
    }

    /// @notice Method for canceling the offer
    /// @param _nftAddress NFT contract address
    /// @param _tokenId TokenId
    function cancelOffer(address _nftAddress, uint256 _tokenId)
        external
        offerExists(_nftAddress, _tokenId, _msgSender())
    {
        delete (offers[_nftAddress][_tokenId][_msgSender()]);
        emit OfferCanceled(_msgSender(), _nftAddress, _tokenId);
    }

    /// @notice Method for accepting the offer
    /// @param _nftAddress NFT contract address
    /// @param _tokenId TokenId
    /// @param _creator Offer creator address
    function acceptOffer(
        address _nftAddress,
        uint256 _tokenId,
        address _creator
    ) external nonReentrant offerExists(_nftAddress, _tokenId, _creator) {
        Offer memory offer = offers[_nftAddress][_tokenId][_creator];

        _validOwner(_nftAddress, _tokenId, _msgSender(), offer.quantity);

        uint256 price = offer.pricePerItem.mul(offer.quantity);
        uint256 feeAmount = price.mul(platformFee).div(1e3);
        uint256 royaltyFee;

        offer.payToken.safeTransferFrom(_creator, feeReceipient, feeAmount);

        address minter = minters[_nftAddress][_tokenId];
        uint16 royalty = royalties[_nftAddress][_tokenId];

        if (minter != address(0) && royalty != 0) {
            royaltyFee = price.sub(feeAmount).mul(royalty).div(10000);
            offer.payToken.safeTransferFrom(_creator, minter, royaltyFee);
            feeAmount = feeAmount.add(royaltyFee);
        } else {
            minter = collectionRoyalties[_nftAddress].feeRecipient;
            royalty = collectionRoyalties[_nftAddress].royalty;
            if (minter != address(0) && royalty != 0) {
                royaltyFee = price.sub(feeAmount).mul(royalty).div(10000);
                offer.payToken.safeTransferFrom(_creator, minter, royaltyFee);
                feeAmount = feeAmount.add(royaltyFee);
            }
        }

        offer.payToken.safeTransferFrom(
            _creator,
            _msgSender(),
            price.sub(feeAmount)
        );

        // Transfer NFT to buyer
        if (IERC165(_nftAddress).supportsInterface(INTERFACE_ID_ERC721)) {
            IERC721(_nftAddress).safeTransferFrom(
                _msgSender(),
                _creator,
                _tokenId
            );
        } else {
            IERC1155(_nftAddress).safeTransferFrom(
                _msgSender(),
                _creator,
                _tokenId,
                offer.quantity,
                bytes("")
            );
        }
        IFantomBundleMarketplace(addressRegistry.bundleMarketplace())
            .validateItemSold(_nftAddress, _tokenId, offer.quantity);

        emit ItemSold(
            _msgSender(),
            _creator,
            _nftAddress,
            _tokenId,
            offer.quantity,
            address(offer.payToken),
            getPrice(address(offer.payToken)),
            offer.pricePerItem
        );

        emit OfferCanceled(_creator, _nftAddress, _tokenId);

        delete (listings[_nftAddress][_tokenId][_msgSender()]);
        delete (offers[_nftAddress][_tokenId][_creator]);
    }

    /// @notice Method for setting royalty
    /// @param _nftAddress NFT contract address
    /// @param _tokenId TokenId
    /// @param _royalty Royalty
    function registerRoyalty(
        address _nftAddress,
        uint256 _tokenId,
        uint16 _royalty
    ) external {
        _registerRoyaltyBy(_msgSender(), _nftAddress, _tokenId, _royalty);
    }

    /// @notice Method for updating royalty
    /// @param _nftAddress NFT contract address
    /// @param _tokenId TokenId
    /// @param _royalty Royalty
    function updateRoyalty(
        address _nftAddress,
        uint256 _tokenId,
        uint16 _royalty
    ) external {
        require(_royalty <= 2000, "invalid royalty");
        require(_isFantomNFT(_nftAddress), "invalid nft address");

        require(
            minters[_nftAddress][_tokenId] == _msgSender(),
            "royalty update restricted to minter"
        );

        royalties[_nftAddress][_tokenId] = _royalty;

        emit NFTRoyaltySet(_msgSender(), _nftAddress, _tokenId, _royalty);
    }

    /// @notice Method for setting royalty
    /// @param _nftAddress NFT contract address
    /// @param _royalty Royalty
    function registerCollectionRoyalty(
        address _nftAddress,
        address _creator,
        uint16 _royalty,
        address _feeRecipient
    ) external onlyOwner {
        require(_creator != address(0), "invalid creator address");
        require(_royalty <= 2000, "invalid royalty");
        require(
            _royalty == 0 || _feeRecipient != address(0),
            "invalid fee recipient address"
        );
        require(!_isFantomNFT(_nftAddress), "invalid nft address");

        if (collectionRoyalties[_nftAddress].creator == address(0)) {
            collectionRoyalties[_nftAddress] = CollectionRoyalty(
                _royalty,
                _creator,
                _feeRecipient
            );
        } else {
            CollectionRoyalty storage collectionRoyalty = collectionRoyalties[
                _nftAddress
            ];

            collectionRoyalty.royalty = _royalty;
            collectionRoyalty.feeRecipient = _feeRecipient;
            collectionRoyalty.creator = _creator;
        }

        emit CollectionRoyaltySet(
            _msgSender(),
            _nftAddress,
            _creator,
            _feeRecipient,
            _royalty
        );
    }

    function _isFantomNFT(address _nftAddress) internal view returns (bool) {
        return
            addressRegistry.artion() == _nftAddress ||
            IFantomNFTFactory(addressRegistry.factory()).exists(_nftAddress) ||
            IFantomNFTFactory(addressRegistry.privateFactory()).exists(
                _nftAddress
            ) ||
            IFantomNFTFactory(addressRegistry.artFactory()).exists(
                _nftAddress
            ) ||
            IFantomNFTFactory(addressRegistry.privateArtFactory()).exists(
                _nftAddress
            );
    }

    /**
     @notice Method for getting price for pay token
     @param _payToken Paying token
     */
    function getPrice(address _payToken) public view returns (int256) {
        int256 unitPrice;
        uint8 decimals;
        IFantomPriceFeed priceFeed = IFantomPriceFeed(
            addressRegistry.priceFeed()
        );

        if (_payToken == address(0)) {
            (unitPrice, decimals) = priceFeed.getPrice(priceFeed.wFTM());
        } else {
            (unitPrice, decimals) = priceFeed.getPrice(_payToken);
        }
        if (decimals < 18) {
            unitPrice = unitPrice * (int256(10)**(18 - decimals));
        } else {
            unitPrice = unitPrice / (int256(10)**(decimals - 18));
        }

        return unitPrice;
    }

    /**
     @notice Method for updating platform fee
     @dev Only admin
     @param _platformFee uint16 the platform fee to set
     */
    function updatePlatformFee(uint16 _platformFee) external onlyOwner {
        platformFee = _platformFee;
        emit UpdatePlatformFee(_platformFee);
    }

    /**
     @notice Method for updating platform fee address
     @dev Only admin
     @param _platformFeeRecipient payable address the address to sends the funds to
     */
    function updatePlatformFeeRecipient(address payable _platformFeeRecipient)
        external
        onlyOwner
    {
        feeReceipient = _platformFeeRecipient;
        emit UpdatePlatformFeeRecipient(_platformFeeRecipient);
    }

    /**
     @notice Update FantomAddressRegistry contract
     @dev Only admin
     */
    function updateAddressRegistry(address _registry) external onlyOwner {
        addressRegistry = IFantomAddressRegistry(_registry);
    }

    /**
     * @notice Validate and cancel listing
     * @dev Only bundle marketplace can access
     */
    function validateItemSold(
        address _nftAddress,
        uint256 _tokenId,
        address _seller,
        address _buyer
    ) external onlyMarketplace {
        Listing memory item = listings[_nftAddress][_tokenId][_seller];
        if (item.quantity > 0) {
            _cancelListing(_nftAddress, _tokenId, _seller);
        }
        delete (offers[_nftAddress][_tokenId][_buyer]);
        emit OfferCanceled(_buyer, _nftAddress, _tokenId);
    }

    ////////////////////////////
    /// Internal and Private ///
    ////////////////////////////

    function _getNow() internal view virtual returns (uint256) {
        return block.timestamp;
    }

    function _validPayToken(address _payToken) internal view {
        require(
            _payToken == address(0) ||
                (addressRegistry.tokenRegistry() != address(0) &&
                    IFantomTokenRegistry(addressRegistry.tokenRegistry())
                        .enabled(_payToken)),
            "invalid pay token"
        );
    }

    function _validOwner(
        address _nftAddress,
        uint256 _tokenId,
        address _owner,
        uint256 quantity
    ) internal view {
        if (IERC165(_nftAddress).supportsInterface(INTERFACE_ID_ERC721)) {
            IERC721 nft = IERC721(_nftAddress);
            require(nft.ownerOf(_tokenId) == _owner, "not owning item");
        } else if (
            IERC165(_nftAddress).supportsInterface(INTERFACE_ID_ERC1155)
        ) {
            IERC1155 nft = IERC1155(_nftAddress);
            require(
                nft.balanceOf(_owner, _tokenId) >= quantity,
                "not owning item"
            );
        } else {
            revert("invalid nft address");
        }
    }

    function _cancelListing(
        address _nftAddress,
        uint256 _tokenId,
        address _owner
    ) private {
        Listing memory listedItem = listings[_nftAddress][_tokenId][_owner];

        _validOwner(_nftAddress, _tokenId, _owner, listedItem.quantity);

        delete (listings[_nftAddress][_tokenId][_owner]);
        emit ItemCanceled(_owner, _nftAddress, _tokenId);
    }

    function setWToken(address _wToken) public onlyOwner {
        wToken = payable(_wToken);
    }

    // START AGG: Updates to address aggregated actions (bundling in one tx) -----
    function acknowledgeAggregator(address addr) external onlyOwner {
        isAggregator[addr] = true;
    }

    function _listItemBy(
        address _by,
        address _nftAddress,
        uint256 _tokenId,
        uint256 _quantity,
        address _payToken,
        uint256 _pricePerItem,
        uint256 _startingTime
    ) internal notListed(_nftAddress, _tokenId, _by) {
        if (IERC165(_nftAddress).supportsInterface(INTERFACE_ID_ERC721)) {
            IERC721 nft = IERC721(_nftAddress);
            require(nft.ownerOf(_tokenId) == _by, "not owning item");
            require(
                nft.isApprovedForAll(_by, address(this)),
                "item not approved"
            );
        } else if (
            IERC165(_nftAddress).supportsInterface(INTERFACE_ID_ERC1155)
        ) {
            IERC1155 nft = IERC1155(_nftAddress);
            require(
                nft.balanceOf(_by, _tokenId) >= _quantity,
                "must hold enough nfts"
            );
            require(
                nft.isApprovedForAll(_by, address(this)),
                "item not approved"
            );
        } else {
            revert("invalid nft address");
        }

        _validPayToken(_payToken);

        listings[_nftAddress][_tokenId][_by] = Listing(
            _quantity,
            _payToken,
            _pricePerItem,
            _startingTime
        );
        emit ItemListed(
            _by,
            _nftAddress,
            _tokenId,
            _quantity,
            _payToken,
            _pricePerItem,
            _startingTime
        );
    }

    function pipeListItem(
        address _nftAddress,
        uint256 _tokenId,
        uint256 _quantity,
        address _payToken,
        uint256 _pricePerItem,
        uint256 _startingTime
    ) external onlyAggregator {
        _listItemBy(
            tx.origin,
            _nftAddress,
            _tokenId,
            _quantity,
            _payToken,
            _pricePerItem,
            _startingTime
        );
    }

    function _registerRoyaltyBy(
        address _by,
        address _nftAddress,
        uint256 _tokenId,
        uint16 _royalty
    ) private {
        require(_royalty <= 2000, "invalid royalty");
        require(_isFantomNFT(_nftAddress), "invalid nft address");

        _validOwner(_nftAddress, _tokenId, _by, 1);

        require(
            minters[_nftAddress][_tokenId] == address(0),
            "royalty already set"
        );
        minters[_nftAddress][_tokenId] = _by;
        royalties[_nftAddress][_tokenId] = _royalty;

        emit NFTRoyaltySet(_by, _nftAddress, _tokenId, _royalty);
    }

    function pipeRegisterRoyalty(
        address _nftAddress,
        uint256 _tokenId,
        uint16 _royalty
    ) external onlyAggregator {
        _registerRoyaltyBy(tx.origin, _nftAddress, _tokenId, _royalty);
    }
    // END AGG -----
}
