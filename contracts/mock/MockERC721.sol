// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/GSN/Context.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockERC721 is ERC721("Fantom NFT", "FNFT"), Ownable {
    event Minted(
        uint256 tokenId,
        address beneficiary,
        string tokenUri,
        address minter
    );

    /// @notice Platform fee
    uint256 public platformFee;

    /// @notice Platform fee receipient
    address payable public feeReceipient;

    uint256 public _tokenId;

    constructor(address payable _feeRecipient, uint256 _platformFee) public {
        platformFee = _platformFee;
        feeReceipient = _feeRecipient;
    }

    function mint(address _to, string calldata _tokenUri) public {
        _tokenId = _tokenId.add(1);
        super._mint(_to, _tokenId);
        super.tokenURI(_tokenId);

        emit Minted(_tokenId, _to, _tokenUri, _msgSender());
    }

    function isApproved(uint256 id, address _operator)
        public
        view
        returns (bool)
    {
        return
            isApprovedForAll(ownerOf(id), _operator) ||
            getApproved(id) == _operator;
    }

    function burn(uint256 id) external {
        address operator = _msgSender();
        require(
            ownerOf(id) == operator || isApproved(id, operator),
            "Only garment owner or approved"
        );

        // Destroy token mappings
        _burn(id);
    }
}
