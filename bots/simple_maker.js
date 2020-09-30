const BigNumber = require('bignumber.js')
const { RestClient, WalletClient } = require('tradehub-api-js')

const BaseBot = require('./index')


class SimpleMaker extends BaseBot {
  constructor(marketParams, config, wallet, network) {
    super(marketParams, config.market, wallet, network, config.id)
    this.spread = new BigNumber(config.spread)
    this.max_size = config.max_size
    this.layers = config.layers
    this.layer_size = new BigNumber(config.layer_size)
  }

  randomPriceSpread(markPrice) {
    // 0.3% to 2%
    return new BigNumber(this.random(0.003, 0.02, 0.0001)).times(markPrice)
  }

  async run(markPrice) {
    if (markPrice.isNaN() || markPrice.isZero()) {
      console.log(`mark price for ${this.market} is undefined or 0`)
      return 
    }

    const { openBuys, openSells } = await this.getSortedOpenOrders()
    const cancels = []

    // ensures open orders do not exceed layers + 5 per side
    // will always cancel the worst price order (further from book)
    if (openBuys.length > this.layers) {
      // cancel the worst priced
      cancels.push({ id: openBuys[openBuys.length - 1].orderId })
    }
    if (openSells.length > this.layers) {
      // cancel the worst priced
      cancels.push({ id: openSells[openSells.length - 1].orderId })
    }

    if (openBuys.length > (this.layers + 5)) {
      // cancel more if there are too many open orders
      cancels.push({ id: openBuys[openBuys.length - 2].orderId })
    }
    if (openSells.length > (this.layers + 5)) {
      // cancel more if there are too many open orders
      cancels.push({ id: openSells[openSells.length - 2].orderId })
    }

    if (cancels.length > 0) {
      const cancelResponse = await this.rest.cancelOrders(cancels)
      try {
        console.log(`${this.id} simple_maker cancel success:`, cancelResponse.logs[0].log)
      } catch (e) {
        console.log(`${this.id} simple_maker cancel failed`, cancelResponse)
      }
    }

    const orderbook = await this.rest.getOrderBook({ market: this.market })
    const spread = this.getOrderbookSpread(orderbook, markPrice)

    const creates = []
    if (openSells.length < this.layers || openBuys.length < this.layers || spread.gt(this.spread)) {
      creates.push(this.constructLimitOrder({
        side: 'sell',
        price: markPrice.plus(this.randomPriceSpread(markPrice)),
        quantity: this.random(this.layer_size.times(0.8), this.layer_size.times(1.2), this.marketParams.lotSize)
      }))
      creates.push(this.constructLimitOrder({
        side: 'buy',
        price: markPrice.minus(this.randomPriceSpread(markPrice)),
        quantity: this.random(this.layer_size.times(0.8), this.layer_size.times(1.2), this.marketParams.lotSize)
      }))
    }
    if (creates.length > 0) {
      const createResults = await this.rest.createOrders(creates)
      try {
        console.log(`${this.id} simple_maker create success:`, createResults.logs[0].log)
      } catch (e) {
        console.log(`${this.id} simple_maker create failed`, createResults)
      }
    }

  }
}

module.exports = SimpleMaker