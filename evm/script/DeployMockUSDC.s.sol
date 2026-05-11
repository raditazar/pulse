// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Script, console2 } from "forge-std/Script.sol";
import { MockUSDC } from "../src/MockUSDC.sol";

/// @notice Deploy MockUSDC ke chain target. Owner = msg.sender (deployer key).
/// Usage:
///   forge script script/DeployMockUSDC.s.sol --rpc-url base_sepolia --broadcast --verify
contract DeployMockUSDC is Script {
    function run() external returns (MockUSDC usdc) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);
        usdc = new MockUSDC(deployer);
        vm.stopBroadcast();

        console2.log("MockUSDC deployed:", address(usdc));
        console2.log("Owner:", deployer);
        console2.log("Chain ID:", block.chainid);
    }
}
