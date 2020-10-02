const BigNumber = require('bignumber.js')
const { RestClient, WalletClient } = require('tradehub-api-js')

const BaseBot = require('./index')


class PriceKeeper extends BaseBot {
  constructor(marketParams, config, wallet, network) {
    super(marketParams, config.market, wallet, network, config.id)
  }

  async run(indexPrice) {
    if (indexPrice.isNaN() || indexPrice.isZero()) {
      console.log(`mark price for ${this.market} is undefined or 0`)
      return 
    }

    const opens = await this.rest.getOpenOrders({ market: this.market })
    const cancels = []

    opens.forEach(open => {
      cancels.push({ id: open.orderId })
    })

    if (cancels.length > 0) {
      const cancelResponse = await this.rest.cancelOrders(cancels)
      try {
        console.log(`${this.id} price_keeper cancel success:`, cancelResponse.logs[0].log)
      } catch (e) {
        console.log(`${this.id} price_keeper cancel failed`, cancelResponse)
      }
    }

    const creates = []
    const orderbook = await this.rest.getOrderBook({ market: this.market })
    if (orderbook.bids.length > 0) {
      if (new BigNumber(orderbook.bids[0].price).gt(indexPrice)) {
        creates.push(this.constructMarketOrder({
          side: 'sell',
          quantity: orderbook.bids[0].quantity,
        }))
      }
    }
    if (orderbook.asks.length > 0) {
      if (new BigNumber(orderbook.asks[0].price).lt(indexPrice)) {
          creates.push(this.constructMarketOrder({
            side: 'buy',
            quantity: orderbook.asks[0].quantity,
          }))
      }
    }
    if (creates.length > 0) {
      const createResults = await this.rest.createOrders(creates)
      try {
        console.log(`${this.id} price_keeper create success:`, createResults.logs[0].log)
      } catch (e) {
        console.log(`${this.id} price_keeper create failed`, createResults)
      }
    }
  }
}

module.exports = PriceKeeper