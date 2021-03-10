import { Get, Controller, Param, Inject } from '@nestjs/common';
import { AppService } from './app.service';
import { intersectionWith, uniqBy } from 'lodash';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import * as fs from 'fs';
import * as jsonl from 'node-jsonl';

var path = require('path');    
const https = require('https');

const shopify_data_file = 'bulkdata.json';
var filePath = path.join(__dirname, shopify_data_file);

const neatCsv = require('neat-csv');
const rl = jsonl.readlinesChunk(filePath, 2);

@Controller()
export class AppController {
  csvData: any;
  mergedProducts: any;
  inventory: any;
  productEdges = [];
  pollInterval;
  queryNext: NodeJS.Timer;
  shopifyProducts: any;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly appService: AppService,
  ) {
    this.logger.info('constructor()');
    this.getBulkProducts();
  }

  /**
   * Uses shopifys buld query API to create bulkdata.json file
   * that contains all products.
   */
  getBulkProducts() {
    this.appService.getBulkProducts().then(res => {
      this.logger.info('getBulkProducts()', res);
      this.pollInterval = setInterval(() => {
        this.appService
          .pollBulkProducts()
          .then(pres => {
            this.logger.info('pollBulkProducts()', pres);
            return pres.json();
          })
          .then(r => {
            this.logger.info('pollBulkProducts()', r);
            if (r.data.currentBulkOperation.status === 'COMPLETED') {
              clearInterval(this.pollInterval);
              if (r.data.currentBulkOperation.url) {
                const file = fs.createWriteStream(filePath);
                https.get(
                  r.data.currentBulkOperation.url,
                  function(response) {
                    response.pipe(file);
                    setTimeout(() => {
                      this.readShopifyFile().then(res => {
                        this.doMerge();
                      });
                    }, 5000);
                  }.bind(this),
                );
              }
            }
          });
      }, 10000);
    });
  }

  async readShopifyFile() {
    this.logger.info('readShopifyFile()');
    while (true) {
        const {value, done} = await rl.next();
        if (done) break;
        const prod: any = {};
        prod.gid = value[0].id;
        prod.title = value[0].title;
        prod.variantId = value[1].id;
        prod.shopifyId = value[1].inventoryItem.sku;
        prod.inventoryLevelId = value[1].inventoryItem.inventoryLevel.id;
        prod.price = value[0].priceRange.maxVariantPrice.amount;
        prod.quantity = value[0].totalInventory.toString();
        this.productEdges.push(prod);
    }
  }

  async readLocalShopCsv(): Promise<any> {
    this.logger.info('readLocalShopCsv() called');
    const fs = require('fs').promises;
    return fs.readFile('./products.csv');
  }


  updateQuantityByIds(products) {
    if (!products || products.length === 0) {
      this.logger.info('No Product quantities to update');
      return;
    }
    const productUpdateQuery = products.map((product, i) => {
      product.id = 'id' + i + 'id';
      const id = product.inventoryLevelId;

      let delta;
      if(product.local.Quantity === 0) {
        delta = -Math.abs(product.quantity); 
      } else {
        delta = this.appService.calculateDelta(
          product.quantity,
          product.local.Quantity,
        );
      }
      this.logger.info(
        `Updating quantity: ${product.title}, ${product.gid}, new quantity: ${product.local.Quantity}, old quantity: ${product.quantity}`,
      );
      return `${product.id}: inventoryAdjustQuantity(input: {
            inventoryLevelId: "${id}",
            availableDelta: ${delta}
          })
          {
            inventoryLevel {
              id
            }
          }
        `;
    });

    const mutation = `mutation {
      ${productUpdateQuery}
    }`;
    return mutation;
  }

  updatePricesByIds(products) {
    if (!products || products.length === 0) {
      this.logger.info('No Product prices to update');
      return;
    }

    const productUpdateQuery = products.map((product, i) => {
      product.mutationId = 'id' + i + 'id';
      const variantId = product.variantId;
      this.logger.info(
        // tslint:disable-next-line: max-line-length
        `Updating price: ${product.title}, ${product.gid}, price shopify: ${product.price}, price local: ${product.local.Price}, variantId: ${variantId}`,
      );
      return `${product.mutationId}: productUpdate(input: {
            id: "${product.gid}",
            variants: {
              price: ${product.local.Price},
              id: "${variantId}"
            }
          })
          {
            product {
              id
              variants(first: 1) { edges { node { price } } }
            }
            userErrors {
              field
              message
            }
          }
        `;
    });
    const mutation = `mutation {
      ${productUpdateQuery}
    }`;
    return mutation;
  }

  doMerge() {
    this.logger.info(`doMerge() product  count - ${this.productEdges.length}`);
    this.mergeShopifyWithLocal(this.productEdges)
      .then(json => this.findProductsToUpdate(json))
      .then(productsToUpdate => this.updateQuantities(productsToUpdate))
      .then(productsToUpdate => this.updatePrices(productsToUpdate))
      .then(produtsToUpdate => {
        return { success: 'updated products' };
      })
      .catch(err => {
        this.logger.error(`getMergedProducts() ${err}`);
      });
  }

  @Get('/products')
  products(): Promise<any> {
    return this.appService
      .products()
      .then(res => res.json())
      .then(res => this.parseShopifyJson(res))
      .then(json => this.mergeShopifyWithLocal(json))
      .then(json => this.findProductsToUpdate(json))
      .then(res => {
        this.logger.info(`products() ${res}`);
        this.logger.info(`products() ${typeof res}`);
        this.logger.info(`products() ${Object.keys(res)}`);
        this.logger.info(`products() length ${res.length}`);
        return JSON.stringify(res);
      })
      .catch(err => {
        this.logger.error(err);
      });
  }

  @Get('/product/merged/')
  getMergedProducts(): Promise<any> {
    return this.appService
      .products()
      .then(res => res.json())
      .then(res => this.parseShopifyJson(res))
      .then(json => this.mergeShopifyWithLocal(json))
      .then(json => this.findProductsToUpdate(json))
      .then(productsToUpdate => this.updateQuantities(productsToUpdate))
      .then(productsToUpdate => this.updatePrices(productsToUpdate))
      .then(produtsToUpdate => {
        return { success: 'updated products' };
      })
      .catch(err => {
        this.logger.error(`getMergedProducts() ${err}`);
      });
  }

  async updatePrices(productsToUpdate?: any): Promise<any> {
    const productPriceUpdateMutation = this.updatePricesByIds(
      productsToUpdate.slice(0, 40),
    );
    if (!productPriceUpdateMutation) {
      return new Promise(() => productsToUpdate);
    }
    return await this.appService
      .updateProductPrices(productPriceUpdateMutation)
      .then(res => res.json())
      .then(res => {
        return res;
      })
      .catch(err => {
        this.logger.error('fetch failed', err);
      });
  }

  async updateQuantities(productsToUpdate): Promise<any> {

    const productQuantityUpdateMutation = this.updateQuantityByIds(
      productsToUpdate.slice(0, 40),
    );
    if (!productQuantityUpdateMutation) {
      return await new Promise((resolve, reject) => {
        resolve(productsToUpdate);
      });
    }
    return await this.appService
      .updateProductQuantities(productQuantityUpdateMutation)
      .then(() => productsToUpdate)
      .catch(err => {
        this.logger.error('updateQuantities() - fetch failed', err);
      });
  }

  /**
   * Update price and/or quantity on Shopify for each merged product
   */
  @Get(
    '/product/update/quantity/:id/:shopifyId/:itemid/:shpQuantity/:lclQuantity',
  )
  updateProductInventoryById(
    @Param('id') id,
    @Param('shopifyId') shopifyId,
    @Param('itemId') itemId,
    @Param('shpQuantity') shpQuantity,
    @Param('lclQuantity') lclQuantity,
  ): any {
    this.appService
      .updateProductInventoryById(id, itemId, shpQuantity, lclQuantity)
      .then(res => {
        this.logger.info(
          `Updated id: ${shopifyId} shopify quantity was ${shpQuantity}, local shop quantity is ${lclQuantity}`,
        );
        return JSON.stringify(res);
      });
  }

  /**
   * Update price and/or quantity on Shopify for each merged product
   */
  @Get(
    '/product/update/price/:id/:variantId/:shopifyId/:shopifyPrice/:lclPrice',
  )
  updateProductPriceById(
    @Param('id') id,
    @Param('variantId') variantId,
    @Param('shopifyId') shopifyId,
    @Param('shopifyPrice') shopifyPrice,
    @Param('lclPrice') lclPrice,
  ): any {
    this.appService
      .updateProductPriceById(id, variantId, lclPrice)
      .then(res => res.json())
      .then(
        res => {
          this.logger.info(
            `Updated id: ${shopifyId} shopify price was ${shopifyPrice}, local shop quantity is ${lclPrice}`,
          );
          return JSON.stringify([{ status: 'success' }]);
        },
        err => {
          this.logger.error('updateProductPriceById()', err);
        },
      );
  }

  findProductsToUpdate(mergedProducts: any): any {
    this.logger.info(`findProductsToUpdate() mergedProducts: ${mergedProducts.length}`);
    const priceUpdateRequired = mergedProducts.filter(product => {
      return this.priceUpdate(product);
    });
    const inventoryUpdateRequired = mergedProducts.filter(product => {
      return this.inventoryUpdate(product);
    });
    const productsToUpdate = [
      ...priceUpdateRequired,
      ...inventoryUpdateRequired,
    ];
    this.logger.info(`findProductsToUpdate() price updates needed: ${priceUpdateRequired.length}`);
    this.logger.info(
      `findProductsToUpdate() quantity updates needed: ${inventoryUpdateRequired.length}`,
    );

    const uniqProducts = uniqBy(productsToUpdate, 'shopifyId');
    this.logger.info(`findProductsToUpdate() combined: ${uniqProducts.length}`);
    return uniqProducts;
  }

  /**
   * Compare shopify price and local price
   * @param product
   */
  priceUpdate(product): boolean {
    let shopifyPrice = product.price;
    shopifyPrice = shopifyPrice / 100;
    if (product.local.Price != shopifyPrice) {
      console.log(
        'product.local.Price',
        product.local.Price,
        'shopifyPrice',
        shopifyPrice,
      );
      console.log(product.local.Price != shopifyPrice);
      return true;
    }
  }

  inventoryUpdate(product): boolean {
    const available = product.quantity;
    const localQuantity = product.local.Quantity;
    if (available != Math.round(localQuantity)) {
      return true;
    }
  }

  /**
   * Get the inventory level id needed to mutate inventory
   * @param json Product variant that contains inventory level id
   */
  private async parseInventoryLevels(json) {
    if (json.data.product) {
      const pds = json.data.product.variants.edges.map(variant => {
        return variant;
      });
      return pds;
    }
    return {};
  }

  private async parseShopifyJson(json) {
    this.logger.info(`parseShopifyJson()`);
    if (!json.data) {
      this.logger.error(`Error parsing products: ${Object.keys(json)}`);
      return {};
    }

    const edges = json.data.products.edges;
    if (json.data.products.pageInfo.hasNextPage) {
      this.productEdges.concat(json.data.products.edges);
      this.logger.info(`parseShopifyJson() ${this.productEdges.length}`);
    }

    if (json.data && json.data.products) {
      let pds = json.data.products.edges.map(product => {
        let sku = product.node.variants.edges[0].node.inventoryItem.sku;
        product.shopifyId = sku;
        return product;
      });
      return pds;
    } else {
      this.logger.error('no products' + Object.keys(json));
      return {};
    }
  }

  /**
   * Local and Remote product data
   * @param json
   */
  private mergeShopifyWithLocal(json) {
    return this.readLocalShopCsv().then(data => {
      return neatCsv(data, { separator: ' ' }).then(res => {
        const localProducts = intersectionWith(res, json, (d, e) => {
          return e.shopifyId === d.ItemLookupCode;
        });

        const merged = localProducts.map(pr => {
          const found = json.filter(p => {
            if (p.shopifyId === pr.ItemLookupCode) {
              p.local = pr;
              return p;
            }
          });
          return found[0];
        });
        this.mergedProducts = merged;
        return merged;
      });
    });
  }
}
