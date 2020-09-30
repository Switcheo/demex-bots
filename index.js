const BigNumber = require('bignumber.js')
const yaml = require('js-yaml')
const fs   = require('fs')
const { RestClient, WalletClient } = require('tradehub-api-js')
const dotenv = require('dotenv')
dotenv.config()

const { sleep } = require('./utils')

function loadConfig() {
  const { bots, network, loop_frequency } = yaml.safeLoad(fs.readFileSync('./config.yml', 'utf8'))
  return { bots, network, loop_frequency }
}

async function run() {
  const config = loadConfig()

  const client = new RestClient({ network: config.network })
  const marketsParamsMap = {}
  const marketsParams = await client.getMarkets()
  marketsParams.forEach(m => {
    marketsParamsMap[m.name] = m
  })

  const bots = []
  for (let i = 0; i < config.bots.length; i++) {
    const b = config.bots[i]
    const mnemonics = process.env[b.env_mnemonics]
    const wallet = await new WalletClient.connectMnemonic(mnemonics, config.network)
    const Bot = require(`./bots/${b.bot}.js`)
    const botClass = new Bot(marketsParamsMap[b.market], b, wallet, config.network)
    bots.push(botClass)
  }

  while (true) {
    const start = process.hrtime()
    const prices = await client.getMarketStats()
    const pricesMap = {}
    prices.forEach(p => {
      pricesMap[p.market] = p
    })

    for (let i = 0; i <bots.length; i++) {
      const bot = bots[i]
      bot.run(new BigNumber(pricesMap[bot.market].markPrice))
    }
    const end = process.hrtime(start)[1] / 1000000
    console.info(`\n== loop completed in ${end}ms ==`)

    const sleepTime = config.loop_frequency - end
    if (sleepTime > 0 ) await sleep(sleepTime)

  }
}

run()