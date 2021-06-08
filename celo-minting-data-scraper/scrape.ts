import { Address, CeloContract, newKit, NULL_ADDRESS } from "@celo/contractkit"
import { EpochRewards, newEpochRewards } from "@celo/contractkit/lib/generated/EpochRewards"
import { EventData, Contract } from 'web3-eth-contract'
import BigNumber from 'bignumber.js'
import { GoldToken } from "@celo/contractkit/lib/generated/GoldToken";
import { LockedGold } from "@celo/contractkit/lib/generated/LockedGold";
import { Election } from "@celo/contractkit/lib/generated/Election";
import { Reserve } from "@celo/contractkit/lib/generated/Reserve";

const ObjectsToCsv = require('objects-to-csv');
// To get an archive node port forwarded run:
// gcloud beta compute ssh --zone "us-west1-a" "rc1-tx-node-private-0-266776ac1558699a" --project "celo-testnet-production" -- -L 8545:localhost:8545 -N
const kit = newKit("http://localhost:8545")

const call = (block: number, tx: any) => {
    return tx.call({}, block)
}

const valueTransferedTo = (events: EventData[], to: string): string => {
    const event = events.find(e => e.returnValues.to === to)
    if (event) { 
        return event.returnValues.value
    }
    return "0"
}

const bn1e24 = new BigNumber("1000000000000000000000000")
const bn1e18 = new BigNumber("1000000000000000000")

const div = (rawBigNumber: string, other: BigNumber): string => {
    const bn = new BigNumber(rawBigNumber)
    if (bn.isZero()) return bn.toString()
    return new BigNumber(rawBigNumber).div(other).toFixed()
}

interface Row {
    epoch: number
    fromBlock: number,
    toBlock: number,
    timestamp: number,
    validatorRewards: string,
    voterRewards: string,
    communityFund: string,
    carbonOffsetFund: string,
    reserveCeloBalance: string,
    totalLockedCelo: string,
    totalVotingLockedCelo: string,
    totalNonvotingLockedCelo: string,
    votingCeloFraction: string,
    totalCeloSupply: string
    targetTotalCeloSupply: string
    targetVotingYieldTarget: string,
    targetVotingYieldMax: string,
    targetVotingYieldAdjustmentFactor: string,
    rewardsMultiplier: string,
    rewardsMultiplierOverspend: string,
    rewardsMultiplierUnderspend: string,
    rewardsMultiplierMax: string,
}

interface Context {
    chainBlockHeight: number,
    celo: GoldToken,
    lockedGold: LockedGold,
    epochRewards: EpochRewards,
    election: Election,
    reserve: Reserve,
    destinations: {
        validatorRewards: Address,
        voterRewards: Address,
        carbonOffsetFund: Address,
        communityFund: Address
    }
}

async function setupContext(): Promise<Context> {
    const epochRewards = newEpochRewards(kit.web3, await kit.registry.addressFor(CeloContract.EpochRewards))
    // @ts-ignore
    const lockedGold = (await kit.contracts.getLockedGold()).contract;
    // @ts-ignore
    const celo = (await kit.contracts.getGoldToken()).contract;
    // @ts-ignore
    const election = (await kit.contracts.getElection()).contract;
    // @ts-ignore
    const reserve = (await kit.contracts.getReserve()).contract;

    // Hasn't changed since set so I'm keeping it as a constant
    const CARBON_FUND = "0x0ba9f5B3CdD349aB65a8DacDA9A38Bc525C2e6D6"
    const LOCKED_GOLD = await kit.registry.addressFor(CeloContract.LockedGold)
    const GOVERNANCE = await kit.registry.addressFor(CeloContract.Governance)
    const RESERVE = await kit.registry.addressFor(CeloContract.Reserve)

    return {
        celo,
        epochRewards,
        lockedGold,
        election,
        reserve,
        chainBlockHeight: await kit.web3.eth.getBlockNumber(),
        destinations: {
            validatorRewards: RESERVE,
            voterRewards: LOCKED_GOLD,
            communityFund: GOVERNANCE,
            carbonOffsetFund: CARBON_FUND
        }
    }

}

