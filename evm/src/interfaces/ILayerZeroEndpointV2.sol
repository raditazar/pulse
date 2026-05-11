// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/// @notice Minimal LayerZero V2 Endpoint interface — hanya bagian yang dipakai Pulse Sender.
/// Source-of-truth: https://github.com/LayerZero-Labs/LayerZero-v2 (packages/layerzero-v2/evm/protocol).
struct MessagingParams {
    uint32 dstEid;
    bytes32 receiver;
    bytes message;
    bytes options;
    bool payInLzToken;
}

struct MessagingFee {
    uint256 nativeFee;
    uint256 lzTokenFee;
}

struct MessagingReceipt {
    bytes32 guid;
    uint64 nonce;
    MessagingFee fee;
}

interface ILayerZeroEndpointV2 {
    function send(
        MessagingParams calldata _params,
        address _refundAddress
    ) external payable returns (MessagingReceipt memory);

    function quote(
        MessagingParams calldata _params,
        address _sender
    ) external view returns (MessagingFee memory);

    function setDelegate(address _delegate) external;

    function eid() external view returns (uint32);
}
