// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {
    ILayerZeroEndpointV2,
    MessagingFee,
    MessagingParams,
    MessagingReceipt
} from "../src/interfaces/ILayerZeroEndpointV2.sol";

/// @dev Minimal LZ V2 endpoint mock untuk Foundry test PulseSender.
contract MockLzEndpoint is ILayerZeroEndpointV2 {
    uint32 public immutable mockEid;
    uint256 public nativeFee = 0.001 ether;
    uint64 public nonceCounter;
    address public delegate;

    event Sent(uint32 dstEid, bytes32 receiver, bytes message, bytes options, uint256 fee);
    event DelegateSet(address delegate);

    constructor(uint32 eid_) {
        mockEid = eid_;
    }

    function setFee(uint256 newFee) external {
        nativeFee = newFee;
    }

    function eid() external view returns (uint32) {
        return mockEid;
    }

    function quote(
        MessagingParams calldata,
        address
    ) external view returns (MessagingFee memory fee) {
        fee.nativeFee = nativeFee;
        fee.lzTokenFee = 0;
    }

    function send(
        MessagingParams calldata params,
        address
    ) external payable returns (MessagingReceipt memory receipt) {
        require(msg.value >= nativeFee, "MockEndpoint: fee");
        nonceCounter++;
        receipt.guid = keccak256(
            abi.encodePacked(block.chainid, params.dstEid, params.receiver, nonceCounter)
        );
        receipt.nonce = nonceCounter;
        receipt.fee.nativeFee = nativeFee;
        emit Sent(params.dstEid, params.receiver, params.message, params.options, nativeFee);
    }

    function setDelegate(address newDelegate) external {
        delegate = newDelegate;
        emit DelegateSet(newDelegate);
    }
}
