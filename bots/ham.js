const BigNumber = require('bignumber.js')
const { RestClient, WalletClient } = require('tradehub-api-js')

const BaseBot = require('./index')


class Ham extends BaseBot {
  constructor(marketParams, config, wallet, network) {
    super(marketParams, config.market, wallet, network, config.id)
    this.probabilities = config.probabilities
    this.minQuantity = new BigNumber(config.min_quantity)
    this.maxQuantity = new BigNumber(config.max_quantity)
  }

  rollBNDice() {
    return new BigNumber.random()
  }

  async createOrders(currentSize) {
    const creates = []
    const orderbook = await this.rest.getOrderBook({ market: this.market })
    if (!currentSize.isZero()) {
      const increaseSide = currentSize.isPositive() ? 'buy' : 'sell'
      const decreaseSide = currentSize.isPositive() ? 'sell' : 'buy'
      // close
      if (this.rollBNDice().lt(new BigNumber(this.probabilities.close))) {
        // market order
        creates.push(this.constructMarketOrder({ side: decreaseSide, quantity: currentSize.abs() }))

        if (this.rollBNDice().lt(new BigNumber(0.5))) {
          // 50% early return
          return creates
        }
      }
      // flip
      if (this.rollBNDice().lt(new BigNumber(this.probabilities.flip))) {
        // market order
        creates.push(this.constructMarketOrder({ side: decreaseSide, quantity: currentSize.abs().times(2) }))
      }

      // increase or reduce
      if (this.rollBNDice().lt(new BigNumber(this.probabilities.increase))) {
        const quantity = this.random(this.minQuantity, this.maxQuantity, this.marketParams.lotSize)
        const price = new BigNumber(this.getBookPrice(orderbook, quantity, increaseSide))
        // limit increase
        creates.push(this.constructLimitOrder({
          side: increaseSide,
          price,
          quantity,
        }))
      } else {
        // limit decrease
        const quantity = this.random(this.minQuantity, this.maxQuantity, this.marketParams.lotSize)
        const price = new BigNumber(this.getBookPrice(orderbook, quantity, decreaseSide))
        creates.push(this.constructLimitOrder({
          side: decreaseSide,
          price,
          quantity,
        }))
      }
    } else {
      // has no position
      // limit buy or sell
      let side = 'buy'
      if (this.rollBNDice().lt(new BigNumber(0.5))) {
        side = 'sell'
      }
      const quantity = this.random(this.minQuantity, this.maxQuantity, this.marketParams.lotSize)
      const price = new BigNumber(this.getBookPrice(orderbook, quantity, side))
      creates.push(this.constructLimitOrder({
        side,
        price,
        quantity,
      }))
    }
    return creates
  }

  async run(markPrice) {
    if (markPrice.isNaN() || markPrice.isZero()) {
      console.log(`mark price for ${this.market} is undefined or 0`)
      return 
    }

    const position = await this.rest.getPosition({ market: this.market })
    const currentSize = new BigNumber(position.lots)

    const creates = await this.createOrders(currentSize)

    if (creates.length > 0) {
      const createResults = await this.rest.createOrders(creates)
      try {
        console.log(`${this.id} ham create success:`, createResults.logs[0].log)
      } catch (e) {
        console.log(`${this.id} ham create failed`, createResults)
      }
    }

    if (this.rollBNDice().lt(new BigNumber(this.probabilities.leverage))) {
      // change leverage
      const newLeverage = this.random(config.min_leverage, config.max_leverage, 0.1)
      const leverageResults = await this.rest.setLeverage({ market: this.market, leverage: newLeverage.toFixed(1) })
      try {
        console.log(`${this.id} ham leverage success:`, leverageResults.logs[0].log)
      } catch (e) {
        console.log(`${this.id} ham leverage failed`, leverageResults)
      }
    }


    // const opens = await this.rest.getOpenOrders({ market: this.market })
    // const cancels = []

    // opens.forEach(open => {
    //   cancels.push({ id: open.orderId })
    // })

    // if (cancels.length > 0) {
    //   const cancelResponse = await this.rest.cancelOrders(cancels)
    //   try {
    //     console.log(`${this.id} price_keeper cancel success:`, cancelResponse.logs[0].log)
    //   } catch (e) {
    //     console.log(`${this.id} price_keeper cancel failed`, cancelResponse)
    //   }
    // }

    // const creates = []
    // const orderbook = await this.rest.getOrderBook({ market: this.market })
    // if (orderbook.bids.length > 0) {
    //   if (new BigNumber(orderbook.bids[0].price).gt(markPrice)) {
    //     creates.push(this.constructMarketOrder({
    //       side: 'sell',
    //       quantity: orderbook.bids[0].quantity,
    //     }))
    //   }
    // }
    // if (orderbook.asks.length > 0) {
    //   if (new BigNumber(orderbook.asks[0].price).lt(markPrice)) {
    //       creates.push(this.constructMarketOrder({
    //         side: 'buy',
    //         quantity: orderbook.asks[0].quantity,
    //       }))
    //   }
    // }

  }
}

module.exports = Ham