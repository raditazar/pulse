// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

import {
    ILayerZeroEndpointV2,
    MessagingFee,
    MessagingParams,
    MessagingReceipt
} from "./interfaces/ILayerZeroEndpointV2.sol";

/// @title PulseSender — minimal LayerZero V2 OApp Sender untuk Pulse cross-chain payment intent.
/// @notice User EVM `approve(usdc, this)` lalu call `pay(...)` untuk:
///         1. Pull `amount` mock USDC ke contract ini (treasury sender, untuk rekonsiliasi).
///         2. Encode 64-byte `PulseLzPayload` (sessionId | amount | payer | sourceEid).
///         3. `_lzSend` ke Solana OApp peer di EID 40168.
///
///         Tidak ada bridging actual — Solana side (trusted relayer) yang akan release
///         devnet USDC dari treasury Pulse setelah index event LZ.
contract PulseSender is Ownable {
    using SafeERC20 for IERC20;

    // ------------------------------------------------------------------
    // Constants
    // ------------------------------------------------------------------

    /// @notice Fixed payload length (matches Solana `PulseLzPayload` codec).
    uint256 public constant PULSE_PAYLOAD_LEN = 64;

    /// @notice Default Solana destination EID (LayerZero V2 Solana Devnet).
    uint32 public constant DEFAULT_SOLANA_DEVNET_EID = 40168;

    // ------------------------------------------------------------------
    // State
    // ------------------------------------------------------------------

    ILayerZeroEndpointV2 public immutable endpoint;
    /// @notice EID dari chain ini (di-cache saat constructor — tidak perlu call endpoint.eid() tiap pay).
    uint32 public immutable srcEid;
    IERC20 public immutable mockUsdc;

    /// @notice Peer Solana OApp (32-byte program ID, big-endian Pubkey bytes).
    mapping(uint32 dstEid => bytes32 peer) public peers;

    /// @notice Default LZ Options blob untuk Executor — set oleh owner, dipakai jika
    ///         user tidak pass options sendiri. Berisi gas + value untuk lz_receive
    ///         di Solana side (compute units, etc.).
    bytes public defaultOptions;

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    event PaymentIntentSent(
        bytes32 indexed sessionId,
        uint32 indexed dstEid,
        address indexed payer,
        uint256 amount,
        bytes32 guid,
        uint64 nonce
    );

    event PeerSet(uint32 indexed eid, bytes32 peer);
    event DefaultOptionsSet(bytes options);

    // ------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------

    error InvalidAmount();
    error InvalidSessionId();
    error PeerNotSet(uint32 dstEid);
    error InsufficientNativeFee(uint256 paid, uint256 required);
    error RefundFailed();

    // ------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------

    constructor(address endpoint_, address mockUsdc_, address initialOwner) Ownable(initialOwner) {
        endpoint = ILayerZeroEndpointV2(endpoint_);
        mockUsdc = IERC20(mockUsdc_);
        srcEid = ILayerZeroEndpointV2(endpoint_).eid();

        // Endpoint butuh delegate untuk config OApp dari owner (set_send_library, dll.).
        ILayerZeroEndpointV2(endpoint_).setDelegate(initialOwner);
    }

    // ------------------------------------------------------------------
    // Owner setters
    // ------------------------------------------------------------------

    function setPeer(uint32 dstEid, bytes32 peer) external onlyOwner {
        peers[dstEid] = peer;
        emit PeerSet(dstEid, peer);
    }

    function setDefaultOptions(bytes calldata options) external onlyOwner {
        defaultOptions = options;
        emit DefaultOptionsSet(options);
    }

    function setDelegate(address newDelegate) external onlyOwner {
        endpoint.setDelegate(newDelegate);
    }

    /// @notice Owner withdraw mock USDC yang terakumulasi (rekonsiliasi vs Solana treasury).
    function withdrawUsdc(address to, uint256 amount) external onlyOwner {
        mockUsdc.safeTransfer(to, amount);
    }

    // ------------------------------------------------------------------
    // Pay
    // ------------------------------------------------------------------

    /// @notice Quote native fee untuk send PaymentIntent ke `dstEid`.
    function quotePay(
        uint32 dstEid,
        bytes32 sessionId,
        uint256 amount,
        bytes calldata options
    ) external view returns (MessagingFee memory fee) {
        bytes memory message = _encodePayload(sessionId, amount, msg.sender, srcEid);
        bytes32 receiver = peers[dstEid];
        if (receiver == bytes32(0)) revert PeerNotSet(dstEid);

        bytes memory opts = _resolveOptions(options);
        MessagingParams memory params = MessagingParams({
            dstEid: dstEid,
            receiver: receiver,
            message: message,
            options: opts,
            payInLzToken: false
        });
        return endpoint.quote(params, address(this));
    }

    /// @notice Kirim PaymentIntent ke Solana via LayerZero V2.
    /// @param dstEid LayerZero destination EID (40168 = Solana Devnet).
    /// @param sessionId 32-byte session id (sama dengan PaymentSession PDA seed).
    /// @param amount Mock USDC amount (6 decimals).
    /// @param options LZ Executor options. Kosongkan untuk pakai `defaultOptions`.
    function pay(
        uint32 dstEid,
        bytes32 sessionId,
        uint256 amount,
        bytes calldata options
    ) external payable returns (MessagingReceipt memory receipt) {
        if (amount == 0) revert InvalidAmount();
        if (amount > type(uint64).max) revert InvalidAmount(); // payload pakai u64
        if (sessionId == bytes32(0)) revert InvalidSessionId();

        bytes32 receiver = peers[dstEid];
        if (receiver == bytes32(0)) revert PeerNotSet(dstEid);

        // 1. Pull mock USDC dari user (require approve sebelumnya).
        mockUsdc.safeTransferFrom(msg.sender, address(this), amount);

        // 2. Encode payload 64 bytes.
        bytes memory message = _encodePayload(sessionId, amount, msg.sender, srcEid);

        // 3. Build params & send.
        bytes memory opts = _resolveOptions(options);
        MessagingParams memory params = MessagingParams({
            dstEid: dstEid,
            receiver: receiver,
            message: message,
            options: opts,
            payInLzToken: false
        });

        MessagingFee memory fee = endpoint.quote(params, address(this));
        if (msg.value < fee.nativeFee) revert InsufficientNativeFee(msg.value, fee.nativeFee);

        receipt = endpoint.send{ value: fee.nativeFee }(params, msg.sender);

        // 4. Refund excess native (msg.value - fee.nativeFee) kembali ke msg.sender.
        uint256 refund = msg.value - fee.nativeFee;
        if (refund > 0) {
            (bool ok, ) = payable(msg.sender).call{ value: refund }("");
            if (!ok) revert RefundFailed();
        }

        emit PaymentIntentSent(sessionId, dstEid, msg.sender, amount, receipt.guid, receipt.nonce);
    }

    // ------------------------------------------------------------------
    // Internal
    // ------------------------------------------------------------------

    /// @dev Pilih options: jika user pass non-empty, copy calldata→memory; jika kosong,
    ///      fallback ke `defaultOptions` (storage→memory copy).
    function _resolveOptions(bytes calldata options) internal view returns (bytes memory) {
        if (options.length > 0) {
            return options;
        }
        return defaultOptions;
    }

    /// @dev Encode `PulseLzPayload` — must match Rust `payload_codec::PulseLzPayload`
    ///      (Solana side) byte-for-byte.
    ///
    /// Layout (64 bytes, BE):
    ///   [0..32)   session_id  (32 bytes, raw)
    ///   [32..40)  amount      (u64 BE)
    ///   [40..60)  payer       (EVM address, 20 bytes)
    ///   [60..64)  source_eid  (u32 BE)
    function _encodePayload(
        bytes32 sessionId,
        uint256 amount,
        address payer,
        uint32 sourceEid
    ) internal pure returns (bytes memory) {
        // abi.encodePacked dengan urutan + tipe yang tepat menghasilkan 32 + 8 + 20 + 4 = 64 bytes.
        bytes memory packed = abi.encodePacked(
            sessionId,
            uint64(amount),
            bytes20(payer),
            sourceEid
        );
        // Defensive: sanity check length (compile-time pattern, runtime cheap).
        require(packed.length == PULSE_PAYLOAD_LEN, "Pulse: payload length mismatch");
        return packed;
    }
}
