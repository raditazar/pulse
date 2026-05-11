// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockUSDC — Pulse hackathon mock stablecoin (6 decimals, testnet only).
/// @notice Deployable independently di Base Sepolia & Arbitrum Sepolia. Faucet publik
///         (`faucet`) memungkinkan siapapun mint sampai `MAX_FAUCET_PER_CALL` per call,
///         dengan cooldown `FAUCET_COOLDOWN` per address — cukup untuk demo end-to-end
///         hackathon Pulse tanpa harus minta funded dari operator.
/// @dev    Owner masih bisa `ownerMint` tanpa batas untuk pre-funding treasury relayer.
contract MockUSDC is ERC20, Ownable {
    /// @dev USDC convention: 6 decimals.
    uint8 private constant _DECIMALS = 6;

    /// @notice Maximum yang bisa di-mint per panggilan `faucet`. 1_000 * 10**6 = 1000 USDC.
    uint256 public constant MAX_FAUCET_PER_CALL = 1_000 * 10 ** _DECIMALS;

    /// @notice Cooldown faucet per address (1 jam, mencegah spam).
    uint256 public constant FAUCET_COOLDOWN = 1 hours;

    /// @notice Last faucet timestamp per address.
    mapping(address => uint256) public lastFaucet;

    event FaucetClaimed(address indexed user, uint256 amount, uint256 nextEligibleAt);
    event OwnerMinted(address indexed to, uint256 amount);

    error FaucetCooldownActive(uint256 nextEligibleAt);
    error FaucetAmountTooLarge(uint256 amount, uint256 max);
    error FaucetAmountZero();

    constructor(address initialOwner) ERC20("Pulse Mock USDC", "pmUSDC") Ownable(initialOwner) {}

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    /// @notice Public faucet — mint sampai 1000 pmUSDC per address, 1× per jam.
    /// @param amount jumlah pmUSDC (base units, 6 decimals).
    function faucet(uint256 amount) external {
        if (amount == 0) revert FaucetAmountZero();
        if (amount > MAX_FAUCET_PER_CALL) revert FaucetAmountTooLarge(amount, MAX_FAUCET_PER_CALL);

        uint256 last = lastFaucet[msg.sender];
        if (last != 0) {
            uint256 next = last + FAUCET_COOLDOWN;
            if (block.timestamp < next) revert FaucetCooldownActive(next);
        }

        lastFaucet[msg.sender] = block.timestamp;
        _mint(msg.sender, amount);
        emit FaucetClaimed(msg.sender, amount, block.timestamp + FAUCET_COOLDOWN);
    }

    /// @notice Owner-only mint (no cooldown, no cap) — dipakai untuk pre-fund treasury relayer.
    function ownerMint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
        emit OwnerMinted(to, amount);
    }
}
