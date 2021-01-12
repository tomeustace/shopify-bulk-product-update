# shopify-bulk-product-update

A sample app that performs bulk update of shopify prices and quantities.

## Description

1. Parses local products csv file
2. Retrieves products from shopify
3. Finds products that require updating
4. Updates products prices and quantities

NOTE: this is a sample app only, it may prove useful to people getting started with shopify graphql bulk api.

Endpoints in controller are callable via client app.

## Installation

```bash
$ npm install
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
npm run start:prod
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

