// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Script, console2 } from "forge-std/Script.sol";
import { PulseSender } from "../src/PulseSender.sol";

/// @notice Deploy PulseSender. Requires env:
///   PRIVATE_KEY, LZ_ENDPOINT (LZ V2 endpoint address pada chain target),
///   MOCK_USDC (alamat MockUSDC yang sudah di-deploy).
///
/// Usage:
///   LZ_ENDPOINT=0x... MOCK_USDC=0x... forge script script/DeployPulseSender.s.sol \
///     --rpc-url base_sepolia --broadcast --verify
contract DeployPulseSender is Script {
    function run() external returns (PulseSender sender) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address endpoint = vm.envAddress("LZ_ENDPOINT");
        address mockUsdc = vm.envAddress("MOCK_USDC");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);
        sender = new PulseSender(endpoint, mockUsdc, deployer);
        vm.stopBroadcast();

        console2.log("PulseSender deployed:", address(sender));
        console2.log("LZ Endpoint:", endpoint);
        console2.log("Mock USDC:", mockUsdc);
        console2.log("Owner:", deployer);
        console2.log("Source EID:", sender.srcEid());
    }
}
