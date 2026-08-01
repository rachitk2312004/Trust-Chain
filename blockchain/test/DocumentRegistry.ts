import { expect } from "chai";
import { ethers } from "hardhat";
import { DocumentRegistry } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("DocumentRegistry", () => {
  let registry: DocumentRegistry;
  let _admin: HardhatEthersSigner;
  let orgOwner: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  const orgId = ethers.id("org-uuid-1");
  const documentId = ethers.id("doc-uuid-1");
  const contentHash = ethers.id("sha256-content");

  beforeEach(async () => {
    [_admin, orgOwner, stranger] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("DocumentRegistry");
    registry = (await factory.deploy()) as unknown as DocumentRegistry;
    await registry.waitForDeployment();
  });

  it("registers an organization", async () => {
    await expect(registry.registerOrganization(orgId, orgOwner.address))
      .to.emit(registry, "OrganizationRegistered")
      .withArgs(orgId, orgOwner.address, (ts: bigint) => ts > 0n);

    const org = await registry.getOrganization(orgId);
    expect(org.exists).to.equal(true);
    expect(org.owner).to.equal(orgOwner.address);
  });

  it("rejects duplicate organization registration", async () => {
    await registry.registerOrganization(orgId, orgOwner.address);
    await expect(
      registry.registerOrganization(orgId, orgOwner.address),
    ).to.be.revertedWithCustomError(registry, "OrgAlreadyRegistered");
  });

  it("rejects non-admin organization registration", async () => {
    await expect(
      registry.connect(stranger).registerOrganization(orgId, orgOwner.address),
    ).to.be.revertedWithCustomError(registry, "NotAdmin");
  });

  it("anchors a document version", async () => {
    await registry.registerOrganization(orgId, orgOwner.address);

    await expect(registry.anchorDocument(orgId, documentId, contentHash, 1))
      .to.emit(registry, "DocumentAnchored")
      .withArgs(orgId, documentId, contentHash, 1, (ts: bigint) => ts > 0n);

    const anchor = await registry.getAnchor(orgId, documentId, 1);
    expect(anchor.exists).to.equal(true);
    expect(anchor.contentHash).to.equal(contentHash);
    expect(anchor.revoked).to.equal(false);
  });

  it("allows org owner to anchor", async () => {
    await registry.registerOrganization(orgId, orgOwner.address);
    await expect(
      registry.connect(orgOwner).anchorDocument(orgId, documentId, contentHash, 1),
    ).to.emit(registry, "DocumentAnchored");
  });

  it("rejects stranger anchor", async () => {
    await registry.registerOrganization(orgId, orgOwner.address);
    await expect(
      registry.connect(stranger).anchorDocument(orgId, documentId, contentHash, 1),
    ).to.be.revertedWithCustomError(registry, "NotOrgOwner");
  });

  it("rejects duplicate anchor for same version", async () => {
    await registry.registerOrganization(orgId, orgOwner.address);
    await registry.anchorDocument(orgId, documentId, contentHash, 1);
    await expect(
      registry.anchorDocument(orgId, documentId, contentHash, 1),
    ).to.be.revertedWithCustomError(registry, "AlreadyAnchored");
  });

  it("revokes an anchored document", async () => {
    await registry.registerOrganization(orgId, orgOwner.address);
    await registry.anchorDocument(orgId, documentId, contentHash, 1);

    await expect(registry.revokeDocument(orgId, documentId, 1))
      .to.emit(registry, "DocumentRevoked")
      .withArgs(orgId, documentId, 1, (ts: bigint) => ts > 0n);

    expect(await registry.isRevoked(orgId, documentId, 1)).to.equal(true);
    const anchor = await registry.getAnchor(orgId, documentId, 1);
    expect(anchor.revoked).to.equal(true);
  });

  it("rejects double revoke", async () => {
    await registry.registerOrganization(orgId, orgOwner.address);
    await registry.anchorDocument(orgId, documentId, contentHash, 1);
    await registry.revokeDocument(orgId, documentId, 1);
    await expect(registry.revokeDocument(orgId, documentId, 1)).to.be.revertedWithCustomError(
      registry,
      "AlreadyRevoked",
    );
  });

  it("does not store file bytes — only hash fields", async () => {
    await registry.registerOrganization(orgId, orgOwner.address);
    await registry.anchorDocument(orgId, documentId, contentHash, 1);
    const anchor = await registry.getAnchor(orgId, documentId, 1);
    expect(anchor.contentHash).to.equal(contentHash);
    expect(anchor.orgId).to.equal(orgId);
    expect(anchor.documentId).to.equal(documentId);
    expect(anchor.versionNumber).to.equal(1);
  });
});
