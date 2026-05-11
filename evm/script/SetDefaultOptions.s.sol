// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Script, console2 } from "forge-std/Script.sol";
import { PulseSender } from "../src/PulseSender.sol";

/// @notice Set default LZ Executor options pada PulseSender. Requires env:
///   PRIVATE_KEY, PULSE_SENDER, OPTIONS_HEX (LZ options bytes, e.g. 0x0003...).
///
/// LZ V2 options spec — type 3 (lzReceive): gas (uint128) + value (uint128).
/// Untuk Solana lzReceive (Anchor program), pakai ~200_000 gas + 0 value sebagai starting point.
/// Build options dengan `OptionsBuilder.newOptions().addExecutorLzReceiveOption(gas, value)`.
contract SetDefaultOptions is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address senderAddr = vm.envAddress("PULSE_SENDER");
        bytes memory options = vm.envBytes("OPTIONS_HEX");

        vm.startBroadcast(pk);
        PulseSender(senderAddr).setDefaultOptions(options);
        vm.stopBroadcast();

        console2.log("Default options set:");
        console2.logBytes(options);
    }
}
