const {
  BN,
  expectEvent,
  expectRevert,
  balance,
  constants,
  ether,
} = require('@openzeppelin/test-helpers');

const { expect } = require('chai');

const {
  platformFee,
  pricePerItem,
  tokenSupply,
  randomTokenURI,
  newPrice,
} = require('./utils/constants');
const { prepareTokenBy, prepareContracts } = require('./utils/ecosystem');
const { waitFor } = require('./utils/helpers');

contract('Marketplace interacting with MockERC721 NFT contract', async function ([
  owner,
  minter,
  buyer,
  feeRecipient,
  anyOne,
]) {
  before(async function () {
    await prepareTokenBy.call(this, { owner, buyer, feeRecipient }, tokenSupply, pricePerItem);
  })

  beforeEach(async function () {
    await prepareContracts.call(this, owner, feeRecipient, platformFee);

    const mint1 = await this.nft.mint(minter, randomTokenURI, { from: minter });
    this.tokenId1 = mint1.logs[0].args.tokenId;

    const mint2 = await this.nft.mint(owner, randomTokenURI, { from: owner });
    this.tokenId2 = mint2.logs[0].args.tokenId;
  });

  afterEach(async function () {
    await this.nft.setApprovalForAll(this.marketplace.address, true, { from: owner });
    await this.nft.setApprovalForAll(this.marketplace.address, true, { from: minter });
    await this.nft.setApprovalForAll(this.auction.address, true, { from: owner });
    await this.nft.setApprovalForAll(this.auction.address, true, { from: minter });
  })

  const fillWallet = async function (account, amount) {
    // fill a bit the buyer wallet with the wrapped token we use
    await this.payToken.mint(
      account,
      new BN((amount * 1).toString()),
      { from: account }
    );
    await this.payToken.approve(
      this.marketplace.address,
      new BN((amount * 1).toString()),
      { from: account }
    );
  }

  const successfullListItem = async function () {
    await this.nft.setApprovalForAll(this.marketplace.address, true, { from: minter });
    const startingTime = new BN(-30 + Math.floor((new Date()).getTime() / 1000));
    const result = await this.marketplace.listItem(
      this.nft.address,
      this.tokenId1,
      '1',
      this.payToken.address,
      pricePerItem,
      startingTime,
      { from: minter }
    );

    expectEvent(result, 'ItemListed', {
      owner: minter,
      nft: this.nft.address,
      tokenId: this.tokenId1,
      quantity: '1',
      payToken: this.payToken.address,
      pricePerItem,
      startingTime,
    });
  }

  const successfullCreateOffer = function () {
    return this.marketplace.createOffer(
      this.nft.address,
      this.tokenId1,
      this.payToken.address,
      '1',
      pricePerItem,
      Math.floor(3600 + (new Date()).getTime() / 1000),
      { from: buyer }
    )
  }

  const successfullAcceptOffer = async function () {
    await this.nft.setApprovalForAll(this.marketplace.address, true, { from: minter });
    return this.marketplace.acceptOffer(
      this.nft.address,
      this.tokenId1,
      buyer,
      { from: minter }
    );
  }

  describe('Listing Item', async function () {
    it('reverts when not owning NFT', async function () {
      await expectRevert(
        this.marketplace.listItem(
          this.nft.address,
          this.tokenId1,
          '1',
          this.payToken.address,
          pricePerItem,
          '0',
          { from: owner },
        ),
        "not owning item"
      );
    });

    it('reverts when not approved', async function () {
      await expectRevert(
        this.marketplace.listItem(
          this.nft.address,
          this.tokenId1,
          '1',
          this.payToken.address,
          pricePerItem,
          '0',
          { from: minter }
        ),
        "item not approved"
      );
    });

    it('successfuly lists item', successfullListItem)
  });

  describe('Canceling Item', async function () {
    beforeEach(successfullListItem);

    it('reverts when item is not listed', async function () {
      await expectRevert(
        this.marketplace.cancelListing(
          this.nft.address,
          this.tokenId2,
          { from: owner }
        ),
        "not listed item"
      );
    });

    // this will always land on different error since the _msgSender() is different
    // from owner, since so the error will always be "not listed item" due to
    // format of the `listings` memory which include the sender as owner
    it.skip('reverts when not owning the item', async function () {
      await expectRevert(
        this.marketplace.cancelListing(
          this.nft.address,
          this.tokenId1,
          { from: anyOne }
        ),
        "not owning item"
      );
    });

    it('successfully cancel the item', async function () {
      await this.marketplace.cancelListing(
        this.nft.address,
        this.tokenId1,
        { from: minter }
      );
    })
  });


  describe('Updating Item Price', function () {
    beforeEach(successfullListItem);

    it('reverts when item is not listed', async function () {
      await expectRevert(
        this.marketplace.updateListing(
          this.nft.address,
          this.tokenId2,
          this.payToken.address,
          newPrice,
          { from: owner }
        ),
        "not listed item"
      );
    });

    // this will always land on different error since the _msgSender() is different
    // from owner, since so the error will always be "not listed item" due to
    // format of the `listings` memory which include the sender as owner
    it.skip('reverts when not owning the item', async function () {
      await expectRevert(
        this.marketplace.updateListing(
          this.nft.address,
          this.tokenId1,
          this.payToken.address,
          newPrice,
          { from: owner }
        ),
        "not owning item"
      );
    });

    it('successfully update the item', async function () {
      await this.marketplace.updateListing(
        this.nft.address,
        this.tokenId1,
        this.payToken.address,
        newPrice,
        { from: minter }
      );
    })
  });

  describe('Register item royalties', function () {
    it('reverts when wrong owner want to register royalty', async function () {
      await expectRevert(
        this.marketplace.registerRoyalty(
          this.nft.address,
          this.tokenId1,
          new BN('1000'),
          { from: anyOne }
        ),
        "not owning item"
      );
    })

    it('reverts when royalty is greater than 20%', async function () {
      await expectRevert(
        this.marketplace.registerRoyalty(
          this.nft.address,
          this.tokenId1,
          new BN('3000'),
          { from: minter }
        ),
        "invalid royalty"
      );
    })

    it('reverts when set royalty on an invalid NFT contract', async function () {
      const wrongMint = await this.wrongNFT.mint(minter, randomTokenURI, { from: minter });
      const tokenId = wrongMint.logs[0].args.tokenId;
      await expectRevert(
        this.marketplace.registerRoyalty(
          this.wrongNFT.address,
          tokenId,
          new BN('1000'),
          { from: minter }
        ),
        "invalid nft address"
      );
    })

    it('sucessfully register royalty of 10%', async function () {
      const receipt = await this.marketplace.registerRoyalty(
        this.nft.address,
        this.tokenId1,
        new BN('1000'),
        { from: minter }
      );

      expectEvent(receipt, 'NFTRoyaltySet', {
        by: minter,
        nftAddress: this.nft.address,
        tokenId: this.tokenId1,
        royalty: new BN('1000')
      });

      const royalty = await this.marketplace.royalties(
        this.nft.address,
        this.tokenId1
      );

      expect(royalty).to.be.bignumber.equal('1000');
    })
  });

  describe('Update item royalties, need to be set before', function () {
    beforeEach(async function () {
      // set 10% initially
      await this.marketplace.registerRoyalty(
        this.nft.address,
        this.tokenId1,
        new BN('1000'),
        { from: minter }
      )
    });

    it('reverts when wrong owner want to register royalty', async function () {
      await expectRevert(
        this.marketplace.updateRoyalty(
          this.nft.address,
          this.tokenId1,
          new BN('1500'),
          { from: anyOne }
        ),
        "royalty update restricted to minter"
      );
    })

    it('reverts when royalty is greater than 20%', async function () {
      await expectRevert(
        this.marketplace.updateRoyalty(
          this.nft.address,
          this.tokenId1,
          new BN('3000'),
          { from: minter }
        ),
        "invalid royalty"
      );
    })

    it('reverts when set royalty on an invalid NFT contract', async function () {
      const wrongMint = await this.wrongNFT.mint(minter, randomTokenURI, { from: minter });
      const tokenId = wrongMint.logs[0].args.tokenId;
      await expectRevert(
        this.marketplace.updateRoyalty(
          this.wrongNFT.address,
          tokenId,
          new BN('1500'),
          { from: minter }
        ),
        "invalid nft address"
      );
    })

    it('sucessfully updated royalty to 15%', async function () {
      const receipt = await this.marketplace.updateRoyalty(
        this.nft.address,
        this.tokenId1,
        new BN('1500'),
        { from: minter }
      );

      expectEvent(receipt, 'NFTRoyaltySet', {
        by: minter,
        nftAddress: this.nft.address,
        tokenId: this.tokenId1,
        royalty: new BN('1500')
      });

      const royalty = await this.marketplace.royalties(
        this.nft.address,
        this.tokenId1
      );

      expect(royalty).to.be.bignumber.equal('1500');
    })
  });

  describe('Handle collection royalties', function () {
    it('only owner can execute this method', async function () {
      await expectRevert(
        this.marketplace.registerCollectionRoyalty(
          this.externalNFT.address,
          anyOne,
          new BN('1000'),
          feeRecipient,
          { from: anyOne }
        ),
        "caller is not the owner"
      );
    });

    it('reverts when creator is 0x000...', async function () {
      await expectRevert(
        this.marketplace.registerCollectionRoyalty(
          this.externalNFT.address,
          constants.ZERO_ADDRESS,
          new BN('1000'),
          feeRecipient,
          { from: owner }
        ),
        "invalid creator address"
      );
    });

    it('reverts when royalty is greater than 20%', async function () {
      await expectRevert(
        this.marketplace.registerCollectionRoyalty(
          this.externalNFT.address,
          owner,
          new BN('3000'),
          feeRecipient,
          { from: owner }
        ),
        "invalid royalty"
      );
    });

    it('reverts when register royalty on internal collection', async function () {
      await expectRevert(
        this.marketplace.registerCollectionRoyalty(
          this.nft.address,
          owner,
          new BN('1000'),
          feeRecipient,
          { from: owner }
        ),
        "invalid nft address"
      );
    });

    it('sucessfully register royalty of 10% on external NFT collection', async function () {
      const receipt = await this.marketplace.registerCollectionRoyalty(
        this.externalNFT.address,
        owner,
        new BN('1000'),
        feeRecipient,
        { from: owner }
      );

      expectEvent(receipt, 'CollectionRoyaltySet', {
        by: owner,
        nftAddress: this.externalNFT.address,
        creator: owner,
        feeRecipient,
        royalty: new BN('1000')
      })

      const royalty = await this.marketplace.collectionRoyalties(
        this.externalNFT.address,
      );

      expect(royalty.royalty).to.be.bignumber.equal('1000');
    });
  });

  describe('Buying Item', function () {
    beforeEach(successfullListItem);

    it('reverts when owner is no more owning the item', async function () {
      await this.nft.safeTransferFrom(minter, owner, this.tokenId1, { from: minter });
      await expectRevert(
        this.marketplace.buyItem(
          this.nft.address,
          this.tokenId1,
          this.payToken.address,
          minter,
          { from: anyOne }
        ),
        "not owning item"
      );
    });

    it('reverts when the amount is not enough', async function () {
      await expectRevert(
        this.marketplace.buyItem(
          this.nft.address,
          this.tokenId1,
          this.payToken.address,
          minter,
          { from: anyOne }
        ),
        "ERC20: transfer amount exceeds balance"
      );
    });

    it('reverts when buying before the scheduled time', async function () {
      await this.nft.setApprovalForAll(this.marketplace.address, true, { from: owner });
      await this.marketplace.listItem(
        this.nft.address,
        this.tokenId2,
        '1',
        this.payToken.address,
        pricePerItem,
        // starting only after 1H
        new BN(3600 + Math.floor((new Date()).getTime() / 1000)),
        { from: owner }
      );
      await expectRevert(
        this.marketplace.buyItem(
          this.nft.address,
          this.tokenId2,
          this.payToken.address,
          owner,
          { from: buyer }
        ),
        "item not buyable"
      );
    });

    it('successfully purchase item, then emit ItemSold event', async function () {
      await fillWallet.call(this, buyer, pricePerItem);
      // console.log({
      //   mk: this.marketplace.address,
      //   bundle: this.bundleMarketplace.address,
      //   nft: this.nft.address,
      //   pay: this.payToken.address,
      //   feed: this.priceFeed.address,
      //   registry: {
      //     tk: this.tokenRegistry.address,
      //     addr: this.addressRegistry.address,
      //   },
      //   owner,
      //   minter,
      //   buyer,
      //   tokenId: this.tokenId1.toString()
      // });

      // console.log(`let registry = await FantomAddressRegistry.at("${this.addressRegistry.address}");`)
      // console.log(`let tkr = await FantomTokenRegistry.at("${this.tokenRegistry.address}");`)
      // console.log(`let pay = await MockERC20.at("${this.payToken.address}");`)
      // console.log(`await pay.approve("${this.marketplace.address}", "${(pricePerItem * 5).toString()}", {from: "${buyer}"});`)
      // console.log(`let mk = await FantomMarketplace.at("${this.marketplace.address}");`)
      // console.log(`await mk.buyItem("${this.nft.address}", ${this.tokenId1.toString()}, "${this.payToken.address}", "${minter}", {from: "${buyer}"});`)
      // console.log(`await mk.registerRoyalty("${this.nft.address}", ${this.tokenId1.toString()}, 1000, {from: "${minter}"});`)
      const receipt = await this.marketplace.buyItem(
        this.nft.address,
        this.tokenId1,
        this.payToken.address,
        minter,
        { from: buyer }
      );

      expectEvent(receipt, 'ItemSold', {
        seller: minter,
        buyer,
        nft: this.nft.address,
        tokenId: this.tokenId1,
        quantity: new BN('1'),
        // no consideration of `getPrice` which should return 0 at this stage, no oracle set for payToken
        unitPrice: new BN('0'),
        pricePerItem: ether('1')
      });
    })
  });

  describe('Create offer', function () {
    it('reverts when deadline is past', async function () {
      await expectRevert(
        this.marketplace.createOffer(
          this.nft.address,
          this.tokenId1,
          this.payToken.address,
          '1',
          pricePerItem,
          Math.floor(-30 + (new Date()).getTime() / 1000),
          { from: buyer }
        ),
        "invalid expiration"
      )
    })

    it('reverts when trying to use an invalid pay token', async function () {
      await expectRevert(
        this.marketplace.createOffer(
          this.nft.address,
          this.tokenId1,
          this.invalidPayToken.address,
          '1',
          pricePerItem,
          Math.floor(3600 + (new Date()).getTime() / 1000),
          { from: buyer }
        ),
        "invalid pay token"
      )
    });

    // @todo: make this work
    it.skip('@todo: reverts when an auction is ongoing on the item', async function () {
      // an auction is ongoing
      await this.nft.setApprovalForAll(this.auction.address, true, { from: minter });
      await this.auction.createAuction(
        this.nft.address,
        this.tokenId1,
        this.payToken.address,
        pricePerItem,
        Math.floor(2 + (new Date()).getTime() / 1000),
        'true',
        Math.floor(3600 + (new Date()).getTime() / 1000),
        { from: minter }
      );

      // wait the auction effectively starts 
      await waitFor(2500);

      await expectRevert(
        this.marketplace.createOffer(
          this.nft.address,
          this.tokenId1,
          this.payToken.address,
          '1',
          pricePerItem,
          Math.floor(3600 + (new Date()).getTime() / 1000),
          { from: buyer }
        ),
        "cannot place an offer if auction is going on"
      )
    })

    it('successfully create offer, OfferCreated event should be emitted', async function () {
      const receipt = await successfullCreateOffer.call(this);

      expectEvent(receipt, 'OfferCreated', {
        creator: buyer,
        nft: this.nft.address,
        tokenId: this.tokenId1,
        quantity: new BN('1'),
        payToken: this.payToken.address,
        pricePerItem,
      })
    });

    it('reverts when offer has already been created', async function () {
      await successfullCreateOffer.call(this);
      await expectRevert(
        this.marketplace.createOffer(
          this.nft.address,
          this.tokenId1,
          this.payToken.address,
          '1',
          pricePerItem,
          Math.floor(3600 + (new Date()).getTime() / 1000),
          { from: buyer }
        ),
        "offer already created"
      )
    });
  });

  describe('Cancel offer', function () {
    beforeEach(successfullCreateOffer);

    it('reverts when no offer yet', async function () {
      await expectRevert(
        this.marketplace.cancelOffer(
          this.nft.address,
          this.tokenId2,
          { from: buyer }
        ),
        "offer not exists or expired"
      )
    })

    it('successfully canceled offer', async function () {
      const receipt = await this.marketplace.cancelOffer(
        this.nft.address,
        this.tokenId1,
        { from: buyer }
      );

      expectEvent(receipt, 'OfferCanceled', {
        creator: buyer,
        nft: this.nft.address,
        tokenId: this.tokenId1
      })
    })
  });

  describe('Accept offer', function () {
    beforeEach(successfullCreateOffer);

    it('reverts when no offer yet', async function () {
      await expectRevert(
        this.marketplace.acceptOffer(
          this.nft.address,
          this.tokenId2,
          buyer,
          { from: minter }
        ),
        "offer not exists or expired"
      )
    })

    it('reverts accept offer without owning the item', async function () {
      await this.nft.setApprovalForAll(this.marketplace.address, true, { from: owner });
      await expectRevert(
        this.marketplace.acceptOffer(
          this.nft.address,
          this.tokenId1,
          buyer,
          { from: owner }
        ),
        "not owning item"
      );
    })

    it('successfully accepted offer', async function () {
      await fillWallet.call(this, buyer, pricePerItem);
      const receipt = await successfullAcceptOffer.call(this);

      expectEvent(receipt, 'ItemSold', {
        seller: minter,
        buyer,
        nft: this.nft.address,
        tokenId: this.tokenId1,
        quantity: new BN('1'),
        unitPrice: new BN('0'),
        pricePerItem: ether('1')
      });

      expectEvent(receipt, 'OfferCanceled', {
        creator: buyer,
        nft: this.nft.address,
        tokenId: this.tokenId1
      })
    })
  });

  async function getGasCosts(receipt) {
    const tx = await web3.eth.getTransaction(receipt.tx);
    const gasPrice = new BN(tx.gasPrice);
    return gasPrice.mul(new BN(receipt.receipt.gasUsed));
  }
})
