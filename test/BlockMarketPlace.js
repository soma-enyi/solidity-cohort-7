const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect, assert } = require("chai");
const { ethers } = require("hardhat");

// util function
const deployBlockMarketPlace = async () => {
  const [owner_, addr1, addr2, addr3, addr4] = await ethers.getSigners();
  const BlockMarketPlaceContract = await ethers.getContractFactory(
    "BlockMarketPlace"
  );
  const BlockNftContract = await ethers.getContractFactory("BlockNft");
  const BlockTokenContract = await ethers.getContractFactory("BlockToken");

  let name_ = "BlockToken";
  let symbol_ = "BCT";
  const BlockToken = await BlockTokenContract.deploy(
    name_,
    symbol_,
    owner_.address
  );
  const blocknft = await BlockNftContract.deploy();
  const marketplace = await BlockMarketPlaceContract.connect(owner_).deploy();

  return { marketplace, blocknft, BlockToken, owner_, addr1, addr2, addr3, addr4 };
};

describe("BlockMarketPlace Test Suite", () => {
  describe("Deployment", () => {
    it("Should return set values upon deployment", async () => {
      const { marketplace, owner_ } = await loadFixture(deployBlockMarketPlace);
      expect(await marketplace.marketOwner()).to.eq(owner_);
    });
  });

  describe("Listing", () => {
    it("Should list NFT accordingly", async () => {
      const { marketplace, addr1, BlockToken, blocknft } = await loadFixture(
        deployBlockMarketPlace
      );
      let tokenId = 1;
      await blocknft.connect(addr1).mint(addr1);
      let token = await ethers.getContractAt("IERC20", BlockToken);
      await blocknft
        .connect(addr1)
        .setApprovalForAll(marketplace.getAddress(), true);

      await marketplace.connect(addr1).listNft({
        owner: addr1,
        tokenId: tokenId,
        paymentToken: token,
        NftToken: blocknft.getAddress(),
        isNative: false,
        price: 100000,
        sold: false,
        minOffer: 10,
      });

      expect(await blocknft.ownerOf(tokenId)).to.eq(
        await marketplace.getAddress()
      );
    });

    it("Should revert upon setting unaccepted values", async () => {
      const { marketplace, addr1, BlockToken, blocknft } = await loadFixture(
        deployBlockMarketPlace
      );
      let tokenId = 1;
      await blocknft.connect(addr1).mint(addr1);
      let token = await ethers.getContractAt("IERC20", BlockToken);
      await blocknft
        .connect(addr1)
        .setApprovalForAll(marketplace.getAddress(), true);

      // Test invalid price
      let tx1 = marketplace.connect(addr1).listNft({
        owner: addr1,
        tokenId: tokenId,
        paymentToken: token,
        NftToken: blocknft.getAddress(),
        isNative: false,
        price: 0,
        sold: false,
        minOffer: 10,
      });
      await expect(tx1).to.be.revertedWith("Invalid price");

      // Test invalid min offer
      let tx2 = marketplace.connect(addr1).listNft({
        owner: addr1,
        tokenId: tokenId,
        paymentToken: token,
        NftToken: blocknft.getAddress(),
        isNative: false,
        price: 10000,
        sold: false,
        minOffer: 0,
      });
      await expect(tx2).to.be.revertedWith("Invalid min offer");

      // Test native with ERC20 token
      let tx3 = marketplace.connect(addr1).listNft({
        owner: addr1,
        tokenId: tokenId,
        paymentToken: token,
        NftToken: blocknft.getAddress(),
        isNative: true,
        price: 10000,
        sold: false,
        minOffer: 10,
      });
      await expect(tx3).to.be.revertedWith("ERC20 Payment is not supported");

      // Test valid native listing
      let ZeroAddress = "0x0000000000000000000000000000000000000000";
      await marketplace.connect(addr1).listNft({
        owner: addr1,
        tokenId: tokenId,
        paymentToken: ZeroAddress,
        NftToken: blocknft.getAddress(),
        isNative: true,
        price: 10000,
        sold: false,
        minOffer: 10,
      });

      let listing = await marketplace.getListing(0);
      expect(listing.paymentToken).to.eq(ZeroAddress);
    });
      describe("Buy NFT", () => {
    it("Should buy NFT successfully with ETH", async () => {
      const { marketplace, blocknft, owner_, addr2, addr4 } = await loadFixture(
        deployBlockMarketPlace
      );

      let tokenId = 1;
      let price = ethers.parseEther("1"); // 1 ETH

      //NFT Minting to addr1
      await blocknft.connect(addr2).mint(addr2);
      await blocknft
        .connect(addr1)
        .setApprovalForAll(marketplace.getAddress(), true);

      // List NFT for ETH
      await marketplace.connect(addr1).listNft({
        owner: addr2,
        tokenId: tokenId,
        paymentToken: "0x0000000000000000000000000000000000000000",
        NftToken: blocknft.getAddress(),
        isNative: true,
        price: price,
        sold: false,
        minOffer: ethers.parseEther("0.5"),
      });

      // Get initial balances
      const addr2BalanceBefore = await ethers.provider.getBalance(
        addr2.address
      );
      const marketOwnerBalanceBefore = await ethers.provider.getBalance(
        owner_.address
      );

      // Buy NFT
      await marketplace.connect(addr4).buyNft(0, { value: price });

      // Check NFT ownership transferred
      expect(await blocknft.ownerOf(tokenId)).to.eq(addr4.address);

      // Check listing marked as sold
      const listing = await marketplace.getListing(0);
      expect(listing.sold).to.be.true;

      // Check payment distribution (97% to seller, 3% to marketplace)
      const expectedSellerAmount = (price * 97/100);
      const expectedMarketplaceAmount = (price * 3/ 100);

      const addr2BalanceAfter = await ethers.provider.getBalance(addr2.address);
      const marketOwnerBalanceAfter = await ethers.provider.getBalance(
        owner_.address
      );

      expect(addr2BalanceAfter - addr2BalanceBefore).to.eq(
        expectedSellerAmount
      );
      expect(marketOwnerBalanceAfter - marketOwnerBalanceBefore).to.eq(
        expectedMarketplaceAmount
      );
    });

    it("Should buy NFT successfully with ERC20", async () => {
      const { BlockToken, marketplace, blocknft, owner_, addr1, addr2 } =
        await loadFixture(deployBlockMarketPlace);

      let tokenId = 1;
      let price = 1000;

      // Mint tokens to addr2 for buying - using correct parameter order (amount, recipient)
      await BlockToken.connect(owner_).mint(10000, addr2.address);
      await BlockToken.connect(addr2).approve(
        await marketplace.getAddress(),
        price
      );

      // Mint NFT to addr1
      await blocknft.connect(addr1).mint(addr1);
      await blocknft
        .connect(addr1)
        .setApprovalForAll(await marketplace.getAddress(), true);

      // List NFT for ERC20 - Fix: use await BlockToken.getAddress()
      await marketplace.connect(addr1).listNft({
        owner: addr1,
        tokenId: tokenId,
        paymentToken: await BlockToken.getAddress(),
        NftToken: await blocknft.getAddress(),
        isNative: false,
        price: price,
        sold: false,
        minOffer: 100,
      });

      // Get initial token balances
      const addr1TokenBalanceBefore = await BlockToken.balanceOf(addr1.address);
      const marketOwnerTokenBalanceBefore = await BlockToken.balanceOf(
        owner_.address
      );

      // Buy NFT
      await marketplace.connect(addr2).buyNft(0);

      // Check NFT ownership transferred
      expect(await blocknft.ownerOf(tokenId)).to.eq(addr2.address);

      // Check listing marked as sold
      const listing = await marketplace.getListing(0);
      expect(listing.sold).to.be.true;

      // Check token payment distribution
      const expectedSellerAmount = (price * 97) / 100;
      const expectedMarketplaceAmount = (price * 3) / 100;

      const addr1TokenBalanceAfter = await BlockToken.balanceOf(addr1.address);
      const marketOwnerTokenBalanceAfter = await BlockToken.balanceOf(
        owner_.address
      );

      expect(addr1TokenBalanceAfter - addr1TokenBalanceBefore).to.eq(
        expectedSellerAmount
      );
      expect(
        marketOwnerTokenBalanceAfter - marketOwnerTokenBalanceBefore
      ).to.eq(expectedMarketplaceAmount);
    });

    it("Should revert if NFT is already sold", async () => {
      const { marketplace, blocknft, addr1, addr2, addr3 } = await loadFixture(
        deployBlockMarketPlace
      );

      let tokenId = 1;
      let price = ethers.parseEther("1");

      // Setup and list NFT
      await blocknft.connect(addr1).mint(addr1);
      await blocknft
        .connect(addr1)
        .setApprovalForAll(marketplace.getAddress(), true);

      await marketplace.connect(addr1).listNft({
        owner: addr1,
        tokenId: tokenId,
        paymentToken: "0x0000000000000000000000000000000000000000",
        NftToken: blocknft.getAddress(),
        isNative: true,
        price: price,
        sold: false,
        minOffer: ethers.parseEther("0.5"),
      });

      // First buyer buys successfully
      await marketplace.connect(addr2).buyNft(0, { value: price });

      // Second buyer tries to buy - should revert
      await expect(
        marketplace.connect(addr3).buyNft(0, { value: price })
      ).to.be.revertedWith("ALready Sold");
    });

    it("Should revert with incorrect ETH amount", async () => {
      const { marketplace, blocknft, addr1, addr2 } = await loadFixture(
        deployBlockMarketPlace
      );

      let tokenId = 1;
      let price = ethers.parseEther("1");

      // Setup and list NFT
      await blocknft.connect(addr1).mint(addr1);
      await blocknft
        .connect(addr1)
        .setApprovalForAll(marketplace.getAddress(), true);

      await marketplace.connect(addr1).listNft({
        owner: addr1,
        tokenId: tokenId,
        paymentToken: "0x0000000000000000000000000000000000000000",
        NftToken: blocknft.getAddress(),
        isNative: true,
        price: price,
        sold: false,
        minOffer: ethers.parseEther("0.5"),
      });

      // Try to buy with wrong amount
      await expect(
        marketplace
          .connect(addr2)
          .buyNft(0, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWith("Incorrect price");
    });
  });

  });

  describe("Making Offers", () => {
    it("Should make ETH offer to be successfully", async () => {
      const { marketplace, blocknft, addr1, addr3} = await loadFixture(
        deployBlockMarketPlace
      );

      let tokenId = 1;
      let price = ethers.parseEther("1");
      let offerAmount = ethers.parseEther("0.8");

      // Setup and list NFT
      await blocknft.connect(addr1).mint(addr1);
      await blocknft
        .connect(addr1)
        .setApprovalForAll(marketplace.getAddress(), true);

      await marketplace.connect(addr1).listNft({
        owner: addr1,
        tokenId: tokenId,
        paymentToken: "0x0000000000000000000000000000000000000000",
        NftToken: blocknft.getAddress(),
        isNative: true,
        price: price,
        sold: false,
        minOffer: ethers.parseEther("0.5"),
      });

      // Make offer
      await marketplace.connect(addr3).offer(0, 0, { value: offerAmount });

      // Check offer details
      const offer = await marketplace.getOffer(0);
      expect(offer.listId).to.eq(0);
      expect(offer.offerAmount).to.eq(offerAmount);
      expect(offer.offerrer).to.eq(addr2.address);
      expect(offer.status).to.be.false;
    });

    it("Should make offer for ERC20  to be successfully", async () => {
      const { marketplace, blocknft, BlockToken, owner_, addr1, addr2 } =
        await loadFixture(deployBlockMarketPlace);

      let tokenId = 1;
      let price = 1000;
      let offerAmount = 800;

      // Mint tokens to addr2 for offering - using correct parameter order (amount, recipient)
      await BlockToken.connect(owner_).mint(10000, addr2.address);
      await BlockToken.connect(addr2).approve(
        await marketplace.getAddress(),
        offerAmount
      );

      // Setup and list NFT
      await blocknft.connect(addr1).mint(addr1);
      await blocknft
        .connect(addr1)
        .setApprovalForAll(await marketplace.getAddress(), true);

      // Fix: use await BlockToken.getAddress()
      await marketplace.connect(addr1).listNft({
        owner: addr1,
        tokenId: tokenId,
        paymentToken: await BlockToken.getAddress(),
        NftToken: await blocknft.getAddress(),
        isNative: false,
        price: price,
        sold: false,
        minOffer: 500,
      });

      // Check token balance before offer
      const addr2BalanceBefore = await BlockToken.balanceOf(addr2.address);
      const marketplaceBalanceBefore = await BlockToken.balanceOf(
        await marketplace.getAddress()
      );

      // Make offer
      await marketplace.connect(addr2).offer(0, offerAmount);

      // Check tokens were transferred to escrow
      const addr2BalanceAfter = await BlockToken.balanceOf(addr2.address);
      const marketplaceBalanceAfter = await BlockToken.balanceOf(
        await marketplace.getAddress()
      );

      expect(addr2BalanceBefore - addr2BalanceAfter).to.eq(offerAmount);
      expect(marketplaceBalanceAfter - marketplaceBalanceBefore).to.eq(
        offerAmount
      );

      // Check offer details
      const offer = await marketplace.getOffer(0);
      expect(offer.listId).to.eq(0);
      expect(offer.offerAmount).to.eq(offerAmount);
      expect(offer.offerrer).to.eq(addr2.address);
    });

    it("Should revert if offer is below minimum offer", async () => {
      const { marketplace, blocknft, addr1, addr2 } = await loadFixture(
        deployBlockMarketPlace
      );

      let tokenId = 1;
      let price = ethers.parseEther("1");
      let lowOffer = ethers.parseEther("0.4"); // Below minOffer of 0.5

      // Setup and list NFT
      await blocknft.connect(addr1).mint(addr1);
      await blocknft
        .connect(addr1)
        .setApprovalForAll(marketplace.getAddress(), true);

      await marketplace.connect(addr1).listNft({
        owner: addr1,
        tokenId: tokenId,
        paymentToken: "0x0000000000000000000000000000000000000000",
        NftToken: blocknft.getAddress(),
        isNative: true,
        price: price,
        sold: false,
        minOffer: ethers.parseEther("0.5"),
      });

      // Try to make low offer
      await expect(
        marketplace.connect(addr2).offer(0, 0, { value: lowOffer })
      ).to.be.revertedWith("Invalid offer");
    });

    it("Should revert if owner tries to make offer", async () => {
      const { marketplace, blocknft, addr1 } = await loadFixture(
        deployBlockMarketPlace
      );

      let tokenId = 1;
      let price = ethers.parseEther("1");
      let offerAmount = ethers.parseEther("0.8");

      // Setup and list NFT
      await blocknft.connect(addr1).mint(addr1);
      await blocknft
        .connect(addr1)
        .setApprovalForAll(marketplace.getAddress(), true);

      await marketplace.connect(addr1).listNft({
        owner: addr1,
        tokenId: tokenId,
        paymentToken: "0x0000000000000000000000000000000000000000",
        NftToken: blocknft.getAddress(),
        isNative: true,
        price: price,
        sold: false,
        minOffer: ethers.parseEther("0.5"),
      });

      // Owner tries to make offer on their own NFT
      await expect(
        marketplace.connect(addr1).offer(0, 0, { value: offerAmount })
      ).to.be.revertedWith("Owner cannot offer");
    });
  });

  describe("Accept Offers", () => {
    it("Should successfully accept ETH offer", async () => {
      const { marketplace, blocknft, owner_, addr1, addr2 } = await loadFixture(
        deployBlockMarketPlace
      );

      let tokenId = 1;
      let price = ethers.parseEther("1");
      let offerAmount = ethers.parseEther("0.8");

      // Setup and list NFT
      await blocknft.connect(addr1).mint(addr1);
      await blocknft
        .connect(addr1)
        .setApprovalForAll(marketplace.getAddress(), true);

      await marketplace.connect(addr1).listNft({
        owner: addr1,
        tokenId: tokenId,
        paymentToken: "0x0000000000000000000000000000000000000000",
        NftToken: blocknft.getAddress(),
        isNative: true,
        price: price,
        sold: false,
        minOffer: ethers.parseEther("0.5"),
      });

      // Make offer
      await marketplace.connect(addr2).offer(0, 0, { value: offerAmount });

      // Get balances before accepting
      const addr1BalanceBefore = await ethers.provider.getBalance(
        addr1.address
      );
      const marketOwnerBalanceBefore = await ethers.provider.getBalance(
        owner_.address
      );

      // Accept offer - get transaction receipt to calculate gas costs
      const tx = await marketplace.connect(addr1).acceptOffer(0);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      // Check NFT transferred to offerer
      expect(await blocknft.ownerOf(tokenId)).to.eq(addr2.address);

      // Check listing marked as sold
      const listing = await marketplace.getListing(0);
      expect(listing.sold).to.be.true;

      // Check offer marked as accepted
      const offer = await marketplace.getOffer(0);
      expect(offer.status).to.be.true;

      // Check payment distribution (accounting for gas costs)
      const expectedSellerAmount = (offerAmount * 97n) / 100n;
      const expectedMarketplaceAmount = (offerAmount * 3n) / 100n;

      const addr1BalanceAfter = await ethers.provider.getBalance(addr1.address);
      const marketOwnerBalanceAfter = await ethers.provider.getBalance(
        owner_.address
      );

      // Fix: Account for gas costs in balance calculation
      expect(addr1BalanceAfter + gasUsed - addr1BalanceBefore).to.eq(
        expectedSellerAmount
      );
      expect(marketOwnerBalanceAfter - marketOwnerBalanceBefore).to.eq(
        expectedMarketplaceAmount
      );
    });

    it("Should successfully accept ERC20 offer (covers lines 120-121)", async () => {
      const { marketplace, blocknft, BlockToken, owner_, addr1, addr2 } =
        await loadFixture(deployBlockMarketPlace);

      let tokenId = 1;
      let price = 1000;
      let offerAmount = 800;

      // Mint tokens to addr2 for offering
      await BlockToken.connect(owner_).mint(10000, addr2.address);
      await BlockToken.connect(addr2).approve(
        await marketplace.getAddress(),
        offerAmount
      );

      // Setup and list NFT for ERC20
      await blocknft.connect(addr1).mint(addr1);
      await blocknft
        .connect(addr1)
        .setApprovalForAll(await marketplace.getAddress(), true);

      await marketplace.connect(addr1).listNft({
        owner: addr1,
        tokenId: tokenId,
        paymentToken: await BlockToken.getAddress(),
        NftToken: await blocknft.getAddress(),
        isNative: false,
        price: price,
        sold: false,
        minOffer: 500,
      });

      // Make ERC20 offer
      await marketplace.connect(addr2).offer(0, offerAmount);

      // Get token balances before accepting
      const addr1TokenBalanceBefore = await BlockToken.balanceOf(addr1.address);
      const marketOwnerTokenBalanceBefore = await BlockToken.balanceOf(
        owner_.address
      );

      // Accept offer - this will execute lines 120-121
      await marketplace.connect(addr1).acceptOffer(0);

      // Check NFT transferred to offerer
      expect(await blocknft.ownerOf(tokenId)).to.eq(addr2.address);

      // Check listing marked as sold
      const listing = await marketplace.getListing(0);
      expect(listing.sold).to.be.true;

      // Check offer marked as accepted
      const offer = await marketplace.getOffer(0);
      expect(offer.status).to.be.true;

      // Check ERC20 token payment distribution (97% to seller, 3% to marketplace)
      const expectedSellerAmount = (offerAmount * 97) / 100;
      const expectedMarketplaceAmount = (offerAmount * 3) / 100;

      const addr1TokenBalanceAfter = await BlockToken.balanceOf(addr1.address);
      const marketOwnerTokenBalanceAfter = await BlockToken.balanceOf(
        owner_.address
      );

      expect(addr1TokenBalanceAfter - addr1TokenBalanceBefore).to.eq(
        expectedSellerAmount
      );
      expect(
        marketOwnerTokenBalanceAfter - marketOwnerTokenBalanceBefore
      ).to.eq(expectedMarketplaceAmount);
    });

    it("Should revert if non-owner tries to accept offer", async () => {
      const { marketplace, blocknft, addr1, addr2, addr3 } = await loadFixture(
        deployBlockMarketPlace
      );

      let tokenId = 1;
      let price = ethers.parseEther("1");
      let offerAmount = ethers.parseEther("0.8");

      // Setup and list NFT
      await blocknft.connect(addr1).mint(addr1);
      await blocknft
        .connect(addr1)
        .setApprovalForAll(marketplace.getAddress(), true);

      await marketplace.connect(addr1).listNft({
        owner: addr1,
        tokenId: tokenId,
        paymentToken: "0x0000000000000000000000000000000000000000",
        NftToken: blocknft.getAddress(),
        isNative: true,
        price: price,
        sold: false,
        minOffer: ethers.parseEther("0.5"),
      });

      // Make offer
      await marketplace.connect(addr2).offer(0, 0, { value: offerAmount });

      // Non-owner tries to accept offer
      await expect(
        marketplace.connect(addr3).acceptOffer(0)
      ).to.be.revertedWith("Unauthorized seller");
    });

    it("Should revert when trying to accept offer on already sold ERC20 listing", async () => {
      const { marketplace, blocknft, BlockToken, owner_, addr1, addr2, addr3 } =
        await loadFixture(deployBlockMarketPlace);

      let tokenId = 1;
      let price = 1000;
      let offerAmount = 800;

      // Setup tokens and NFT
      await BlockToken.connect(owner_).mint(10000, addr2.address);
      await BlockToken.connect(owner_).mint(10000, addr3.address);
      await BlockToken.connect(addr2).approve(
        await marketplace.getAddress(),
        offerAmount
      );
      await BlockToken.connect(addr3).approve(
        await marketplace.getAddress(),
        price
      );

      await blocknft.connect(addr1).mint(addr1);
      await blocknft
        .connect(addr1)
        .setApprovalForAll(await marketplace.getAddress(), true);

      // List NFT for ERC20
      await marketplace.connect(addr1).listNft({
        owner: addr1,
        tokenId: tokenId,
        paymentToken: await BlockToken.getAddress(),
        NftToken: await blocknft.getAddress(),
        isNative: false,
        price: price,
        sold: false,
        minOffer: 500,
      });

      // Make offer
      await marketplace.connect(addr2).offer(0, offerAmount);

      // Someone else buys the NFT directly first
      await marketplace.connect(addr3).buyNft(0);

      // Try to accept offer on already sold item
      await expect(
        marketplace.connect(addr1).acceptOffer(0)
      ).to.be.revertedWith("Already Sold");
    });
  });

  describe("Cancel Offers", () => {
    it("Should successfully cancel ETH offer", async () => {
      const { marketplace, blocknft, addr1, addr2 } = await loadFixture(
        deployBlockMarketPlace
      );

      let tokenId = 1;
      let price = ethers.parseEther("1");
      let offerAmount = ethers.parseEther("0.8");

      // Setup and list NFT
      await blocknft.connect(addr1).mint(addr1);
      await blocknft
        .connect(addr1)
        .setApprovalForAll(marketplace.getAddress(), true);

      await marketplace.connect(addr1).listNft({
        owner: addr1,
        tokenId: tokenId,
        paymentToken: "0x0000000000000000000000000000000000000000",
        NftToken: blocknft.getAddress(),
        isNative: true,
        price: price,
        sold: false,
        minOffer: ethers.parseEther("0.5"),
      });

      // Make offer
      await marketplace.connect(addr2).offer(0, 0, { value: offerAmount });

      // Get balance before canceling
      const addr2BalanceBefore = await ethers.provider.getBalance(
        addr2.address
      );

      // Cancel offer
      const tx = await marketplace.connect(addr2).cancelOffer(0);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      // Check refund (minus gas costs)
      const addr2BalanceAfter = await ethers.provider.getBalance(addr2.address);
      expect(addr2BalanceAfter + gasUsed - addr2BalanceBefore).to.eq(
        offerAmount
      );

      // Check offer deleted
      const offer = await marketplace.getOffer(0);
      expect(offer.offerrer).to.eq(
        "0x0000000000000000000000000000000000000000"
      );
    });

    it("Should successfully cancel ERC20 offer and refund tokens (covers line 139)", async () => {
      const { marketplace, blocknft, BlockToken, owner_, addr1, addr2 } =
        await loadFixture(deployBlockMarketPlace);

      let tokenId = 1;
      let price = 1000;
      let offerAmount = 800;

      // Mint tokens to addr2 for offering
      await BlockToken.connect(owner_).mint(10000, addr2.address);
      await BlockToken.connect(addr2).approve(
        await marketplace.getAddress(),
        offerAmount
      );

      // Setup and list NFT for ERC20
      await blocknft.connect(addr1).mint(addr1);
      await blocknft
        .connect(addr1)
        .setApprovalForAll(await marketplace.getAddress(), true);

      await marketplace.connect(addr1).listNft({
        owner: addr1,
        tokenId: tokenId,
        paymentToken: await BlockToken.getAddress(),
        NftToken: await blocknft.getAddress(),
        isNative: false,
        price: price,
        sold: false,
        minOffer: 500,
      });

      // Make ERC20 offer
      await marketplace.connect(addr2).offer(0, offerAmount);

      // Verify tokens were escrowed
      const addr2BalanceAfterOffer = await BlockToken.balanceOf(addr2.address);
      const marketplaceBalanceAfterOffer = await BlockToken.balanceOf(
        await marketplace.getAddress()
      );

      expect(addr2BalanceAfterOffer).to.eq(10000 - offerAmount);
      expect(marketplaceBalanceAfterOffer).to.eq(offerAmount);

      // Cancel offer - this will execute line 139
      await marketplace.connect(addr2).cancelOffer(0);

      // Check tokens were refunded
      const addr2BalanceAfterCancel = await BlockToken.balanceOf(addr2.address);
      const marketplaceBalanceAfterCancel = await BlockToken.balanceOf(
        await marketplace.getAddress()
      );

      expect(addr2BalanceAfterCancel).to.eq(10000); // Full refund
      expect(marketplaceBalanceAfterCancel).to.eq(0); // Marketplace balance should be 0

      // Check offer was deleted
      const offer = await marketplace.getOffer(0);
      expect(offer.offerrer).to.eq(
        "0x0000000000000000000000000000000000000000"
      );
      expect(offer.offerAmount).to.eq(0);
      expect(offer.listId).to.eq(0);
    });

    it("Should revert if non-offerer tries to cancel", async () => {
      const { marketplace, blocknft, addr1, addr2, addr3 } = await loadFixture(
        deployBlockMarketPlace
      );

      let tokenId = 1;
      let price = ethers.parseEther("1");
      let offerAmount = ethers.parseEther("0.8");

      // Setup and list NFT
      await blocknft.connect(addr1).mint(addr1);
      await blocknft
        .connect(addr1)
        .setApprovalForAll(marketplace.getAddress(), true);

      await marketplace.connect(addr1).listNft({
        owner: addr1,
        tokenId: tokenId,
        paymentToken: "0x0000000000000000000000000000000000000000",
        NftToken: blocknft.getAddress(),
        isNative: true,
        price: price,
        sold: false,
        minOffer: ethers.parseEther("0.5"),
      });

      // Make offer
      await marketplace.connect(addr2).offer(0, 0, { value: offerAmount });

      // Non-offerer tries to cancel
      await expect(
        marketplace.connect(addr3).cancelOffer(0)
      ).to.be.revertedWith("Unauthorized offerrer");
    });

    it("Should revert when trying to cancel already accepted ERC20 offer", async () => {
      const { marketplace, blocknft, BlockToken, owner_, addr1, addr2 } =
        await loadFixture(deployBlockMarketPlace);

      let tokenId = 1;
      let price = 1000;
      let offerAmount = 800;

      // Setup tokens and NFT
      await BlockToken.connect(owner_).mint(10000, addr2.address);
      await BlockToken.connect(addr2).approve(
        await marketplace.getAddress(),
        offerAmount
      );

      await blocknft.connect(addr1).mint(addr1);
      await blocknft
        .connect(addr1)
        .setApprovalForAll(await marketplace.getAddress(), true);

      // List NFT for ERC20
      await marketplace.connect(addr1).listNft({
        owner: addr1,
        tokenId: tokenId,
        paymentToken: await BlockToken.getAddress(),
        NftToken: await blocknft.getAddress(),
        isNative: false,
        price: price,
        sold: false,
        minOffer: 500,
      });

      // Make and accept offer
      await marketplace.connect(addr2).offer(0, offerAmount);
      await marketplace.connect(addr1).acceptOffer(0);

      // Try to cancel already accepted offer
      await expect(
        marketplace.connect(addr2).cancelOffer(0)
      ).to.be.revertedWith("Offer already accepted");
    });
  });

  describe("Cancel Listing", () => {
    it("Should successfully cancel listing", async () => {
      const { marketplace, blocknft, addr1 } = await loadFixture(
        deployBlockMarketPlace
      );

      let tokenId = 1;
      let price = ethers.parseEther("1");

      // Setup and list NFT
      await blocknft.connect(addr1).mint(addr1);
      await blocknft
        .connect(addr1)
        .setApprovalForAll(await marketplace.getAddress(), true);

      await marketplace.connect(addr1).listNft({
        owner: addr1,
        tokenId: tokenId,
        paymentToken: "0x0000000000000000000000000000000000000000",
        NftToken: await blocknft.getAddress(),
        isNative: true,
        price: price,
        sold: false,
        minOffer: ethers.parseEther("0.5"),
      });

      // Verify NFT is in marketplace
      expect(await blocknft.ownerOf(tokenId)).to.eq(
        await marketplace.getAddress()
      );

      // Cancel listing
      await marketplace.connect(addr1).cancelListing(0);

      // Check NFT returned to owner
      expect(await blocknft.ownerOf(tokenId)).to.eq(addr1.address);

      // Check listing deleted
      const listing = await marketplace.getListing(0);
      expect(listing.owner).to.eq("0x0000000000000000000000000000000000000000");
    });

    it("Should revert if non-owner tries to cancel listing", async () => {
      const { marketplace, blocknft, addr1, addr2 } = await loadFixture(
        deployBlockMarketPlace
      );

      let tokenId = 1;
      let price = ethers.parseEther("1");

      // Setup and list NFT
      await blocknft.connect(addr1).mint(addr1);
      await blocknft
        .connect(addr1)
        .setApprovalForAll(marketplace.getAddress(), true);

      await marketplace.connect(addr1).listNft({
        owner: addr1,
        tokenId: tokenId,
        paymentToken: "0x0000000000000000000000000000000000000000",
        NftToken: blocknft.getAddress(),
        isNative: true,
        price: price,
        sold: false,
        minOffer: ethers.parseEther("0.5"),
      });

      // Non-owner tries to cancel
      await expect(
        marketplace.connect(addr2).cancelListing(0)
      ).to.be.revertedWith("Unauthorized user");
    });

    it("Should revert if trying to cancel already sold listing", async () => {
      const { marketplace, blocknft, addr1, addr2 } = await loadFixture(
        deployBlockMarketPlace
      );

      let tokenId = 1;
      let price = ethers.parseEther("1");

      // Setup and list NFT
      await blocknft.connect(addr1).mint(addr1);
      await blocknft
        .connect(addr1)
        .setApprovalForAll(marketplace.getAddress(), true);

      await marketplace.connect(addr1).listNft({
        owner: addr1,
        tokenId: tokenId,
        paymentToken: "0x0000000000000000000000000000000000000000",
        NftToken: blocknft.getAddress(),
        isNative: true,
        price: price,
        sold: false,
        minOffer: ethers.parseEther("0.5"),
      });

      // Buy the NFT
      await marketplace.connect(addr2).buyNft(0, { value: price });

      // Try to cancel already sold listing
      await expect(
        marketplace.connect(addr1).cancelListing(0)
      ).to.be.revertedWith("Already sold");
    });
  });
});
