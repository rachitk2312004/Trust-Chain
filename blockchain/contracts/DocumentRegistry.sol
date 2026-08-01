// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title DocumentRegistry
 * @notice Single TrustChain registry for org registration, document anchoring, and revocation.
 * @dev On-chain payload is intentionally minimal — never store file bytes.
 *      Stored fields: orgId, documentId, contentHash (SHA-256), version, timestamp, revoked flag.
 *      Networks: Hardhat (local) and Sepolia only for Wave 3.
 */
contract DocumentRegistry {
    struct Organization {
        bytes32 orgId;
        address owner;
        uint64 registeredAt;
        bool exists;
    }

    struct DocumentAnchor {
        bytes32 orgId;
        bytes32 documentId;
        bytes32 contentHash;
        uint32 versionNumber;
        uint64 anchoredAt;
        bool revoked;
        uint64 revokedAt;
        bool exists;
    }

    address public admin;

    mapping(bytes32 => Organization) public organizations;
    /// @dev key = keccak256(abi.encodePacked(orgId, documentId, versionNumber))
    mapping(bytes32 => DocumentAnchor) public anchors;

    event OrganizationRegistered(
        bytes32 indexed orgId,
        address indexed owner,
        uint64 timestamp
    );

    event DocumentAnchored(
        bytes32 indexed orgId,
        bytes32 indexed documentId,
        bytes32 contentHash,
        uint32 versionNumber,
        uint64 timestamp
    );

    event DocumentRevoked(
        bytes32 indexed orgId,
        bytes32 indexed documentId,
        uint32 versionNumber,
        uint64 timestamp
    );

    error NotAdmin();
    error NotOrgOwner();
    error OrgAlreadyRegistered();
    error OrgNotRegistered();
    error AlreadyAnchored();
    error AnchorNotFound();
    error AlreadyRevoked();
    error ZeroAddress();
    error ZeroId();
    error ZeroHash();
    error InvalidVersion();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert ZeroAddress();
        admin = newAdmin;
    }

    /**
     * @notice Register an organization. Admin (relayer) registers on behalf of tenants.
     */
    function registerOrganization(bytes32 orgId, address owner) external onlyAdmin {
        if (orgId == bytes32(0)) revert ZeroId();
        if (owner == address(0)) revert ZeroAddress();
        if (organizations[orgId].exists) revert OrgAlreadyRegistered();

        uint64 ts = uint64(block.timestamp);
        organizations[orgId] = Organization({
            orgId: orgId,
            owner: owner,
            registeredAt: ts,
            exists: true
        });

        emit OrganizationRegistered(orgId, owner, ts);
    }

    /**
     * @notice Anchor a document version hash. Callable by admin (relayer) or org owner.
     */
    function anchorDocument(
        bytes32 orgId,
        bytes32 documentId,
        bytes32 contentHash,
        uint32 versionNumber
    ) external {
        Organization storage org = organizations[orgId];
        if (!org.exists) revert OrgNotRegistered();
        if (msg.sender != admin && msg.sender != org.owner) revert NotOrgOwner();
        if (documentId == bytes32(0)) revert ZeroId();
        if (contentHash == bytes32(0)) revert ZeroHash();
        if (versionNumber == 0) revert InvalidVersion();

        bytes32 key = anchorKey(orgId, documentId, versionNumber);
        if (anchors[key].exists) revert AlreadyAnchored();

        uint64 ts = uint64(block.timestamp);
        anchors[key] = DocumentAnchor({
            orgId: orgId,
            documentId: documentId,
            contentHash: contentHash,
            versionNumber: versionNumber,
            anchoredAt: ts,
            revoked: false,
            revokedAt: 0,
            exists: true
        });

        emit DocumentAnchored(orgId, documentId, contentHash, versionNumber, ts);
    }

    /**
     * @notice Revoke an anchored document version. Callable by admin or org owner.
     */
    function revokeDocument(
        bytes32 orgId,
        bytes32 documentId,
        uint32 versionNumber
    ) external {
        Organization storage org = organizations[orgId];
        if (!org.exists) revert OrgNotRegistered();
        if (msg.sender != admin && msg.sender != org.owner) revert NotOrgOwner();

        bytes32 key = anchorKey(orgId, documentId, versionNumber);
        DocumentAnchor storage anchor = anchors[key];
        if (!anchor.exists) revert AnchorNotFound();
        if (anchor.revoked) revert AlreadyRevoked();

        uint64 ts = uint64(block.timestamp);
        anchor.revoked = true;
        anchor.revokedAt = ts;

        emit DocumentRevoked(orgId, documentId, versionNumber, ts);
    }

    function getOrganization(bytes32 orgId) external view returns (Organization memory) {
        return organizations[orgId];
    }

    function getAnchor(
        bytes32 orgId,
        bytes32 documentId,
        uint32 versionNumber
    ) external view returns (DocumentAnchor memory) {
        return anchors[anchorKey(orgId, documentId, versionNumber)];
    }

    function isRevoked(
        bytes32 orgId,
        bytes32 documentId,
        uint32 versionNumber
    ) external view returns (bool) {
        DocumentAnchor storage anchor = anchors[anchorKey(orgId, documentId, versionNumber)];
        return anchor.exists && anchor.revoked;
    }

    function anchorKey(
        bytes32 orgId,
        bytes32 documentId,
        uint32 versionNumber
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(orgId, documentId, versionNumber));
    }
}
