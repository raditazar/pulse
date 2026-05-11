// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Script, console2 } from "forge-std/Script.sol";
import { PulseSender } from "../src/PulseSender.sol";

/// @notice Set Solana OApp peer pada PulseSender. Requires env:
///   PRIVATE_KEY, PULSE_SENDER (alamat sender), DST_EID (40168 untuk Solana Devnet),
///   PEER_BYTES32 (Solana OApp Store PDA bytes32, big-endian).
///
/// Solana side: derive Store PDA dari program `pulse_lz_oapp` (seed `Store`), lalu pakai
/// 32-byte raw pubkey-nya sebagai PEER_BYTES32 (no hex prefix needed beyond 0x).
contract SetPeer is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address senderAddr = vm.envAddress("PULSE_SENDER");
        uint32 dstEid = uint32(vm.envUint("DST_EID"));
        bytes32 peer = vm.envBytes32("PEER_BYTES32");

        vm.startBroadcast(pk);
        PulseSender(senderAddr).setPeer(dstEid, peer);
        vm.stopBroadcast();

        console2.log("Set peer for EID", dstEid);
        console2.log("Peer (hex):", vm.toString(peer));
    }
}
