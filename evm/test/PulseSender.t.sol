// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Test, Vm } from "forge-std/Test.sol";
import { MockUSDC } from "../src/MockUSDC.sol";
import { PulseSender } from "../src/PulseSender.sol";
import { MockLzEndpoint } from "./MockLzEndpoint.sol";
import {
    MessagingFee,
    MessagingReceipt
} from "../src/interfaces/ILayerZeroEndpointV2.sol";

contract PulseSenderTest is Test {
    MockUSDC internal usdc;
    PulseSender internal sender;
    MockLzEndpoint internal endpoint;

    address internal owner = address(0xA11CE);
    address internal payer = address(0xCAFE);

    uint32 internal constant SRC_EID = 40245; // Base Sepolia
    uint32 internal constant DST_EID = 40168; // Solana Devnet

    bytes32 internal constant SOLANA_PEER =
        bytes32(0x8b6a8c2b4f1d3a5e6c7b8a9d0e1f2a3b4c5d6e7f8091a2b3c4d5e6f708192a3b);

    event PaymentIntentSent(
        bytes32 indexed sessionId,
        uint32 indexed dstEid,
        address indexed payer,
        uint256 amount,
        bytes32 guid,
        uint64 nonce
    );

    function setUp() public {
        vm.startPrank(owner);
        usdc = new MockUSDC(owner);
        endpoint = new MockLzEndpoint(SRC_EID);
        sender = new PulseSender(address(endpoint), address(usdc), owner);
        sender.setPeer(DST_EID, SOLANA_PEER);
        sender.setDefaultOptions(hex"0003");
        vm.stopPrank();

        vm.prank(owner);
        usdc.ownerMint(payer, 10_000 * 1e6);
        vm.deal(payer, 1 ether);
    }

    function test_constructor_sets_state() public view {
        assertEq(address(sender.endpoint()), address(endpoint));
        assertEq(address(sender.mockUsdc()), address(usdc));
        assertEq(sender.srcEid(), SRC_EID);
        assertEq(sender.peers(DST_EID), SOLANA_PEER);
        assertEq(endpoint.delegate(), owner);
    }

    function test_pay_emits_event_and_pulls_usdc() public {
        bytes32 sessionId = bytes32(uint256(42));
        uint256 amount = 100 * 1e6;

        uint256 payerUsdcBefore = usdc.balanceOf(payer);
        uint256 contractUsdcBefore = usdc.balanceOf(address(sender));

        vm.startPrank(payer);
        usdc.approve(address(sender), amount);

        vm.expectEmit(true, true, true, false, address(sender));
        emit PaymentIntentSent(sessionId, DST_EID, payer, amount, bytes32(0), 0);

        sender.pay{ value: 0.01 ether }(DST_EID, sessionId, amount, "");
        vm.stopPrank();

        assertEq(usdc.balanceOf(payer), payerUsdcBefore - amount);
        assertEq(usdc.balanceOf(address(sender)), contractUsdcBefore + amount);
    }

    function test_pay_payload_encoding_matches_64_byte_layout() public {
        bytes32 sessionId = bytes32(
            0xaabbccddeeff00112233445566778899aabbccddeeff00112233445566778899
        );
        uint256 amount = 7_777_777;

        vm.startPrank(payer);
        usdc.approve(address(sender), amount);

        vm.recordLogs();
        sender.pay{ value: 0.01 ether }(DST_EID, sessionId, amount, "");
        vm.stopPrank();

        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 sentSig = keccak256("Sent(uint32,bytes32,bytes,bytes,uint256)");
        bytes memory message;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(endpoint) && logs[i].topics[0] == sentSig) {
                (, , message, , ) = abi.decode(logs[i].data, (uint32, bytes32, bytes, bytes, uint256));
                break;
            }
        }
        require(message.length == 64, "payload must be 64 bytes");

        // Verifikasi 4 region: session_id [0..32), amount [32..40), payer [40..60), source_eid [60..64).
        for (uint256 i = 0; i < 32; i++) {
            assertEq(uint8(message[i]), uint8(sessionId[i]), "session_id byte mismatch");
        }

        uint64 decodedAmount = 0;
        for (uint256 i = 0; i < 8; i++) {
            decodedAmount = (decodedAmount << 8) | uint8(message[32 + i]);
        }
        assertEq(uint256(decodedAmount), amount, "amount mismatch");

        address decodedPayer;
        assembly {
            // payer ada di offset 40 dari message data (mload setelah length prefix +32).
            decodedPayer := shr(96, mload(add(message, 72)))
        }
        assertEq(decodedPayer, payer, "payer mismatch");

        uint32 decodedEid = 0;
        for (uint256 i = 0; i < 4; i++) {
            decodedEid = (decodedEid << 8) | uint8(message[60 + i]);
        }
        assertEq(uint256(decodedEid), uint256(SRC_EID), "source_eid mismatch");
    }

    function test_pay_refunds_excess_native() public {
        bytes32 sessionId = bytes32(uint256(1));
        uint256 amount = 50 * 1e6;
        uint256 overpay = 0.5 ether;

        vm.startPrank(payer);
        usdc.approve(address(sender), amount);
        uint256 balBefore = payer.balance;
        sender.pay{ value: overpay }(DST_EID, sessionId, amount, "");
        uint256 balAfter = payer.balance;
        vm.stopPrank();

        uint256 spent = balBefore - balAfter;
        assertEq(spent, endpoint.nativeFee(), "should only pay nativeFee, rest refunded");
    }

    function test_pay_reverts_when_amount_zero() public {
        vm.prank(payer);
        vm.expectRevert(PulseSender.InvalidAmount.selector);
        sender.pay{ value: 0.01 ether }(DST_EID, bytes32(uint256(1)), 0, "");
    }

    function test_pay_reverts_when_session_zero() public {
        vm.prank(payer);
        vm.expectRevert(PulseSender.InvalidSessionId.selector);
        sender.pay{ value: 0.01 ether }(DST_EID, bytes32(0), 100, "");
    }

    function test_pay_reverts_when_peer_not_set() public {
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(PulseSender.PeerNotSet.selector, uint32(99999)));
        sender.pay{ value: 0.01 ether }(99999, bytes32(uint256(1)), 100, "");
    }

    function test_pay_reverts_when_insufficient_fee() public {
        bytes32 sessionId = bytes32(uint256(1));
        uint256 amount = 50 * 1e6;

        vm.startPrank(payer);
        usdc.approve(address(sender), amount);
        vm.expectRevert(
            abi.encodeWithSelector(
                PulseSender.InsufficientNativeFee.selector,
                uint256(0),
                endpoint.nativeFee()
            )
        );
        sender.pay{ value: 0 }(DST_EID, sessionId, amount, "");
        vm.stopPrank();
    }

    function test_pay_amount_above_u64_reverts() public {
        uint256 huge = uint256(type(uint64).max) + 1;
        vm.prank(payer);
        vm.expectRevert(PulseSender.InvalidAmount.selector);
        sender.pay{ value: 0.01 ether }(DST_EID, bytes32(uint256(1)), huge, "");
    }

    function test_setPeer_only_owner() public {
        vm.prank(payer);
        vm.expectRevert();
        sender.setPeer(DST_EID, bytes32(uint256(1)));

        vm.prank(owner);
        sender.setPeer(DST_EID, bytes32(uint256(123)));
        assertEq(sender.peers(DST_EID), bytes32(uint256(123)));
    }

    function test_withdrawUsdc_only_owner() public {
        vm.startPrank(payer);
        usdc.approve(address(sender), 100 * 1e6);
        sender.pay{ value: 0.01 ether }(DST_EID, bytes32(uint256(1)), 100 * 1e6, "");
        vm.stopPrank();

        assertEq(usdc.balanceOf(address(sender)), 100 * 1e6);

        vm.prank(payer);
        vm.expectRevert();
        sender.withdrawUsdc(payer, 100 * 1e6);

        vm.prank(owner);
        sender.withdrawUsdc(owner, 100 * 1e6);
        assertEq(usdc.balanceOf(owner), 100 * 1e6);
    }

    function test_quotePay_returns_endpoint_fee() public view {
        MessagingFee memory fee = sender.quotePay(DST_EID, bytes32(uint256(1)), 100, "");
        assertEq(fee.nativeFee, endpoint.nativeFee());
    }
}
