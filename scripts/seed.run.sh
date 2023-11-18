#!/bin/sh

# The first parameter should provide an Database Name to which migration will be applied.
# Select postgres-main, postgres-sub
DBName=$1

yarn ts-node ./node_modules/typeorm-extension/bin/cli.cjs \
    seed:run -d=./src/database/data-sources/${DBName}.ts
