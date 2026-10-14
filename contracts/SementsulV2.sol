// SPDX-License-Identifier: MIT
// Sementsul V2 — исправленная версия ТЗ от Google ИИ.
// Ключевой фикс: резерв 250M реально минтится на баланс контракта,
// сжигание — настоящий _burn с баланса контракта (дефляция честная).
// Remix: solc 0.8.22 (рекомендуется, EVM paris) либо любой 0.8.20+; OZ 5.0.2
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts@5.0.2/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts@5.0.2/access/Ownable.sol";

contract SementsulV2 is ERC20, Ownable {
    address public networkOracle;
    address public treasuryWallet;

    uint256 public constant TOTAL_SUPPLY_CAP = 1_000_000_000 * 10 ** 18;
    uint256 public constant MAX_BURN_POOL = 250_000_000 * 10 ** 18;
    uint256 public constant BURN_CAP_PER_YEAR = 2_500_000 * 10 ** 18;

    uint256 public constant PRIMARY_BURN = 10 * 10 ** 18;
    uint256 public constant PRIMARY_REWARD = 3 * 10 ** 18;
    uint256 public constant RECAPTURE_BURN = 10 * 10 ** 18;
    uint256 public constant RECAPTURE_REWARD = 7 * 10 ** 18;

    // Лимит вызовов оракула в сутки — защита от спама фейковыми IP
    // и drained-резерва за один день.
    uint256 public constant MAX_MINTS_PER_DAY = 500;
    mapping(uint256 => uint256) public dailyMintCount; // dayId => count

    uint256 public immutable START_TIME;
    uint256 public totalBurned;
    mapping(uint256 => uint256) public yearlyBurnVolume;
    mapping(bytes32 => uint8) public ipStatus; // 0=new, 1=primary, 2=recidivist

    event BotPrimary(bytes32 indexed ipHash, address indexed webmaster, uint256 burned, uint256 rewarded);
    event BotRecaptured(bytes32 indexed ipHash, uint256 burned, uint256 rewarded);

    error OnlyOracle();
    error NotVerified();
    error EraEnded();
    error YearlyCap();
    error DailyCap();
    error ReserveEmpty();

    constructor(address initialOwner, address _oracle, address _treasury)
        ERC20("Sementsul", "SML")
        Ownable(initialOwner)
    {
        require(_oracle != address(0) && _treasury != address(0), "zero addr");
        networkOracle = _oracle;
        treasuryWallet = _treasury;
        START_TIME = block.timestamp;

        uint256 marketSupply = TOTAL_SUPPLY_CAP - MAX_BURN_POOL; // 750M
        _mint(initialOwner, marketSupply);
        _mint(address(this), MAX_BURN_POOL); // реальный резерв на балансе контракта
    }

    function setOracle(address v) external onlyOwner {
        require(v != address(0), "zero addr");
        networkOracle = v;
    }

    function setTreasury(address v) external onlyOwner {
        require(v != address(0), "zero addr");
        treasuryWallet = v;
    }

    function burnReservePool() public view returns (uint256) {
        return balanceOf(address(this));
    }

    function currentYear() public view returns (uint256) {
        return (block.timestamp - START_TIME) / 365 days;
    }

    function currentDay() public view returns (uint256) {
        return (block.timestamp - START_TIME) / 1 days;
    }

    /// @param webmaster кошелек зафиксировавшего бота
    /// @param ipHash keccak256(ip) — IP никогда не пишется в chain (privacy + газ)
    /// @param isCaughtByUs оракул подтверждает наличие IP в D1 (иначе revert)
    function processAttackMining(address webmaster, bytes32 ipHash, bool isCaughtByUs)
        external
    {
        if (msg.sender != networkOracle) revert OnlyOracle();
        if (!isCaughtByUs) revert NotVerified();
        if (webmaster == address(0) || ipHash == bytes32(0)) revert NotVerified();

        uint256 year = currentYear();
        if (year >= 100) revert EraEnded();

        uint256 day = currentDay();
        if (dailyMintCount[day] >= MAX_MINTS_PER_DAY) revert DailyCap();
        dailyMintCount[day] += 1;

        if (ipStatus[ipHash] == 0) {
            if (yearlyBurnVolume[year] + PRIMARY_BURN > BURN_CAP_PER_YEAR) revert YearlyCap();
            if (balanceOf(address(this)) < PRIMARY_BURN) revert ReserveEmpty();
            yearlyBurnVolume[year] += PRIMARY_BURN;
            totalBurned += PRIMARY_BURN;
            _burn(address(this), PRIMARY_BURN); // настоящее сжигание
            ipStatus[ipHash] = 1;
            _mint(webmaster, PRIMARY_REWARD);
            emit BotPrimary(ipHash, webmaster, PRIMARY_BURN, PRIMARY_REWARD);
        } else {
            if (yearlyBurnVolume[year] + RECAPTURE_BURN > BURN_CAP_PER_YEAR) revert YearlyCap();
            if (balanceOf(address(this)) < RECAPTURE_BURN) revert ReserveEmpty();
            yearlyBurnVolume[year] += RECAPTURE_BURN;
            totalBurned += RECAPTURE_BURN;
            _burn(address(this), RECAPTURE_BURN);
            ipStatus[ipHash] = 2;
            _mint(treasuryWallet, RECAPTURE_REWARD);
            emit BotRecaptured(ipHash, RECAPTURE_BURN, RECAPTURE_REWARD);
        }
    }
}
