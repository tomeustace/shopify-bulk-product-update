import { Inject, Injectable } from '@nestjs/common';
import {
  productsQueryFirst,
  getInventoryLevelQuery,
  inventoryUpdate,
  priceUpdate,
  productsQueryNext,
  bulkProducts,
  pollBulkProducts,
} from './queries';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { shopifyUrl } from './shopify-config';
import { Logger } from 'winston';

const fetch = require('node-fetch');

@Injectable()
export class AppService {

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {
    this.logger.info('constructor()');
  }

  /**
   * Updates levels on shopify to match levels of local shop
   * @param inventoryLevelId e.g. 1700110
   * @param itemid e.g. inventory_item_id=4367484099
   * @param shopifyQuantity
   * @param localQuantity
   */
  async updateProductInventoryById(
    inventoryLevelId,
    itemid,
    shopifyQuantity,
    localQuantity,
  ): Promise<any> {
    const delta = this.calculateDelta(shopifyQuantity, localQuantity);
    const updateId = `gid://shopify/InventoryLevel/${inventoryLevelId}?${itemid}"`;
    this.logger.info('updateProductById()', updateId);
    return await fetch(shopifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: inventoryUpdate,
        variables: {
          input: {
            inventoryLevelId: updateId,
            availableDelta: delta,
          },
        },
      }),
    });
  }

  async getBulkProducts() {
    this.logger.info(`getBulkProducts()`);
    return await fetch(shopifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: bulkProducts,
      }),
    });
  }

  async pollBulkProducts() {
    this.logger.info(`pollBulkProducts()`);
    return await fetch(shopifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: pollBulkProducts,
      }),
    });
  }

  async updateProductPrices(mutation): Promise<any> {
    return await fetch(shopifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: mutation,
      }),
    });
  }

  async updateProductQuantities(mutation): Promise<any> {
    return await fetch(shopifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query: mutation,
      }),
    });
  }

  async updateProductPriceById(pid, variantId, lclPrice): Promise<any> {
    const productId = `gid://shopify/Product/${pid}`;
    this.logger.info('updateProductById()', productId, lclPrice);
    const query = {
      query: priceUpdate,
      variables: {
        input: {
          id: productId,
          variants: {
            price: lclPrice,
            id: `gid://shopify/ProductVariant/${variantId}`,
          },
        },
      },
    };
    this.logger.info('updateProductById()', JSON.stringify(query));
    return await fetch(shopifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(query),
    });
  }

  async products(): Promise<any> {
    return await fetch(shopifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/graphql',
        Accept: 'application/json',
      },
      body: productsQueryFirst,
    });
  }

  calculateDelta(shopifyQuantity, localQuantity): number {
    let delta = 0;
    if (shopifyQuantity < localQuantity) {
      // shopify 5, local 20 so 20 - 5 = 15
      delta = localQuantity - shopifyQuantity;
    } else if (shopifyQuantity > localQuantity) {
      // shopify 20, local 5 so 5 - 20 = 15
      delta = localQuantity - shopifyQuantity;
    }
    return delta;
  }

}
