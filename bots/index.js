const { BigNumber } = require('bignumber.js')
const { RestClient } = require('tradehub-api-js')

class BaseBot {
  constructor(marketParams, market, wallet, network, id) {
    this.marketParams = marketParams
    this.market = market
    this.wallet = wallet
    this.rest = new RestClient({ network, wallet })
    this.id = id
  }

  random(min, max, dpAdjustment) {
    const rawMin = min / dpAdjustment
    const rawMax = max / dpAdjustment
    return Math.floor(Math.random() * (rawMax - rawMin + 1) + rawMin) * dpAdjustment
  }

  constructLimitOrder({ price, side, quantity }) {
    return {
      market: this.marketParams.name,
      side: side,
      quantity: quantity.toFixed(new BigNumber(this.marketParams.lotSize).dp()),
      price: price.toFixed(new BigNumber(this.marketParams.tickSize).dp()),
      type: 'limit',
    }
  }
  constructMarketOrder({ side, quantity }) {
    return {
      market: this.marketParams.name,
      side: side,
      quantity,
      type: 'market',
    }
  }

  getOrderbookSpread(orderbook, markPrice) {
    if (orderbook.bids.length > 0 && orderbook.asks.length > 0) {
      const spreadAmount = new BigNumber(orderbook.asks[0].price).minus(new BigNumber(orderbook.bids[0].price))
      return spreadAmount.div(markPrice)
    }
    return new BigNumber(1)
  }
  // calculateSpread(orderbook)
  getPriceFromBookWithQuantity(book, quantity) {
    let countedQuantity = new BigNumber(0)
    for (let i = 0; i < book.length; i++) {
      const quoteQty = new BigNumber(book[i].quantity)
      if ((quoteQty.plus(countedQuantity)).gte(new BigNumber(quantity))) {
        return book[i].price
      }
      countedQuantity = countedQuantity.plus(quoteQty)
    }
    return 0
  }

  getBookPrice(orderbook, quantity, side) {
    if (side === 'buy') {
      return this.getPriceFromBookWithQuantity(orderbook.asks, quantity)
    }
    return this.getPriceFromBookWithQuantity(orderbook.bids, quantity)
  }

  async getSortedOpenOrders() {
    const orders = await this.rest.getOpenOrders({ market: this.market })
    const openSells = []
    const openBuys = []

    orders.forEach((order) => {
      order.price = new BigNumber(order.price)
      order.quantity = new BigNumber(order.quantity)
  
      if (order.side === 'buy') {
        openBuys.push(order)
      } else {
        openSells.push(order)
      }
    })

    // sort in ascending order
    openSells.sort((a, b) => a.price.minus(b.price).toNumber())

    // sort in desc order
    openBuys.sort((a, b) => b.price.minus(a.price).toNumber())

    return { openSells, openBuys }
  }
}

module.exports = BaseBot