import { shopifyLocationId } from './shopify-config';

/**
 * MUTATIONS
 */
export const priceUpdate = `
  mutation productUpdate($input: ProductInput!) {
    productUpdate(input: $input) {
      product {
        id
        variants(first: 1) {
          edges {
            node {
              price
            }
          }

        }
      }
      userErrors {
        field
        message
      }
    }
  }`;

export const inventoryUpdate = `
    mutation inventoryAdjustQuantity($input: InventoryAdjustQuantityInput!) {
      inventoryAdjustQuantity(input: $input) {
        inventoryLevel {
          available
        }
        userErrors {
          field
          message
        }
      }
    }`;

export const pollBulkProducts = `
  query {
    currentBulkOperation {
      id
      status
      errorCode
      createdAt
      completedAt
      objectCount
      fileSize
      url
      partialDataUrl
    }
  }`;

export const bulkProducts = `
  mutation {
    bulkOperationRunQuery(
    query: """
      {
        products {
          edges {
            cursor
            node {
              id
              title
              description
              totalInventory
              variants(first: 5) {
                edges {
                    node {
                    id
                    inventoryItem {
                        sku
                        inventoryLevel(locationId: "${shopifyLocationId}") {
                          id
                          available
                        }
                    }
                  }
                }
              }
              priceRange {
                maxVariantPrice {
                  amount
                },
                minVariantPrice {
                  amount
                }
              }
            }
          }
        }
      }
      """
    ) {
      bulkOperation {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }`;

/**
 * QUERIES
 */
// products(query: "created_at:<2019", first: 50) {
export const productsQueryFirst = `{
    products(first: 50) {
      pageInfo {
        hasNextPage
        hasPreviousPage
      }
      edges {
        cursor
        node {
          id
          title
          description
          totalInventory
          variants(first: 5) {
            edges {
                node {
                id
                inventoryItem {
                    sku
                    inventoryLevel(locationId: "${shopifyLocationId}") {
                      id
                      available
                    }
                }
              }
            }
          }
          priceRange {
            maxVariantPrice {
              amount
            }
          }
        }
      }
    }
  }`;

export function productsQueryNext(cursor: string) {
  return `{
    products(first: 50, after: "${cursor}") {
      pageInfo {
        hasNextPage
        hasPreviousPage
      }
      edges {
        cursor
        node {
          id
          title
          description
          totalInventory
          variants(first: 5) {
            edges {
                node {
                id
                inventoryItem {
                    sku
                    inventoryLevel(locationId: "${shopifyLocationId}") {
                      id
                      available
                    }
                }
              }
            }
          }
          priceRange {
            maxVariantPrice {
              amount
            }
          }
        }
      }
    }
  }`;
}

export function getInventoryLevelQuery(productId: string) {
  return `{
      product(id: "${productId}") {
        id
        title
        variants(first: 5) {
          edges {
            node {
              id
              inventoryItem {
                inventoryLevel(locationId: "${shopifyLocationId}") {
                  id
                }
              }
            }
          }
        }
      }
    }`;
}

export const unused_productQueryFull = `{
    product(id: "gid://shopify/Product/7610313313549") {
      id
      title
      variants(first: 1) {
        edges {
          node {
            id
            inventoryItem {
              inventoryLevels (first:1) {
                edges {
                  node {
                    id
                    location {
                      name
                    }
                    available
                  }
                }
              }
            }
          }
        }
      }
    }
  }`;
