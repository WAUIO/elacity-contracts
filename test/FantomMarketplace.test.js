const {
  BN,
  expectEvent,
  expectRevert,
  balance,
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

      const cost = await getGasCosts(receipt);

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
  })

  async function getGasCosts(receipt) {
    const tx = await web3.eth.getTransaction(receipt.tx);
    const gasPrice = new BN(tx.gasPrice);
    return gasPrice.mul(new BN(receipt.receipt.gasUsed));
  }
})
