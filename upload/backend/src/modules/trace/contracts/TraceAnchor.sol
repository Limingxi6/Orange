// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title TraceAnchor - minimal EVM anchor contract for trace proof hashes
/// @notice Stores only minimal metadata (traceCode + proofHash). Raw business snapshots remain off-chain.
contract TraceAnchor {
    struct AnchorRecord {
        string traceCode;
        string proofHash;
        uint256 anchoredAt;
        address operator;
    }

    address private _owner;
    mapping(address => bool) private authorizedWriters;
    mapping(string => AnchorRecord) private anchors;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event WriterAuthorizationUpdated(address indexed writer, bool authorized);

    event TraceAnchored(
        string traceCode,
        string proofHash,
        uint256 anchoredAt,
        address indexed operator
    );

    modifier onlyOwner() {
        require(msg.sender == _owner, "only owner");
        _;
    }

    modifier onlyWriter() {
        require(msg.sender == _owner || authorizedWriters[msg.sender], "only owner or writer");
        _;
    }

    constructor(address initialOwner) {
        address resolvedOwner = initialOwner == address(0) ? msg.sender : initialOwner;
        _transferOwnership(resolvedOwner);
    }

    function owner() external view returns (address) {
        return _owner;
    }

    function isWriter(address account) external view returns (bool) {
        return account == _owner || authorizedWriters[account];
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero owner");
        _transferOwnership(newOwner);
    }

    function setWriter(address writer, bool authorized) external onlyOwner {
        require(writer != address(0), "zero writer");
        authorizedWriters[writer] = authorized;
        emit WriterAuthorizationUpdated(writer, authorized);
    }

    /// @dev Strategy A (append-once): each traceCode can be anchored exactly once.
    /// This better matches evidence immutability semantics for PoC digital notarization.
    function anchorTrace(
        string calldata traceCode,
        string calldata proofHash
    ) external onlyWriter {
        require(bytes(traceCode).length > 0, "empty traceCode");
        require(bytes(proofHash).length > 0, "empty proofHash");
        require(anchors[traceCode].anchoredAt == 0, "trace already anchored");

        uint256 anchoredAt = block.timestamp;
        anchors[traceCode] = AnchorRecord({
            traceCode: traceCode,
            proofHash: proofHash,
            anchoredAt: anchoredAt,
            operator: msg.sender
        });

        emit TraceAnchored(traceCode, proofHash, anchoredAt, msg.sender);
    }

    function exists(string calldata traceCode) external view returns (bool) {
        return anchors[traceCode].anchoredAt != 0;
    }

    function getAnchor(
        string calldata traceCode
    ) external view returns (string memory, string memory, uint256, address) {
        require(bytes(traceCode).length > 0, "empty traceCode");
        AnchorRecord memory record = anchors[traceCode];
        require(record.anchoredAt != 0, "anchor not found");

        return (record.traceCode, record.proofHash, record.anchoredAt, record.operator);
    }

    function getAnchorRecord(
        string calldata traceCode
    ) external view returns (AnchorRecord memory) {
        require(bytes(traceCode).length > 0, "empty traceCode");
        AnchorRecord memory record = anchors[traceCode];
        require(record.anchoredAt != 0, "anchor not found");
        return record;
    }

    function _transferOwnership(address newOwner) private {
        address previousOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }
}
