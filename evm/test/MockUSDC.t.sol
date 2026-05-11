// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Test } from "forge-std/Test.sol";
import { MockUSDC } from "../src/MockUSDC.sol";

contract MockUSDCTest is Test {
    MockUSDC internal usdc;
    address internal owner = address(0xA11CE);
    address internal alice = address(0xBEEF);
    address internal bob = address(0xCAFE);

    function setUp() public {
        vm.prank(owner);
        usdc = new MockUSDC(owner);
    }

    function test_metadata() public view {
        assertEq(usdc.name(), "Pulse Mock USDC");
        assertEq(usdc.symbol(), "pmUSDC");
        assertEq(usdc.decimals(), 6);
    }

    function test_faucet_succeeds_within_cap() public {
        vm.prank(alice);
        usdc.faucet(500 * 1e6);
        assertEq(usdc.balanceOf(alice), 500 * 1e6);
    }

    function test_faucet_rejects_zero() public {
        vm.prank(alice);
        vm.expectRevert(MockUSDC.FaucetAmountZero.selector);
        usdc.faucet(0);
    }

    function test_faucet_rejects_above_cap() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                MockUSDC.FaucetAmountTooLarge.selector,
                1_001 * 1e6,
                usdc.MAX_FAUCET_PER_CALL()
            )
        );
        usdc.faucet(1_001 * 1e6);
    }

    function test_faucet_enforces_cooldown() public {
        vm.startPrank(alice);
        usdc.faucet(100 * 1e6);

        vm.expectRevert(
            abi.encodeWithSelector(
                MockUSDC.FaucetCooldownActive.selector,
                block.timestamp + usdc.FAUCET_COOLDOWN()
            )
        );
        usdc.faucet(100 * 1e6);
        vm.stopPrank();

        // Setelah cooldown habis, allowed lagi.
        vm.warp(block.timestamp + usdc.FAUCET_COOLDOWN());
        vm.prank(alice);
        usdc.faucet(100 * 1e6);
        assertEq(usdc.balanceOf(alice), 200 * 1e6);
    }

    function test_faucet_cooldown_per_address_independent() public {
        vm.prank(alice);
        usdc.faucet(100 * 1e6);

        vm.prank(bob);
        usdc.faucet(100 * 1e6);

        assertEq(usdc.balanceOf(alice), 100 * 1e6);
        assertEq(usdc.balanceOf(bob), 100 * 1e6);
    }

    function test_ownerMint_only_owner() public {
        vm.prank(alice);
        vm.expectRevert();
        usdc.ownerMint(alice, 1_000_000 * 1e6);

        vm.prank(owner);
        usdc.ownerMint(alice, 1_000_000 * 1e6);
        assertEq(usdc.balanceOf(alice), 1_000_000 * 1e6);
    }

    function test_ownerMint_no_cap() public {
        vm.prank(owner);
        usdc.ownerMint(alice, 1_000_000_000 * 1e6);
        assertEq(usdc.balanceOf(alice), 1_000_000_000 * 1e6);
    }
}