async function collectEpochRow(ctx: Context, epoch: number): Promise<Row | null> {
    const fromBlock = await kit.getFirstBlockNumberForEpoch(epoch)
    const toBlock = await kit.getLastBlockNumberForEpoch(epoch)
    if (toBlock > ctx.chainBlockHeight) return null

    
    const events = await ctx.celo.getPastEvents("Transfer", {
        fromBlock,
        toBlock,
        filter: {
            from: NULL_ADDRESS
        }
    })

    const endBlock = await kit.web3.eth.getBlock(toBlock)

    if (events.length > 4) {
        console.log("Unexpected Mint!")
        console.log(events)
        process.exit()
    }

    const totalLockedCelo = await call(toBlock, ctx.lockedGold.methods.getTotalLockedGold())
    const totalNonvotingLockedCelo = await call(toBlock, ctx.lockedGold.methods.getNonvotingLockedGold())
    const totalVotingLockedCelo = await call(toBlock, ctx.election.methods.getTotalVotes())
    const totalCeloSupply = await call(toBlock, ctx.celo.methods.totalSupply())
    const votingCeloFraction = await call(toBlock, ctx.epochRewards.methods.getVotingGoldFraction())
    const reserveCeloBalance = await call(toBlock, ctx.reserve.methods.getReserveGoldBalance())
    const targetTotalCeloSupply = await call(toBlock, ctx.epochRewards.methods.getTargetGoldTotalSupply())
    const [
        targetVotingYieldTarget,
        targetVotingYieldMax,
        targetVotingYieldAdjustmentFactor,
    ] = await call(toBlock, ctx.epochRewards.methods.getTargetVotingYieldParameters())
    const rewardsMultiplier = await call(toBlock, ctx.epochRewards.methods.getRewardsMultiplier())
    const [
        rewardsMultiplierUnderspend,
        rewardsMultiplierOverspend,
        rewardsMultiplierMax
    ] = await call(toBlock, ctx.epochRewards.methods.getRewardsMultiplierParameters())

    const row: Row = {
        epoch,
        fromBlock,
        toBlock,
        timestamp: endBlock.timestamp as number,
        validatorRewards: div(valueTransferedTo(events, ctx.destinations.validatorRewards), bn1e18),
        voterRewards: div(valueTransferedTo(events, ctx.destinations.voterRewards), bn1e18),
        communityFund: div(valueTransferedTo(events, ctx.destinations.communityFund), bn1e18),
        carbonOffsetFund: div(valueTransferedTo(events, ctx.destinations.carbonOffsetFund), bn1e18),
        reserveCeloBalance: div(reserveCeloBalance, bn1e18),
        totalLockedCelo: div(totalLockedCelo, bn1e18),
        totalNonvotingLockedCelo: div(totalNonvotingLockedCelo, bn1e18),
        totalVotingLockedCelo: div(totalVotingLockedCelo, bn1e18),
        totalCeloSupply: div(totalCeloSupply, bn1e18),
        votingCeloFraction: div(votingCeloFraction, bn1e24),
        targetTotalCeloSupply: div(targetTotalCeloSupply, bn1e18),
        targetVotingYieldTarget: div(targetVotingYieldTarget, bn1e24),
        targetVotingYieldMax: div(targetVotingYieldMax, bn1e24),
        targetVotingYieldAdjustmentFactor: div(targetVotingYieldAdjustmentFactor, bn1e24),
        rewardsMultiplier: div(rewardsMultiplier, bn1e24),
        rewardsMultiplierOverspend: div(rewardsMultiplierOverspend, bn1e24),
        rewardsMultiplierUnderspend: div(rewardsMultiplierUnderspend, bn1e24),
        rewardsMultiplierMax: div(rewardsMultiplierMax, bn1e24)
    }

    return row
}

    

async function main() {
    const ctx = await setupContext()
    const fromEpoch = parseInt(process.argv[2] ?? 1)
    const rows: Array<Row> = []

    for (let epoch = fromEpoch;; epoch++) {
        try {
            const row = await collectEpochRow(ctx, epoch)
            if (row === null) {
                console.log("Done")
                break
            }
            console.log(row)
            rows.push(row)
        } catch(e) {
            console.log(e)
            break
        }
    }

    const csv = new ObjectsToCsv(rows)
    await csv.toDisk('./data/output.csv');
}

main()