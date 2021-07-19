const BigNumber = require('bignumber.js')
const ContractKit = require('@celo/contractkit')
const EpochRewards =  require("@celo/contractkit/lib/generated/EpochRewards.js")

const ALFAJORES_FORNO = 'https://alfajores-forno.celo-testnet.org'
const BAKLAVA_FORNO = 'https://baklava-forno.celo-testnet.org'
const MAINNET_FORNO = 'https://forno.celo.org'

const bn1e24 = new BigNumber(10 ** 24)
const bn1e18 = new BigNumber(10 ** 18)

// To get the staging validator-0 node port forwarded run:
// bash celotooljs.sh port-forward -e staging
const kitStaging = ContractKit.newKit("http://localhost:8545")
const kitAlfajores = ContractKit.newKit(ALFAJORES_FORNO)
const kitBaklava = ContractKit.newKit(BAKLAVA_FORNO)
const kitMainnet = ContractKit.newKit(MAINNET_FORNO)

async function printEpochRewardsParameters(kit) {
    const epochRewardsAddress = await kit.registry.addressFor('EpochRewards')
    const epochRewardsContract = EpochRewards.newEpochRewards(kit.web3, epochRewardsAddress)

    let targetVotingYieldParameters = Object.values((await epochRewardsContract.methods.getTargetVotingYieldParameters().call()))
    let targetVotingYieldParametersConverted = targetVotingYieldParameters.map(p => new BigNumber(p).dividedBy(bn1e24))

    let targetVotingFraction = await epochRewardsContract.methods.getTargetVotingGoldFraction().call()
    let targetVotingFractionConverted = new BigNumber(targetVotingFraction).dividedBy(bn1e24)

    let communityFundRewardFraction = await epochRewardsContract.methods.getCommunityRewardFraction().call()
    let communityFundRewardFractionConverted = new BigNumber(communityFundRewardFraction).dividedBy(bn1e24)

    let targetValidatorEpochPayment = await epochRewardsContract.methods.targetValidatorEpochPayment().call()
    let targetValidatorEpochPaymentConverted = new BigNumber(targetValidatorEpochPayment).dividedBy(bn1e18)

    console.log('Epoch Reward Parameters:')
    console.log('Target voting yield: ' + targetVotingYieldParametersConverted[0])
    console.log('Target voting yield max: ' + targetVotingYieldParametersConverted[1])
    console.log('Target voting yield adjustment factor: ' + targetVotingYieldParametersConverted[2])
    console.log("")
    console.log('Target voting fraction: ' + targetVotingFractionConverted)
    console.log("")
    console.log('Community fund reward fraction: ' + communityFundRewardFractionConverted)
    console.log("")
    console.log('Validator target epoch payment: ' + targetValidatorEpochPaymentConverted)
}

printEpochRewardsParameters(kitMainnet)
